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
