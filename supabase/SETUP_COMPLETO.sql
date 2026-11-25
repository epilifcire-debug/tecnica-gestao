-- =====================================================================
-- TÉCNICA ENGENHARIA — SETUP COMPLETO DO BANCO (v2.1.0)
-- Cole TUDO no Supabase → SQL Editor → Run (projeto novo, vazio).
-- Junta as 7 migrations de supabase/migrations/, na ordem.
-- =====================================================================

-- >>>>> 20261119000100_base_auth_perfis.sql
-- =====================================================================
-- TÉCNICA ENGENHARIA — GESTÃO DE OBRAS
-- 0001 · Base: extensões, enums, perfis, papéis e funções de autorização
-- =====================================================================
-- Papéis:
--   admin_master  → controle total (protegido contra remoção/rebaixamento)
--   administrador → operação completa, sem poder sobre o Admin Master
--   colaborador   → acesso às obras em que é membro/responsável
--   cliente       → Portal do Cliente (somente leitura das próprias obras)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin_master','administrador','colaborador','cliente');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Utilitário: updated_at
-- ---------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- CLIENTES (criada aqui porque perfis de "cliente" apontam para ela)
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  tipo_pessoa   text not null default 'PF' check (tipo_pessoa in ('PF','PJ')),
  nome          text not null check (length(trim(nome)) >= 2),
  documento     text,                       -- CPF/CNPJ (somente dígitos)
  email         text,
  telefone      text,
  endereco      text,
  cidade        text,
  uf            char(2),
  observacoes   text,
  ativo         boolean not null default true,
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists clientes_documento_uk on public.clientes (documento) where documento is not null and documento <> '';
create index if not exists clientes_nome_idx on public.clientes (lower(nome));
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- PERFIS (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default '',
  email       text not null,
  telefone    text,
  cargo       text,                         -- ex.: "Eng. Civil", "Mestre de obras"
  avatar_url  text,
  ativo       boolean not null default true,
  cliente_id  uuid references public.clientes(id) on delete set null, -- vínculo do perfil "cliente"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists profiles_email_uk on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- PAPÉIS (tabela separada: o usuário nunca altera o próprio papel)
-- Um papel por usuário.
-- ---------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        public.app_role not null default 'colaborador',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create index if not exists user_roles_role_idx on public.user_roles (role);

-- ---------------------------------------------------------------------
-- FUNÇÕES DE AUTORIZAÇÃO
-- SECURITY DEFINER apenas para ler papel/status sem recursão de RLS.
-- search_path vazio + nomes qualificados.
-- Usuário INATIVO → papel nulo → todas as policies negam.
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = '' as $$
  select r.role
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
   where r.user_id = auth.uid()
     and p.ativo = true
$$;

create or replace function public.is_master()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'admin_master', false)
$$;

create or replace function public.is_gestor()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('admin_master','administrador'), false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('admin_master','administrador','colaborador'), false)
$$;

create or replace function public.my_cliente_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.cliente_id
    from public.profiles p
    join public.user_roles r on r.user_id = p.id
   where p.id = auth.uid() and p.ativo = true and r.role = 'cliente'
$$;

-- Conversão segura de texto em uuid (usada nas policies de Storage)
create or replace function public.try_uuid(t text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------
-- NOVO USUÁRIO → cria perfil + papel
-- * Primeiro usuário do sistema vira admin_master (bootstrap seguro).
-- * Demais: papel vem de raw_app_meta_data.role (só o service role
--   consegue gravar app_metadata — o cliente não consegue forjar).
-- * Padrão: colaborador.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role;
  v_meta_role text := new.raw_app_meta_data ->> 'role';
  v_cliente uuid := public.try_uuid(new.raw_app_meta_data ->> 'cliente_id');
begin
  if not exists (select 1 from public.user_roles where role = 'admin_master') then
    v_role := 'admin_master';
  elsif v_meta_role in ('administrador','colaborador','cliente') then
    v_role := v_meta_role::public.app_role;
  else
    v_role := 'colaborador';
  end if;

  insert into public.profiles (id, nome, email, telefone, cargo, cliente_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone',''), '\D', '', 'g'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'cargo'), ''),
    case when v_role = 'cliente' then v_cliente end
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, v_role)
  on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- E-mail alterado no Auth → reflete no perfil
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- PROTEÇÃO DO ADMIN MASTER
-- * Nunca deixar o sistema sem admin_master ativo.
-- * Só admin_master concede/retira admin_master ou administrador.
-- * Administrador comum não altera dados de um admin_master.
-- (auth.uid() nulo = service role / migração: só a regra do "último master" vale)
-- ---------------------------------------------------------------------
create or replace function public.tg_protect_roles()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := auth.uid();
  v_caller_role public.app_role;
  v_restantes int;
begin
  if v_caller is not null then
    select role into v_caller_role from public.user_roles where user_id = v_caller;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := v_caller;
    -- ninguém altera o próprio papel
    if v_caller is not null and new.user_id = v_caller and new.role is distinct from old.role then
      raise exception 'Você não pode alterar o seu próprio perfil de acesso.' using errcode = '42501';
    end if;
    -- papéis administrativos só pelo master
    if v_caller is not null
       and (old.role in ('admin_master','administrador') or new.role in ('admin_master','administrador'))
       and coalesce(v_caller_role::text,'') <> 'admin_master' then
      raise exception 'Somente o Administrador Master pode alterar perfis administrativos.' using errcode = '42501';
    end if;
    -- último master
    if old.role = 'admin_master' and new.role <> 'admin_master' then
      select count(*) into v_restantes
        from public.user_roles r join public.profiles p on p.id = r.user_id
       where r.role = 'admin_master' and p.ativo and r.user_id <> old.user_id;
      if v_restantes = 0 then
        raise exception 'O sistema precisa manter ao menos um Administrador Master ativo.' using errcode = '42501';
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.role = 'admin_master' then
      select count(*) into v_restantes
        from public.user_roles r join public.profiles p on p.id = r.user_id
       where r.role = 'admin_master' and p.ativo and r.user_id <> old.user_id;
      if v_restantes = 0 then
        raise exception 'O sistema precisa manter ao menos um Administrador Master ativo.' using errcode = '42501';
      end if;
    end if;
    return old;
  end if;
  return new;
end $$;

create trigger user_roles_protect
  before update or delete on public.user_roles
  for each row execute function public.tg_protect_roles();

-- Campos sensíveis do perfil: ativo, cliente_id e email só mudam por gestor;
-- admin_master só é alterado por admin_master; master não pode ser desativado
-- se for o último.
create or replace function public.tg_protect_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := auth.uid();
  v_caller_role public.app_role;
  v_target_role public.app_role;
  v_restantes int;
begin
  if v_caller is null then
    -- service role: aplica só a regra do último master
    null;
  else
    select role into v_caller_role from public.user_roles where user_id = v_caller;
    select role into v_target_role from public.user_roles where user_id = new.id;

    if v_caller_role is null or (v_caller_role not in ('admin_master','administrador') and v_caller <> new.id) then
      raise exception 'Sem permissão para alterar este perfil.' using errcode = '42501';
    end if;

    if v_caller_role not in ('admin_master','administrador') then
      -- usuário comum editando o próprio perfil
      if new.ativo is distinct from old.ativo
         or new.cliente_id is distinct from old.cliente_id
         or (new.email is distinct from old.email
             and new.email is distinct from (select lower(u.email) from auth.users u where u.id = new.id)) then
        raise exception 'Você não pode alterar estes campos.' using errcode = '42501';
      end if;
    end if;

    if v_target_role = 'admin_master' and v_caller_role <> 'admin_master' then
      raise exception 'Somente o Administrador Master pode alterar outro Administrador Master.' using errcode = '42501';
    end if;

    if new.id = v_caller and new.ativo = false then
      raise exception 'Você não pode desativar a sua própria conta.' using errcode = '42501';
    end if;
  end if;

  if old.ativo and not new.ativo then
    select role into v_target_role from public.user_roles where user_id = new.id;
    if v_target_role = 'admin_master' then
      select count(*) into v_restantes
        from public.user_roles r join public.profiles p on p.id = r.user_id
       where r.role = 'admin_master' and p.ativo and r.user_id <> new.id;
      if v_restantes = 0 then
        raise exception 'O sistema precisa manter ao menos um Administrador Master ativo.' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end $$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.tg_protect_profiles();

-- ---------------------------------------------------------------------
-- CONFIGURAÇÕES DA EMPRESA (linha única)
-- Assinatura EFCsys: somente admin_master altera (trigger abaixo).
-- ---------------------------------------------------------------------
create table if not exists public.empresa_config (
  id                   boolean primary key default true check (id),
  razao_social         text not null default 'Técnica Engenharia',
  nome_fantasia        text not null default 'Técnica Engenharia',
  cnpj                 text,
  email                text,
  telefone             text,
  endereco             text,
  cidade               text default 'Aracaju',
  uf                   char(2) default 'SE',
  logo_url             text,
  slogan               text default 'Gestão de Obras',
  rodape_documentos    text,                 -- texto padrão em PDFs (orçamento, RDO)
  assinatura_visivel   boolean not null default true,
  assinatura_texto     text not null default 'by: efcsys',
  assinatura_link      text default 'https://efcsys.com',
  assinatura_logo_url  text,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id) on delete set null
);
insert into public.empresa_config (id) values (true) on conflict do nothing;

create or replace function public.tg_empresa_config_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if auth.uid() is not null and not public.is_master() then
    if new.assinatura_visivel is distinct from old.assinatura_visivel
       or new.assinatura_texto is distinct from old.assinatura_texto
       or new.assinatura_link is distinct from old.assinatura_link
       or new.assinatura_logo_url is distinct from old.assinatura_logo_url then
      raise exception 'Somente o Administrador Master altera a assinatura EFCsys.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger empresa_config_guard
  before update on public.empresa_config
  for each row execute function public.tg_empresa_config_guard();

-- >>>>> 20261119000200_cadastros_obras.sql
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

-- >>>>> 20261119000300_comercial_financeiro.sql
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

-- >>>>> 20261119000400_rls.sql
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

-- >>>>> 20261119000500_rpc_dashboard.sql
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

-- >>>>> 20261119000600_storage_auditoria.sql
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

-- >>>>> 20261124000700_login_usuario.sql
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
