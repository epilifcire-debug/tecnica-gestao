-- =====================================================================
-- 0003 · Orçamentos, Contratos, Financeiro, Estoque, Vistorias, Laudos, Agenda
-- =====================================================================

do $$ begin
  create type public.orcamento_status as enum ('rascunho','enviado','aprovado','recusado','expirado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contrato_status as enum ('rascunho','vigente','concluido','cancelado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.lancamento_tipo as enum ('receita','despesa');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.lancamento_status as enum ('pendente','pago','cancelado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.movimento_tipo as enum ('entrada','saida','ajuste');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.vistoria_status as enum ('agendada','realizada','cancelada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.laudo_status as enum ('em_elaboracao','em_revisao','concluido','entregue');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.compromisso_tipo as enum ('visita_tecnica','reuniao','vistoria','entrega','acompanhamento','apresentacao','outro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- ORÇAMENTOS
-- ---------------------------------------------------------------------
create table if not exists public.orcamentos (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint generated always as identity unique,   -- exibido como 00034
  cliente_id     uuid not null references public.clientes(id) on delete restrict,
  obra_id        uuid references public.obras(id) on delete set null,
  titulo         text not null,
  status         public.orcamento_status not null default 'rascunho',
  data_emissao   date not null default current_date,
  validade       date,
  subtotal       numeric(14,2) not null default 0,
  desconto       numeric(14,2) not null default 0 check (desconto >= 0),
  total          numeric(14,2) not null default 0,
  condicoes      text,          -- forma de pagamento, prazo de execução…
  observacoes    text,
  enviado_em     timestamptz,
  aprovado_em    timestamptz,
  aprovado_por   uuid references auth.users(id) on delete set null,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint orcamentos_validade_ck check (validade is null or validade >= data_emissao)
);
create index if not exists orcamentos_cliente_idx on public.orcamentos (cliente_id);
create index if not exists orcamentos_status_idx on public.orcamentos (status);
create trigger orcamentos_updated_at before update on public.orcamentos
  for each row execute function public.tg_set_updated_at();

create table if not exists public.orcamento_itens (
  id              uuid primary key default gen_random_uuid(),
  orcamento_id    uuid not null references public.orcamentos(id) on delete cascade,
  ordem           int not null default 0,
  descricao       text not null,
  unidade         text not null default 'un',
  quantidade      numeric(14,3) not null default 1 check (quantidade > 0),
  valor_unitario  numeric(14,2) not null default 0 check (valor_unitario >= 0),
  subtotal        numeric(14,2) generated always as (round(quantidade * valor_unitario, 2)) stored,
  created_at      timestamptz not null default now()
);
create index if not exists orcamento_itens_orc_idx on public.orcamento_itens (orcamento_id, ordem);

-- Totais sempre calculados no banco
create or replace function public.recalcular_orcamento(p_orc uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.orcamentos o
     set subtotal = coalesce((select sum(i.subtotal) from public.orcamento_itens i where i.orcamento_id = p_orc), 0),
         total    = greatest(coalesce((select sum(i.subtotal) from public.orcamento_itens i where i.orcamento_id = p_orc), 0) - o.desconto, 0)
   where o.id = p_orc;
end $$;
revoke execute on function public.recalcular_orcamento(uuid) from public, anon, authenticated;

create or replace function public.tg_orc_itens_total()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_orcamento(coalesce(new.orcamento_id, old.orcamento_id));
  return null;
end $$;
create trigger orcamento_itens_total after insert or update or delete on public.orcamento_itens
  for each row execute function public.tg_orc_itens_total();

create or replace function public.tg_orc_desconto()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.total := greatest(new.subtotal - new.desconto, 0);
  if new.status = 'enviado' and (tg_op = 'INSERT' or old.status <> 'enviado') then
    new.enviado_em := coalesce(new.enviado_em, now());
  end if;
  return new;
end $$;
create trigger orcamentos_desconto before insert or update of desconto, subtotal, status on public.orcamentos
  for each row execute function public.tg_orc_desconto();

-- Orçamento aprovado/recusado fica bloqueado para edição de itens
create or replace function public.tg_orc_itens_lock()
returns trigger language plpgsql set search_path = '' as $$
declare v_status public.orcamento_status;
begin
  select status into v_status from public.orcamentos where id = coalesce(new.orcamento_id, old.orcamento_id);
  if v_status in ('aprovado','recusado') then
    raise exception 'Orçamento % não pode mais ser alterado.', v_status using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger orcamento_itens_lock before insert or update or delete on public.orcamento_itens
  for each row execute function public.tg_orc_itens_lock();

-- ---------------------------------------------------------------------
-- CONTRATOS
-- ---------------------------------------------------------------------
create table if not exists public.contratos (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity unique,
  cliente_id       uuid not null references public.clientes(id) on delete restrict,
  obra_id          uuid references public.obras(id) on delete set null,
  orcamento_id     uuid references public.orcamentos(id) on delete set null,
  objeto           text not null,
  valor            numeric(14,2) not null default 0 check (valor >= 0),
  data_assinatura  date,
  inicio_vigencia  date,
  fim_vigencia     date,
  status           public.contrato_status not null default 'rascunho',
  storage_path     text,          -- PDF assinado (bucket "documentos")
  observacoes      text,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists contratos_cliente_idx on public.contratos (cliente_id);
create trigger contratos_updated_at before update on public.contratos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- FINANCEIRO — lançamentos (receitas e despesas)
-- Recebido  = receitas pagas · Gastos = despesas pagas
-- A receber = receitas pendentes · A pagar = despesas pendentes
-- ---------------------------------------------------------------------
create table if not exists public.lancamentos (
  id               uuid primary key default gen_random_uuid(),
  tipo             public.lancamento_tipo not null,
  status           public.lancamento_status not null default 'pendente',
  descricao        text not null,
  categoria        text not null default 'Geral',  -- Mão de obra, Material, Medição, Sinal…
  valor            numeric(14,2) not null check (valor > 0),
  vencimento       date not null default current_date,
  pago_em          date,
  forma_pagamento  text,                           -- PIX, Boleto, Transferência…
  obra_id          uuid references public.obras(id) on delete set null,
  cliente_id       uuid references public.clientes(id) on delete set null,
  fornecedor_id    uuid references public.fornecedores(id) on delete set null,
  contrato_id      uuid references public.contratos(id) on delete set null,
  parcela          int check (parcela is null or parcela > 0),
  total_parcelas   int check (total_parcelas is null or total_parcelas > 0),
  observacoes      text,
  comprovante_path text,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lanc_pago_ck check ((status = 'pago') = (pago_em is not null))
);
create index if not exists lanc_tipo_status_idx on public.lancamentos (tipo, status);
create index if not exists lanc_pago_em_idx on public.lancamentos (pago_em) where status = 'pago';
create index if not exists lanc_venc_idx on public.lancamentos (vencimento) where status = 'pendente';
create index if not exists lanc_obra_idx on public.lancamentos (obra_id);
create trigger lancamentos_updated_at before update on public.lancamentos
  for each row execute function public.tg_set_updated_at();

-- Coerência status × data de pagamento
create or replace function public.tg_lanc_pagamento()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'pago' and new.pago_em is null then
    new.pago_em := current_date;
  elsif new.status <> 'pago' then
    new.pago_em := null;
  end if;
  return new;
end $$;
create trigger lancamentos_pagamento before insert or update of status, pago_em on public.lancamentos
  for each row execute function public.tg_lanc_pagamento();

-- ---------------------------------------------------------------------
-- ESTOQUE — movimentações (atualizam materiais.estoque_atual)
-- ---------------------------------------------------------------------
create table if not exists public.material_movimentos (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.materiais(id) on delete cascade,
  obra_id      uuid references public.obras(id) on delete set null,
  tipo         public.movimento_tipo not null,
  quantidade   numeric(14,3) not null check (quantidade <> 0),
  custo_unitario numeric(12,2),
  observacao   text,
  autor_id     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint mov_qtd_ck check (tipo = 'ajuste' or quantidade > 0)
);
create index if not exists mov_material_idx on public.material_movimentos (material_id, created_at desc);

create or replace function public.tg_movimento_estoque()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_delta numeric;
begin
  if tg_op = 'INSERT' then
    v_delta := case new.tipo when 'entrada' then new.quantidade when 'saida' then -new.quantidade else new.quantidade end;
    update public.materiais set estoque_atual = estoque_atual + v_delta where id = new.material_id;
    if (select estoque_atual from public.materiais where id = new.material_id) < 0 then
      raise exception 'Estoque insuficiente para esta saída.' using errcode = '23514';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    v_delta := case old.tipo when 'entrada' then -old.quantidade when 'saida' then old.quantidade else -old.quantidade end;
    update public.materiais set estoque_atual = estoque_atual + v_delta where id = old.material_id;
    return old;
  end if;
  return null;
end $$;
create trigger material_movimentos_estoque after insert or delete on public.material_movimentos
  for each row execute function public.tg_movimento_estoque();

-- Movimentos são imutáveis (corrige-se com novo movimento ou exclusão pelo gestor)
create or replace function public.tg_block_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Registro imutável. Exclua e lance novamente.' using errcode = '42501';
end $$;
create trigger material_movimentos_noupdate before update on public.material_movimentos
  for each row execute function public.tg_block_update();

-- ---------------------------------------------------------------------
-- VISTORIAS
-- ---------------------------------------------------------------------
create table if not exists public.vistorias (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid references public.obras(id) on delete set null,
  cliente_id      uuid references public.clientes(id) on delete set null,
  tipo            text not null default 'Vistoria técnica',  -- Entrega de chaves, Cautelar, Recebimento…
  endereco        text,
  data_agendada   timestamptz not null,
  responsavel_id  uuid references public.profiles(id) on delete set null,
  status          public.vistoria_status not null default 'agendada',
  realizada_em    timestamptz,
  checklist       jsonb not null default '[]'::jsonb,         -- [{item, ok, obs}]
  relatorio       text,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists vistorias_data_idx on public.vistorias (data_agendada);
create trigger vistorias_updated_at before update on public.vistorias
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- LAUDOS
-- ---------------------------------------------------------------------
create table if not exists public.laudos (
  id              uuid primary key default gen_random_uuid(),
  numero          bigint generated always as identity unique,
  obra_id         uuid references public.obras(id) on delete set null,
  cliente_id      uuid references public.clientes(id) on delete set null,
  vistoria_id     uuid references public.vistorias(id) on delete set null,
  tipo            text not null default 'Laudo de inspeção predial', -- Laudo elétrico, Parecer técnico…
  titulo          text not null,
  status          public.laudo_status not null default 'em_elaboracao',
  responsavel_id  uuid references public.profiles(id) on delete set null,
  art_numero      text,
  data_emissao    date,
  prazo_entrega   date,
  conteudo        text,
  conclusao       text,
  storage_path    text,
  visivel_cliente boolean not null default false,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists laudos_status_idx on public.laudos (status);
create trigger laudos_updated_at before update on public.laudos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- AGENDA / COMPROMISSOS
-- ---------------------------------------------------------------------
create table if not exists public.compromissos (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  tipo            public.compromisso_tipo not null default 'outro',
  inicio          timestamptz not null,
  fim             timestamptz,
  dia_inteiro     boolean not null default false,
  local           text,
  obra_id         uuid references public.obras(id) on delete cascade,
  cliente_id      uuid references public.clientes(id) on delete set null,
  responsavel_id  uuid references public.profiles(id) on delete set null default auth.uid(),
  observacoes     text,
  concluido       boolean not null default false,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint compromissos_fim_ck check (fim is null or fim >= inicio)
);
create index if not exists compromissos_inicio_idx on public.compromissos (inicio);
create trigger compromissos_updated_at before update on public.compromissos
  for each row execute function public.tg_set_updated_at();
