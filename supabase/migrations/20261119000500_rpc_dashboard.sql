-- =====================================================================
-- 0005 · RPCs — indicadores, relatórios e operações atômicas
-- Indicadores são SECURITY INVOKER: a RLS de quem chama vale.
-- (colaborador não vê financeiro → valores financeiros retornam 0)
-- =====================================================================

-- ---------------------------------------------------------------------
-- dashboard_resumo(início, fim)
-- Compara com o período imediatamente anterior de mesma duração.
-- ---------------------------------------------------------------------
create or replace function public.dashboard_resumo(p_inicio date, p_fim date)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_dias int;
  v_ant_ini date;
  v_ant_fim date;
  r jsonb;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  v_dias := (p_fim - p_inicio) + 1;
  v_ant_fim := p_inicio - 1;
  v_ant_ini := p_inicio - v_dias;

  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'anterior_inicio', v_ant_ini, 'anterior_fim', v_ant_fim),
    'obras_andamento',      (select count(*) from public.obras where status = 'em_andamento'),
    'obras_andamento_ant',  (select count(*) from public.obras where status = 'em_andamento' and created_at::date <= v_ant_fim),
    'obras_orcamento',      (select count(*) from public.obras where status in ('orcamento','planejamento')),
    'obras_atrasadas',      (select count(*) from public.obras
                              where status = 'em_andamento' and previsao_termino < current_date and progresso < 100),
    'recebido',      (select coalesce(sum(valor),0) from public.lancamentos where tipo='receita' and status='pago' and pago_em between p_inicio and p_fim),
    'recebido_ant',  (select coalesce(sum(valor),0) from public.lancamentos where tipo='receita' and status='pago' and pago_em between v_ant_ini and v_ant_fim),
    'gastos',        (select coalesce(sum(valor),0) from public.lancamentos where tipo='despesa' and status='pago' and pago_em between p_inicio and p_fim),
    'gastos_ant',    (select coalesce(sum(valor),0) from public.lancamentos where tipo='despesa' and status='pago' and pago_em between v_ant_ini and v_ant_fim),
    'a_receber',     (select coalesce(sum(valor),0) from public.lancamentos where tipo='receita' and status='pendente'),
    'a_receber_ant', (select coalesce(sum(valor),0) from public.lancamentos where tipo='receita' and status='pendente' and created_at::date <= v_ant_fim),
    'a_pagar',       (select coalesce(sum(valor),0) from public.lancamentos where tipo='despesa' and status='pendente'),
    'receber_vencido',(select coalesce(sum(valor),0) from public.lancamentos where tipo='receita' and status='pendente' and vencimento < current_date),
    'clientes',      (select count(*) from public.clientes where ativo),
    'clientes_ant',  (select count(*) from public.clientes where ativo and created_at::date <= v_ant_fim),
    'tarefas_vencidas',     (select count(*) from public.tarefas where status in ('pendente','em_andamento') and prazo < current_date),
    'orcamentos_pendentes', (select count(*) from public.orcamentos where status = 'enviado'),
    'vistorias_pendentes',  (select count(*) from public.vistorias where status = 'agendada'),
    'laudos_pendentes',     (select count(*) from public.laudos where status in ('em_elaboracao','em_revisao'))
  ) into r;

  return r || jsonb_build_object(
    'saldo', (r->>'recebido')::numeric - (r->>'gastos')::numeric
  );
end $$;

-- ---------------------------------------------------------------------
-- receitas_gastos_mensal(ano) — série para o gráfico de barras
-- ---------------------------------------------------------------------
create or replace function public.receitas_gastos_mensal(p_ano int)
returns table (mes int, recebido numeric, gastos numeric)
language sql stable security invoker set search_path = '' as $$
  select m.mes,
         coalesce(sum(l.valor) filter (where l.tipo = 'receita'), 0) as recebido,
         coalesce(sum(l.valor) filter (where l.tipo = 'despesa'), 0) as gastos
    from generate_series(1, 12) as m(mes)
    left join public.lancamentos l
      on l.status = 'pago'
     and extract(year from l.pago_em) = p_ano
     and extract(month from l.pago_em) = m.mes
   group by m.mes
   order by m.mes
$$;

-- ---------------------------------------------------------------------
-- saldo_acumulado(início, fim) — curva diária do saldo realizado
-- ---------------------------------------------------------------------
create or replace function public.saldo_diario(p_inicio date, p_fim date)
returns table (dia date, saldo numeric)
language sql stable security invoker set search_path = '' as $$
  with dias as (select d::date as dia from generate_series(p_inicio, p_fim, interval '1 day') d),
       mov as (
         select pago_em as dia,
                sum(case when tipo = 'receita' then valor else -valor end) as delta
           from public.lancamentos
          where status = 'pago' and pago_em between p_inicio and p_fim
          group by pago_em)
  select d.dia, sum(coalesce(m.delta, 0)) over (order by d.dia) as saldo
    from dias d left join mov m on m.dia = d.dia
   order by d.dia
$$;

-- ---------------------------------------------------------------------
-- obra_financeiro(obra) — aba Financeiro da obra
-- saldo_previsto = valor contratado − despesas pagas
-- ---------------------------------------------------------------------
create or replace function public.obra_financeiro(p_obra uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'valor_contratado', o.valor_contratado,
    'recebido',  coalesce((select sum(valor) from public.lancamentos where obra_id = o.id and tipo='receita' and status='pago'), 0),
    'a_receber', coalesce((select sum(valor) from public.lancamentos where obra_id = o.id and tipo='receita' and status='pendente'), 0),
    'despesas',  coalesce((select sum(valor) from public.lancamentos where obra_id = o.id and tipo='despesa' and status='pago'), 0),
    'a_pagar',   coalesce((select sum(valor) from public.lancamentos where obra_id = o.id and tipo='despesa' and status='pendente'), 0)
  ) || jsonb_build_object(
    'saldo_previsto', o.valor_contratado - coalesce((select sum(valor) from public.lancamentos where obra_id = o.id and tipo='despesa' and status='pago'), 0),
    'percentual_recebido', case when o.valor_contratado > 0
        then round(100 * coalesce((select sum(valor) from public.lancamentos where obra_id = o.id and tipo='receita' and status='pago'), 0) / o.valor_contratado, 1)
        else 0 end
  )
  from public.obras o where o.id = p_obra
$$;

-- ---------------------------------------------------------------------
-- aprovar_orcamento — atômico: aprova, opcionalmente cria obra + contrato
-- ---------------------------------------------------------------------
create or replace function public.aprovar_orcamento(p_orcamento uuid, p_criar_obra boolean default false)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_orc public.orcamentos%rowtype;
  v_obra uuid;
  v_contrato uuid;
begin
  if not public.is_gestor() then
    raise exception 'Sem permissão para aprovar orçamentos.' using errcode = '42501';
  end if;

  select * into v_orc from public.orcamentos where id = p_orcamento for update;
  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_orc.status = 'aprovado' then
    return jsonb_build_object('orcamento_id', v_orc.id, 'obra_id', v_orc.obra_id, 'ja_aprovado', true); -- idempotente
  end if;
  if v_orc.status not in ('rascunho','enviado') then
    raise exception 'Orçamento com status % não pode ser aprovado.', v_orc.status using errcode = '22023';
  end if;
  if v_orc.total <= 0 then
    raise exception 'Orçamento sem itens ou com total zerado.' using errcode = '22023';
  end if;

  v_obra := v_orc.obra_id;
  if v_obra is null and p_criar_obra then
    insert into public.obras (nome, cliente_id, status, valor_contratado)
    values (v_orc.titulo, v_orc.cliente_id, 'planejamento', v_orc.total)
    returning id into v_obra;
  elsif v_obra is not null then
    update public.obras set valor_contratado = greatest(valor_contratado, v_orc.total) where id = v_obra;
  end if;

  update public.orcamentos
     set status = 'aprovado', aprovado_em = now(), aprovado_por = auth.uid(), obra_id = v_obra
   where id = v_orc.id;

  insert into public.contratos (cliente_id, obra_id, orcamento_id, objeto, valor, status)
  values (v_orc.cliente_id, v_obra, v_orc.id, v_orc.titulo, v_orc.total, 'rascunho')
  returning id into v_contrato;

  return jsonb_build_object('orcamento_id', v_orc.id, 'obra_id', v_obra, 'contrato_id', v_contrato, 'ja_aprovado', false);
end $$;

-- ---------------------------------------------------------------------
-- duplicar_orcamento — cria rascunho a partir de outro
-- ---------------------------------------------------------------------
create or replace function public.duplicar_orcamento(p_orcamento uuid)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_novo uuid;
begin
  if not public.is_gestor() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  insert into public.orcamentos (cliente_id, obra_id, titulo, validade, desconto, condicoes, observacoes)
  select cliente_id, obra_id, titulo || ' (cópia)', current_date + 15, desconto, condicoes, observacoes
    from public.orcamentos where id = p_orcamento
  returning id into v_novo;
  if v_novo is null then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;
  insert into public.orcamento_itens (orcamento_id, ordem, descricao, unidade, quantidade, valor_unitario)
  select v_novo, ordem, descricao, unidade, quantidade, valor_unitario
    from public.orcamento_itens where orcamento_id = p_orcamento;
  return v_novo;
end $$;

-- ---------------------------------------------------------------------
-- gerar_parcelas — divide valor em N receitas mensais (contas a receber)
-- ---------------------------------------------------------------------
create or replace function public.gerar_parcelas(
  p_descricao text, p_valor_total numeric, p_parcelas int, p_primeiro_vencimento date,
  p_obra uuid default null, p_cliente uuid default null, p_contrato uuid default null,
  p_categoria text default 'Medição')
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  i int;
  v_base numeric;
  v_resto numeric;
begin
  if not public.is_gestor() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_parcelas < 1 or p_parcelas > 120 or p_valor_total <= 0 then
    raise exception 'Parâmetros de parcelamento inválidos.' using errcode = '22023';
  end if;
  v_base := trunc(p_valor_total / p_parcelas, 2);
  v_resto := p_valor_total - v_base * p_parcelas;
  for i in 1..p_parcelas loop
    insert into public.lancamentos (tipo, descricao, categoria, valor, vencimento, obra_id, cliente_id, contrato_id, parcela, total_parcelas)
    values ('receita', p_descricao || ' (' || i || '/' || p_parcelas || ')', p_categoria,
            v_base + case when i = p_parcelas then v_resto else 0 end,
            (p_primeiro_vencimento + make_interval(months => i - 1))::date,
            p_obra, p_cliente, p_contrato, i, p_parcelas);
  end loop;
  return p_parcelas;
end $$;

-- ---------------------------------------------------------------------
-- busca_global — barra "Buscar obras, clientes, tarefas, orçamentos…"
-- (respeita RLS: cada papel só encontra o que pode ver)
-- ---------------------------------------------------------------------
create or replace function public.busca_global(p_termo text)
returns table (tipo text, id uuid, titulo text, subtitulo text)
language sql stable security invoker set search_path = '' as $$
  with t as (select '%' || lower(trim(p_termo)) || '%' as q)
  (select 'obra', o.id, o.nome, coalesce(o.endereco, '') from public.obras o, t where lower(o.nome) like t.q or lower(coalesce(o.endereco,'')) like t.q limit 6)
  union all
  (select 'cliente', c.id, c.nome, coalesce(c.email, c.telefone, '') from public.clientes c, t where lower(c.nome) like t.q or coalesce(c.documento,'') like t.q limit 6)
  union all
  (select 'tarefa', ta.id, ta.titulo, coalesce(ta.prazo::text, '') from public.tarefas ta, t where lower(ta.titulo) like t.q limit 6)
  union all
  (select 'orcamento', oc.id, 'Orçamento Nº ' || lpad(oc.numero::text, 5, '0'), oc.titulo from public.orcamentos oc, t where lower(oc.titulo) like t.q or oc.numero::text like t.q limit 6)
$$;

-- Apenas usuários autenticados executam RPCs
do $$
declare f text;
begin
  foreach f in array array[
    'dashboard_resumo(date,date)','receitas_gastos_mensal(integer)','saldo_diario(date,date)',
    'obra_financeiro(uuid)','aprovar_orcamento(uuid,boolean)','duplicar_orcamento(uuid)',
    'gerar_parcelas(text,numeric,integer,date,uuid,uuid,uuid,text)','busca_global(text)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
