-- =====================================================================
-- 0007 · Login por NOME DE USUÁRIO ou E-MAIL (e-mail opcional)
-- * profiles.username único (minúsculo: letras, números, ponto, _ e -)
-- * Usuário sem e-mail recebe no Auth um e-mail técnico
--   <username>@usuarios.tecnica.local (não recebe mensagens; perfil fica sem e-mail)
-- * login_email(login) resolve usuário → e-mail de acesso (usado antes do login)
-- =====================================================================

alter table public.profiles add column if not exists username text;
alter table public.profiles alter column email drop not null;

-- preenche usernames de quem já existe
update public.profiles p
   set username = sub.u
  from (select id, regexp_replace(lower(split_part(coalesce(email, id::text), '@', 1)), '[^a-z0-9._-]', '', 'g')
               || case when row_number() over (partition by regexp_replace(lower(split_part(coalesce(email, id::text), '@', 1)), '[^a-z0-9._-]', '', 'g') order by created_at) > 1
                       then row_number() over (partition by regexp_replace(lower(split_part(coalesce(email, id::text), '@', 1)), '[^a-z0-9._-]', '', 'g') order by created_at)::text else '' end as u
          from public.profiles) sub
 where sub.id = p.id and p.username is null;

alter table public.profiles alter column username set not null;
alter table public.profiles drop constraint if exists profiles_username_ck;
alter table public.profiles add constraint profiles_username_ck check (username ~ '^[a-z0-9._-]{3,30}$');
create unique index if not exists profiles_username_uk on public.profiles (username);

-- e-mail técnico nunca aparece como e-mail do perfil
create or replace function public.is_tech_email(e text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(lower(e) like '%@usuarios.tecnica.local', false)
$$;
update public.profiles set email = null where public.is_tech_email(email);

-- gera username livre a partir de uma base
create or replace function public.username_livre(p_base text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  b text := left(regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9._-]', '', 'g'), 26);
  u text;
  n int := 1;
begin
  if length(b) < 3 then b := 'usuario'; end if;
  u := b;
  while exists (select 1 from public.profiles where username = u) loop
    n := n + 1; u := b || n;
  end loop;
  return u;
end $$;
revoke execute on function public.username_livre(text) from public, anon, authenticated;

-- novo usuário: agora grava username e trata e-mail técnico
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role;
  v_meta_role text := new.raw_app_meta_data ->> 'role';
  v_cliente uuid := public.try_uuid(new.raw_app_meta_data ->> 'cliente_id');
  v_user text := lower(nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', new.raw_app_meta_data ->> 'username')), ''));
begin
  if not exists (select 1 from public.user_roles where role = 'admin_master') then
    v_role := 'admin_master';
  elsif v_meta_role in ('administrador','colaborador','cliente') then
    v_role := v_meta_role::public.app_role;
  else
    v_role := 'colaborador';
  end if;

  if v_user is null or v_user !~ '^[a-z0-9._-]{3,30}$' or exists (select 1 from public.profiles where username = v_user) then
    v_user := public.username_livre(coalesce(v_user, split_part(new.email, '@', 1)));
  end if;

  insert into public.profiles (id, nome, email, username, telefone, cargo, cliente_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    case when public.is_tech_email(new.email) then null else lower(new.email) end,
    v_user,
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone',''), '\D', '', 'g'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'cargo'), ''),
    case when v_role = 'cliente' then v_cliente end
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, v_role)
  on conflict (user_id) do nothing;
  return new;
end $$;

create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = case when public.is_tech_email(new.email) then null else lower(new.email) end
     where id = new.id;
  end if;
  return new;
end $$;

-- usuário comum não troca o próprio username (só gestor, via edge function/service role)
create or replace function public.tg_protect_username()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.username is distinct from old.username and auth.uid() is not null and not public.is_gestor() then
    raise exception 'Somente o administrador altera o nome de usuário.' using errcode = '42501';
  end if;
  new.username := lower(new.username);
  return new;
end $$;
drop trigger if exists profiles_username_protect on public.profiles;
create trigger profiles_username_protect before update of username on public.profiles
  for each row execute function public.tg_protect_username();

-- Resolve "usuário ou e-mail" → e-mail de acesso (chamado ANTES do login).
-- Retorna nulo se não existir; a tela mostra sempre a mesma mensagem genérica.
create or replace function public.login_email(p_login text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  l text := lower(trim(coalesce(p_login, '')));
  r text;
begin
  if l = '' or length(l) > 254 then return null; end if;
  if position('@' in l) > 0 then return l; end if;
  select u.email into r
    from public.profiles p join auth.users u on u.id = p.id
   where p.username = l and p.ativo;
  return r;
end $$;
revoke execute on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;

-- busca global também por username
comment on column public.profiles.username is 'Login alternativo ao e-mail (minúsculo, único).';
