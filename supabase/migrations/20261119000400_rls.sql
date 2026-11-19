-- =====================================================================
-- 0004 · Row Level Security — menor privilégio por papel
-- Nenhuma policy "true" em operação sensível. Usuário inativo = sem acesso.
-- =====================================================================

-- Auxiliar: o usuário alvo é da equipe interna? (sem expor user_roles via RLS)
create or replace function public.is_staff_user(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = p_user and r.role <> 'cliente')
$$;

-- Clientes visíveis ao colaborador: só os das obras que ele acessa
create or replace function public.colaborador_ve_cliente(p_cliente uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_app_role() = 'colaborador' and exists (
    select 1 from public.obras o
     where o.cliente_id = p_cliente
       and (o.responsavel_id = auth.uid()
            or exists (select 1 from public.obra_usuarios u where u.obra_id = o.id and u.user_id = auth.uid())))
$$;

-- Anônimo não lê nada do schema público
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Habilita RLS em todas as tabelas de negócio
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','profiles','user_roles','empresa_config','fornecedores','funcionarios','materiais',
    'obras','obra_usuarios','obra_equipe','obra_etapas','rdos','obra_fotos','documentos','tarefas',
    'orcamentos','orcamento_itens','contratos','lancamentos','material_movimentos',
    'vistorias','laudos','compromissos']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- PERFIS
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_gestor() or (public.is_staff() and public.is_staff_user(id)));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_gestor())
  with check (id = auth.uid() or public.is_gestor());
-- insert/delete: somente via trigger de auth / service role

-- ---------------------------------------------------------------- PAPÉIS
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_gestor());
create policy user_roles_update on public.user_roles for update to authenticated
  using (public.is_gestor()) with check (public.is_gestor());
-- regras finas (master, auto-alteração) no trigger tg_protect_roles

-- ---------------------------------------------------------------- EMPRESA
create policy empresa_select on public.empresa_config for select to authenticated
  using (public.current_app_role() is not null);
create policy empresa_update on public.empresa_config for update to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

-- ---------------------------------------------------------------- CLIENTES
create policy clientes_select on public.clientes for select to authenticated
  using (public.is_gestor() or public.colaborador_ve_cliente(id) or id = public.my_cliente_id());
create policy clientes_insert on public.clientes for insert to authenticated with check (public.is_gestor());
create policy clientes_update on public.clientes for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy clientes_delete on public.clientes for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- FORNECEDORES / EQUIPE / MATERIAIS
create policy fornecedores_select on public.fornecedores for select to authenticated using (public.is_staff());
create policy fornecedores_insert on public.fornecedores for insert to authenticated with check (public.is_gestor());
create policy fornecedores_update on public.fornecedores for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy fornecedores_delete on public.fornecedores for delete to authenticated using (public.is_gestor());

create policy funcionarios_select on public.funcionarios for select to authenticated using (public.is_staff());
create policy funcionarios_insert on public.funcionarios for insert to authenticated with check (public.is_gestor());
create policy funcionarios_update on public.funcionarios for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy funcionarios_delete on public.funcionarios for delete to authenticated using (public.is_gestor());

create policy materiais_select on public.materiais for select to authenticated using (public.is_staff());
create policy materiais_insert on public.materiais for insert to authenticated with check (public.is_gestor());
create policy materiais_update on public.materiais for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy materiais_delete on public.materiais for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- OBRAS
create policy obras_select on public.obras for select to authenticated using (public.can_access_obra(id));
create policy obras_insert on public.obras for insert to authenticated with check (public.is_gestor());
create policy obras_update on public.obras for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy obras_delete on public.obras for delete to authenticated using (public.is_gestor());

create policy obra_usuarios_select on public.obra_usuarios for select to authenticated
  using (public.is_staff() and public.can_access_obra(obra_id));
create policy obra_usuarios_write on public.obra_usuarios for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

create policy obra_equipe_select on public.obra_equipe for select to authenticated
  using (public.is_staff() and public.can_access_obra(obra_id));
create policy obra_equipe_write on public.obra_equipe for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

create policy etapas_select on public.obra_etapas for select to authenticated using (public.can_access_obra(obra_id));
create policy etapas_insert on public.obra_etapas for insert to authenticated with check (public.can_edit_obra(obra_id));
create policy etapas_update on public.obra_etapas for update to authenticated
  using (public.can_edit_obra(obra_id)) with check (public.can_edit_obra(obra_id));
create policy etapas_delete on public.obra_etapas for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- RDO
create policy rdos_select on public.rdos for select to authenticated
  using (public.can_access_obra(obra_id) and (public.is_staff() or visivel_cliente));
create policy rdos_insert on public.rdos for insert to authenticated
  with check (public.can_edit_obra(obra_id) and autor_id = auth.uid());
create policy rdos_update on public.rdos for update to authenticated
  using (public.is_gestor() or (autor_id = auth.uid() and public.can_edit_obra(obra_id)))
  with check (public.can_edit_obra(obra_id));
create policy rdos_delete on public.rdos for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- FOTOS
create policy fotos_select on public.obra_fotos for select to authenticated
  using (public.can_access_obra(obra_id) and (public.is_staff() or visivel_cliente));
create policy fotos_insert on public.obra_fotos for insert to authenticated
  with check (public.can_edit_obra(obra_id) and autor_id = auth.uid());
create policy fotos_update on public.obra_fotos for update to authenticated
  using (public.is_gestor() or (autor_id = auth.uid() and public.can_edit_obra(obra_id)))
  with check (public.can_edit_obra(obra_id));
create policy fotos_delete on public.obra_fotos for delete to authenticated
  using (public.is_gestor() or (autor_id = auth.uid() and public.can_edit_obra(obra_id)));

-- ---------------------------------------------------------------- DOCUMENTOS
create policy documentos_select on public.documentos for select to authenticated
  using ((obra_id is null and public.is_staff())
      or (obra_id is not null and public.can_access_obra(obra_id) and (public.is_staff() or visivel_cliente)));
create policy documentos_insert on public.documentos for insert to authenticated
  with check (autor_id = auth.uid() and ((obra_id is null and public.is_gestor()) or (obra_id is not null and public.can_edit_obra(obra_id))));
create policy documentos_update on public.documentos for update to authenticated
  using (public.is_gestor()) with check (public.is_gestor());
create policy documentos_delete on public.documentos for delete to authenticated
  using (public.is_gestor() or (autor_id = auth.uid() and obra_id is not null and public.can_edit_obra(obra_id)));

-- ---------------------------------------------------------------- TAREFAS
create policy tarefas_select on public.tarefas for select to authenticated
  using (public.is_gestor()
      or (public.current_app_role() = 'colaborador'
          and (responsavel_id = auth.uid() or created_by = auth.uid() or (obra_id is not null and public.can_access_obra(obra_id)))));
create policy tarefas_insert on public.tarefas for insert to authenticated
  with check (public.is_gestor()
      or (public.current_app_role() = 'colaborador' and created_by = auth.uid()
          and (obra_id is null or public.can_edit_obra(obra_id))));
create policy tarefas_update on public.tarefas for update to authenticated
  using (public.is_gestor() or (public.current_app_role() = 'colaborador' and (responsavel_id = auth.uid() or created_by = auth.uid())))
  with check (public.is_gestor() or (public.current_app_role() = 'colaborador' and (obra_id is null or public.can_edit_obra(obra_id))));
create policy tarefas_delete on public.tarefas for delete to authenticated
  using (public.is_gestor() or (public.current_app_role() = 'colaborador' and created_by = auth.uid()));

-- ---------------------------------------------------------------- ORÇAMENTOS
create policy orcamentos_select on public.orcamentos for select to authenticated
  using (public.is_gestor() or (cliente_id = public.my_cliente_id() and status <> 'rascunho'));
create policy orcamentos_insert on public.orcamentos for insert to authenticated with check (public.is_gestor());
create policy orcamentos_update on public.orcamentos for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy orcamentos_delete on public.orcamentos for delete to authenticated using (public.is_gestor() and status = 'rascunho');

create policy orc_itens_select on public.orcamento_itens for select to authenticated
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id));  -- herda a RLS de orcamentos
create policy orc_itens_write on public.orcamento_itens for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

-- ---------------------------------------------------------------- CONTRATOS
create policy contratos_select on public.contratos for select to authenticated
  using (public.is_gestor() or (cliente_id = public.my_cliente_id() and status <> 'rascunho'));
create policy contratos_insert on public.contratos for insert to authenticated with check (public.is_gestor());
create policy contratos_update on public.contratos for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy contratos_delete on public.contratos for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- FINANCEIRO
create policy lanc_select on public.lancamentos for select to authenticated
  using (public.is_gestor()
      or (tipo = 'receita' and status <> 'cancelado' and cliente_id is not null and cliente_id = public.my_cliente_id()));
create policy lanc_insert on public.lancamentos for insert to authenticated with check (public.is_gestor());
create policy lanc_update on public.lancamentos for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy lanc_delete on public.lancamentos for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- ESTOQUE
create policy mov_select on public.material_movimentos for select to authenticated using (public.is_staff());
create policy mov_insert on public.material_movimentos for insert to authenticated
  with check (autor_id = auth.uid() and (public.is_gestor()
      or (public.current_app_role() = 'colaborador' and tipo = 'saida' and obra_id is not null and public.can_edit_obra(obra_id))));
create policy mov_delete on public.material_movimentos for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- VISTORIAS
create policy vistorias_select on public.vistorias for select to authenticated
  using (public.is_gestor()
      or (public.current_app_role() = 'colaborador' and (responsavel_id = auth.uid() or (obra_id is not null and public.can_access_obra(obra_id))))
      or (public.current_app_role() = 'cliente' and (cliente_id = public.my_cliente_id() or (obra_id is not null and public.can_access_obra(obra_id)))));
create policy vistorias_insert on public.vistorias for insert to authenticated with check (public.is_gestor());
create policy vistorias_update on public.vistorias for update to authenticated
  using (public.is_gestor() or (public.current_app_role() = 'colaborador' and responsavel_id = auth.uid()))
  with check (public.is_gestor() or (public.current_app_role() = 'colaborador' and responsavel_id = auth.uid()));
create policy vistorias_delete on public.vistorias for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- LAUDOS
create policy laudos_select on public.laudos for select to authenticated
  using (public.is_gestor()
      or (public.current_app_role() = 'colaborador' and (responsavel_id = auth.uid() or (obra_id is not null and public.can_access_obra(obra_id))))
      or (public.current_app_role() = 'cliente' and visivel_cliente and status in ('concluido','entregue')
          and (cliente_id = public.my_cliente_id() or (obra_id is not null and public.can_access_obra(obra_id)))));
create policy laudos_insert on public.laudos for insert to authenticated with check (public.is_gestor());
create policy laudos_update on public.laudos for update to authenticated
  using (public.is_gestor() or (public.current_app_role() = 'colaborador' and responsavel_id = auth.uid()))
  with check (public.is_gestor() or (public.current_app_role() = 'colaborador' and responsavel_id = auth.uid() and visivel_cliente = false));
create policy laudos_delete on public.laudos for delete to authenticated using (public.is_gestor());

-- ---------------------------------------------------------------- AGENDA
create policy compromissos_select on public.compromissos for select to authenticated
  using (public.is_gestor()
      or (public.is_staff() and (responsavel_id = auth.uid() or created_by = auth.uid() or (obra_id is not null and public.can_access_obra(obra_id))))
      or (public.current_app_role() = 'cliente' and cliente_id = public.my_cliente_id()));
create policy compromissos_insert on public.compromissos for insert to authenticated
  with check (public.is_gestor() or (public.is_staff() and responsavel_id = auth.uid() and created_by = auth.uid()));
create policy compromissos_update on public.compromissos for update to authenticated
  using (public.is_gestor() or (public.is_staff() and (responsavel_id = auth.uid() or created_by = auth.uid())))
  with check (public.is_gestor() or (public.is_staff() and responsavel_id = auth.uid()));
create policy compromissos_delete on public.compromissos for delete to authenticated
  using (public.is_gestor() or (public.is_staff() and created_by = auth.uid()));
