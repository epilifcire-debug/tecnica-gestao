-- =====================================================================
-- Eric como ADMINISTRADOR MASTER (primeiro admin, acesso total)
-- ---------------------------------------------------------------------
-- Caminho normal (nada a rodar aqui):
--   1. Rode as migrations.
--   2. Authentication → Users → Add user → Create new user
--        E-mail: o seu e-mail   Senha: a sua   ✔ Auto Confirm User
--   3. O PRIMEIRO usuário criado vira Administrador Master automaticamente.
--   4. Rode só o bloco "username" abaixo para entrar também como "eric".
--
-- Se outro usuário foi criado antes, rode o bloco "promover" abaixo.
-- Troque SEU_EMAIL pelo e-mail usado no passo 2. Rode no SQL Editor.
-- =====================================================================

-- username "eric" para entrar só com o usuário
update public.profiles
   set username = 'eric'
 where id = (select id from auth.users where lower(email) = lower('SEU_EMAIL'))
   and not exists (select 1 from public.profiles where username = 'eric');

-- promover a Administrador Master (o SQL Editor roda como service role: as travas de "último master" continuam valendo)
update public.user_roles
   set role = 'admin_master'
 where user_id = (select id from auth.users where lower(email) = lower('SEU_EMAIL'));

update public.profiles
   set ativo = true
 where id = (select id from auth.users where lower(email) = lower('SEU_EMAIL'));

-- conferência
select p.nome, p.username, p.email, r.role, p.ativo
  from public.profiles p join public.user_roles r on r.user_id = p.id
 order by (r.role = 'admin_master') desc, p.created_at;
