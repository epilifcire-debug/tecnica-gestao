-- =====================================================================
-- 0006 · Storage (buckets + policies) e trilha de auditoria
-- =====================================================================

-- ---------------------------------------------------------------------
-- BUCKETS
--  obras       (privado) {obra_id}/fotos/*  · {obra_id}/docs/*  · {obra_id}/capa/*
--  documentos  (privado) geral/* · contratos/{id}/* · laudos/{id}/* · financeiro/*
--  avatars     (público) {user_id}/*
--  empresa     (público) logo, assinatura
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('obras',      'obras',      false, 20971520, array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
  ('documentos', 'documentos', false, 26214400, array['application/pdf','image/jpeg','image/png','image/webp',
                                                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                                    'application/dwg','image/vnd.dwg']),
  ('avatars',    'avatars',    true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('empresa',    'empresa',    true,  2097152,  array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- OBRAS ---------------------------------------------------------------
create policy "obras: leitura por quem acessa a obra" on storage.objects for select to authenticated
  using (bucket_id = 'obras' and public.can_access_obra(public.try_uuid((storage.foldername(name))[1]))
         and (public.is_staff()
              or exists (select 1 from public.obra_fotos f where f.storage_path = name)      -- RLS de obra_fotos filtra visivel_cliente
              or exists (select 1 from public.documentos d where d.storage_path = name)
              or (storage.foldername(name))[2] = 'capa'));
create policy "obras: upload por quem edita a obra" on storage.objects for insert to authenticated
  with check (bucket_id = 'obras' and public.can_edit_obra(public.try_uuid((storage.foldername(name))[1])));
create policy "obras: exclusão gestor ou autor" on storage.objects for delete to authenticated
  using (bucket_id = 'obras' and (public.is_gestor()
         or (owner_id = auth.uid()::text and public.can_edit_obra(public.try_uuid((storage.foldername(name))[1])))));

-- DOCUMENTOS ----------------------------------------------------------
create policy "documentos: leitura" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (
           public.is_gestor()
        or (public.is_staff() and (storage.foldername(name))[1] = 'geral')
        or exists (select 1 from public.contratos c where c.storage_path = name)   -- RLS de contratos aplica
        or exists (select 1 from public.laudos l where l.storage_path = name)));     -- RLS de laudos aplica
create policy "documentos: escrita gestor" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.is_gestor());
create policy "documentos: atualização gestor" on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and public.is_gestor()) with check (bucket_id = 'documentos' and public.is_gestor());
create policy "documentos: exclusão gestor" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.is_gestor());

-- AVATARS -------------------------------------------------------------
create policy "avatars: leitura" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars: próprio usuário" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.current_app_role() is not null);
create policy "avatars: atualizar próprio" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: excluir próprio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- EMPRESA -------------------------------------------------------------
create policy "empresa: leitura" on storage.objects for select to authenticated using (bucket_id = 'empresa');
create policy "empresa: escrita gestor" on storage.objects for insert to authenticated
  with check (bucket_id = 'empresa' and public.is_gestor());
create policy "empresa: atualização gestor" on storage.objects for update to authenticated
  using (bucket_id = 'empresa' and public.is_gestor()) with check (bucket_id = 'empresa' and public.is_gestor());
create policy "empresa: exclusão gestor" on storage.objects for delete to authenticated
  using (bucket_id = 'empresa' and public.is_gestor());

-- ---------------------------------------------------------------------
-- AUDITORIA
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id text,
  acao        text not null check (acao in ('INSERT','UPDATE','DELETE')),
  user_id     uuid default auth.uid(),
  antes       jsonb,
  depois      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_tabela_idx on public.audit_log (tabela, created_at desc);
alter table public.audit_log enable row level security;
create policy audit_select on public.audit_log for select to authenticated using (public.is_gestor());
-- sem insert/update/delete pelo cliente: só o trigger grava
revoke all on public.audit_log from anon;

create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_antes - 'updated_at' = v_depois - 'updated_at' then
    return new; -- nada mudou de fato
  end if;
  insert into public.audit_log (tabela, registro_id, acao, user_id, antes, depois)
  values (tg_table_name,
          coalesce(v_depois ->> 'id', v_antes ->> 'id', v_depois ->> 'user_id', v_antes ->> 'user_id'),
          tg_op, auth.uid(), v_antes, v_depois);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','user_roles','empresa_config','obras','orcamentos','contratos','lancamentos','laudos','clientes']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.tg_audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- REALTIME — somente onde há ganho real:
--   profiles (bloquear quem é desativado enquanto está logado)
--   user_roles (papel alterado reflete na hora)
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.profiles'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.user_roles'; exception when duplicate_object then null; end;
  end if;
end $$;
