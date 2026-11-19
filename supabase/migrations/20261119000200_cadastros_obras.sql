-- =====================================================================
-- 0002 · Cadastros (fornecedores, equipe, materiais) e núcleo de Obras
-- =====================================================================

do $$ begin
  create type public.obra_status as enum ('orcamento','planejamento','em_andamento','pausada','concluida','cancelada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.etapa_status as enum ('nao_iniciada','em_andamento','concluida','atrasada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.tarefa_status as enum ('pendente','em_andamento','concluida','cancelada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.prioridade as enum ('baixa','media','alta','urgente');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.clima as enum ('ensolarado','nublado','chuvoso','chuva_forte','instavel');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- FORNECEDORES
-- ---------------------------------------------------------------------
create table if not exists public.fornecedores (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) >= 2),
  documento   text,
  categoria   text,                       -- ex.: "Cimento", "Elétrica", "Locação"
  contato     text,
  telefone    text,
  email       text,
  endereco    text,
  observacoes text,
  ativo       boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists fornecedores_documento_uk on public.fornecedores (documento) where documento is not null and documento <> '';
create trigger fornecedores_updated_at before update on public.fornecedores
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- EQUIPE / FUNCIONÁRIOS (podem ou não ter login)
-- ---------------------------------------------------------------------
create table if not exists public.funcionarios (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) >= 2),
  funcao        text not null default 'Servente',   -- Pedreiro, Eletricista, Engenheiro…
  cpf           text,
  telefone      text,
  email         text,
  diaria        numeric(12,2) check (diaria is null or diaria >= 0),
  data_admissao date,
  user_id       uuid unique references public.profiles(id) on delete set null, -- se tiver acesso ao sistema
  ativo         boolean not null default true,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists funcionarios_cpf_uk on public.funcionarios (cpf) where cpf is not null and cpf <> '';
create trigger funcionarios_updated_at before update on public.funcionarios
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- MATERIAIS (estoque)
-- ---------------------------------------------------------------------
create table if not exists public.materiais (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) >= 2),
  unidade         text not null default 'un',      -- un, m², m³, kg, saco, m…
  categoria       text,
  estoque_atual   numeric(14,3) not null default 0,
  estoque_minimo  numeric(14,3) not null default 0 check (estoque_minimo >= 0),
  custo_unitario  numeric(12,2) check (custo_unitario is null or custo_unitario >= 0),
  fornecedor_id   uuid references public.fornecedores(id) on delete set null,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists materiais_nome_uk on public.materiais (lower(nome), unidade);
create trigger materiais_updated_at before update on public.materiais
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- OBRAS
-- ---------------------------------------------------------------------
create table if not exists public.obras (
  id                uuid primary key default gen_random_uuid(),
  codigo            bigint generated always as identity unique,
  nome              text not null check (length(trim(nome)) >= 2),
  cliente_id        uuid references public.clientes(id) on delete restrict,
  responsavel_id    uuid references public.profiles(id) on delete set null,   -- engenheiro responsável
  tipo              text not null default 'Residencial',                  -- Residencial, Comercial, Reforma…
  status            public.obra_status not null default 'planejamento',
  endereco          text,
  cidade            text,
  uf                char(2),
  area_m2           numeric(12,2) check (area_m2 is null or area_m2 > 0),
  data_inicio       date,
  previsao_termino  date,
  data_conclusao    date,
  valor_contratado  numeric(14,2) not null default 0 check (valor_contratado >= 0),
  progresso         numeric(5,2) not null default 0 check (progresso between 0 and 100),
  capa_path         text,              -- caminho no bucket "obras"
  descricao         text,
  created_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint obras_datas_ck check (previsao_termino is null or data_inicio is null or previsao_termino >= data_inicio)
);
create index if not exists obras_cliente_idx on public.obras (cliente_id);
create index if not exists obras_status_idx on public.obras (status);
create index if not exists obras_responsavel_idx on public.obras (responsavel_id);
create trigger obras_updated_at before update on public.obras
  for each row execute function public.tg_set_updated_at();

-- Usuários com acesso à obra (colaboradores)
create table if not exists public.obra_usuarios (
  obra_id    uuid not null references public.obras(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  papel      text not null default 'membro',     -- membro, encarregado, fiscal
  created_at timestamptz not null default now(),
  primary key (obra_id, user_id)
);
create index if not exists obra_usuarios_user_idx on public.obra_usuarios (user_id);

-- Equipe alocada (funcionários, com ou sem login)
create table if not exists public.obra_equipe (
  obra_id        uuid not null references public.obras(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  funcao_na_obra text,
  inicio         date,
  fim            date,
  created_at     timestamptz not null default now(),
  primary key (obra_id, funcionario_id)
);

-- ---------------------------------------------------------------------
-- Funções de acesso por obra (dependem de obras/obra_usuarios)
-- ---------------------------------------------------------------------
create or replace function public.can_access_obra(p_obra uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.current_app_role()
    when 'admin_master'  then true
    when 'administrador' then true
    when 'colaborador'   then exists (
        select 1 from public.obras o
         where o.id = p_obra
           and (o.responsavel_id = auth.uid()
                or exists (select 1 from public.obra_usuarios u where u.obra_id = o.id and u.user_id = auth.uid())))
    when 'cliente'       then exists (
        select 1 from public.obras o
         where o.id = p_obra and o.cliente_id is not null and o.cliente_id = public.my_cliente_id())
    else false
  end
$$;

-- Edição do conteúdo operacional da obra (RDO, fotos, tarefas, etapas…)
create or replace function public.can_edit_obra(p_obra uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_gestor()
      or (public.current_app_role() = 'colaborador' and public.can_access_obra(p_obra))
$$;

-- ---------------------------------------------------------------------
-- CRONOGRAMA (etapas)
-- progresso da obra = média ponderada (peso) do percentual das etapas
-- ---------------------------------------------------------------------
create table if not exists public.obra_etapas (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid not null references public.obras(id) on delete cascade,
  nome             text not null,
  ordem            int not null default 0,
  peso             numeric(6,2) not null default 1 check (peso > 0),
  inicio_previsto  date,
  fim_previsto     date,
  inicio_real      date,
  fim_real         date,
  percentual       numeric(5,2) not null default 0 check (percentual between 0 and 100),
  status           public.etapa_status not null default 'nao_iniciada',
  observacoes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists obra_etapas_obra_idx on public.obra_etapas (obra_id, ordem);
create trigger obra_etapas_updated_at before update on public.obra_etapas
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_etapa_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.percentual >= 100 then
    new.status := 'concluida';
    new.fim_real := coalesce(new.fim_real, current_date);
  elsif new.percentual > 0 then
    new.status := case when new.fim_previsto is not null and new.fim_previsto < current_date then 'atrasada' else 'em_andamento' end;
    new.inicio_real := coalesce(new.inicio_real, current_date);
  else
    new.status := case when new.inicio_previsto is not null and new.inicio_previsto < current_date then 'atrasada' else 'nao_iniciada' end;
  end if;
  return new;
end $$;
create trigger obra_etapas_status before insert or update of percentual, fim_previsto, inicio_previsto on public.obra_etapas
  for each row execute function public.tg_etapa_status();

create or replace function public.recalcular_progresso_obra(p_obra uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.obras o
     set progresso = coalesce((
           select round(sum(e.percentual * e.peso) / nullif(sum(e.peso),0), 2)
             from public.obra_etapas e where e.obra_id = p_obra), 0)
   where o.id = p_obra;
end $$;
revoke execute on function public.recalcular_progresso_obra(uuid) from public, anon, authenticated;

create or replace function public.tg_etapas_progresso()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_progresso_obra(coalesce(new.obra_id, old.obra_id));
  if tg_op = 'UPDATE' and new.obra_id is distinct from old.obra_id then
    perform public.recalcular_progresso_obra(old.obra_id);
  end if;
  return null;
end $$;
create trigger obra_etapas_progresso after insert or update or delete on public.obra_etapas
  for each row execute function public.tg_etapas_progresso();

-- ---------------------------------------------------------------------
-- RDO — Relatório Diário de Obra (um por obra/dia)
-- ---------------------------------------------------------------------
create table if not exists public.rdos (
  id                  uuid primary key default gen_random_uuid(),
  obra_id             uuid not null references public.obras(id) on delete cascade,
  data                date not null default current_date,
  clima_manha         public.clima,
  clima_tarde         public.clima,
  equipe              text,            -- "2 Pedreiros, 1 Servente, 1 Eletricista"
  efetivo_total       int check (efetivo_total is null or efetivo_total >= 0),
  servicos_executados text,
  ocorrencias         text,
  observacoes         text,
  visivel_cliente     boolean not null default true,
  autor_id            uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (obra_id, data)
);
create index if not exists rdos_obra_data_idx on public.rdos (obra_id, data desc);
create trigger rdos_updated_at before update on public.rdos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- FOTOS DA OBRA (arquivo no bucket privado "obras": {obra_id}/fotos/…)
-- ---------------------------------------------------------------------
create table if not exists public.obra_fotos (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid not null references public.obras(id) on delete cascade,
  rdo_id           uuid references public.rdos(id) on delete set null,
  storage_path     text not null unique,
  legenda          text,
  data             date not null default current_date,
  visivel_cliente  boolean not null default true,
  autor_id         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  constraint obra_fotos_path_ck check (storage_path like obra_id::text || '/%')
);
create index if not exists obra_fotos_obra_idx on public.obra_fotos (obra_id, data desc);

-- ---------------------------------------------------------------------
-- DOCUMENTOS (contratos digitalizados, projetos, ARTs, alvarás…)
-- obra_id nulo = documento geral da empresa (só staff)
-- ---------------------------------------------------------------------
create table if not exists public.documentos (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid references public.obras(id) on delete cascade,
  nome             text not null,
  categoria        text not null default 'Outros',  -- Projeto, Contrato, ART, Alvará, Nota fiscal, Outros
  storage_path     text not null unique,
  mime_type        text,
  tamanho_bytes    bigint check (tamanho_bytes is null or tamanho_bytes >= 0),
  visivel_cliente  boolean not null default false,
  autor_id         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);
create index if not exists documentos_obra_idx on public.documentos (obra_id, created_at desc);

-- ---------------------------------------------------------------------
-- TAREFAS
-- ---------------------------------------------------------------------
create table if not exists public.tarefas (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid references public.obras(id) on delete cascade,
  titulo          text not null check (length(trim(titulo)) >= 2),
  descricao       text,
  responsavel_id  uuid references public.profiles(id) on delete set null,
  prazo           date,
  status          public.tarefa_status not null default 'pendente',
  prioridade      public.prioridade not null default 'media',
  concluida_em    timestamptz,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists tarefas_obra_idx on public.tarefas (obra_id);
create index if not exists tarefas_resp_idx on public.tarefas (responsavel_id, status);
create index if not exists tarefas_prazo_idx on public.tarefas (prazo) where status in ('pendente','em_andamento');
create trigger tarefas_updated_at before update on public.tarefas
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_tarefa_conclusao()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status <> 'concluida') then
    new.concluida_em := now();
  elsif new.status <> 'concluida' then
    new.concluida_em := null;
  end if;
  return new;
end $$;
create trigger tarefas_conclusao before insert or update of status on public.tarefas
  for each row execute function public.tg_tarefa_conclusao();
