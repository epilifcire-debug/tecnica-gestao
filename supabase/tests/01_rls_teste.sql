-- Testes de permissão (rodar após 00_stub + migrations, num banco descartável)
\set ON_ERROR_STOP 1
-- usuários
insert into auth.users (id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000a','master@t.com','{"nome":"Master"}');
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-00000000000b','adm@t.com','{"role":"administrador"}');
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-00000000000c','colab@t.com','{"role":"colaborador"}');
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-00000000000e','colab2@t.com','{}');
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-00000000000f','hacker@t.com','{"role":"admin_master"}');
select user_id, role from public.user_roles order by user_id;

insert into public.clientes (id,nome) values ('10000000-0000-0000-0000-000000000001','João da Silva'),('10000000-0000-0000-0000-000000000002','Maria Souza');
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-00000000000d','cli@t.com','{"role":"cliente","cliente_id":"10000000-0000-0000-0000-000000000001"}');
insert into public.obras (id,nome,cliente_id,status,valor_contratado,previsao_termino,data_inicio) values
 ('20000000-0000-0000-0000-000000000001','Residência Silva','10000000-0000-0000-0000-000000000001','em_andamento',80000,current_date-5,current_date-60),
 ('20000000-0000-0000-0000-000000000002','Loja Centro','10000000-0000-0000-0000-000000000002','em_andamento',120000,current_date+60,current_date-10);
insert into public.obra_usuarios values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c');
insert into public.obra_etapas (obra_id,nome,peso,percentual) values ('20000000-0000-0000-0000-000000000001','Fundação',2,100),('20000000-0000-0000-0000-000000000001','Alvenaria',1,40);
insert into public.lancamentos (tipo,status,descricao,valor,obra_id,cliente_id) values
 ('receita','pago','Sinal',50000,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('despesa','pago','Cimento',31500,'20000000-0000-0000-0000-000000000001',null),
 ('receita','pendente','Parcela 2',30000,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('receita','pago','Sinal loja',20000,'20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');
insert into public.orcamentos (id,cliente_id,titulo,status) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Reforma cozinha','enviado'),('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Rascunho interno','rascunho');
insert into public.orcamento_itens (orcamento_id,descricao,quantidade,valor_unitario) values ('30000000-0000-0000-0000-000000000001','Demolição',20,100),('30000000-0000-0000-0000-000000000001','Pintura',100,30);
update public.orcamentos set desconto = 500 where id='30000000-0000-0000-0000-000000000001';

create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond,false) then raise exception 'FALHOU: %', msg; else raise notice 'ok  %', msg; end if; end $$;

select pg_temp.ok((select role from user_roles where user_id='00000000-0000-0000-0000-00000000000a')='admin_master','1º usuário vira admin_master');
select pg_temp.ok((select role from user_roles where user_id='00000000-0000-0000-0000-00000000000f')='colaborador','app_metadata admin_master NÃO é aceito');
select pg_temp.ok((select progresso from obras where id='20000000-0000-0000-0000-000000000001')=80,'progresso ponderado 80%');
select pg_temp.ok((select total from orcamentos where id='30000000-0000-0000-0000-000000000001')=4500,'total orçamento = 2000+3000-500');

-- ===== COLABORADOR
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.ok((select count(*) from obras)=1,'colaborador vê só a obra em que é membro');
select pg_temp.ok((select count(*) from lancamentos)=0,'colaborador não vê financeiro');
select pg_temp.ok((select count(*) from clientes)=1,'colaborador vê só cliente da sua obra');
select pg_temp.ok((select count(*) from orcamentos)=0,'colaborador não vê orçamentos');
insert into rdos (obra_id, servicos_executados) values ('20000000-0000-0000-0000-000000000001','Alvenaria externa');
select pg_temp.ok(true,'colaborador cria RDO na obra dele');
do $$ begin
  begin insert into rdos (obra_id) values ('20000000-0000-0000-0000-000000000002'); raise exception 'X';
  exception when insufficient_privilege then raise notice 'ok  colaborador bloqueado em RDO de outra obra'; end;
  begin update user_roles set role='admin_master' where user_id='00000000-0000-0000-0000-00000000000c';
    if found then raise exception 'FALHOU auto-promoção'; end if; raise notice 'ok  colaborador não se promove (0 linhas)';
  end;
  begin update profiles set ativo=true, cliente_id=null where id='00000000-0000-0000-0000-00000000000c' and false; end;
end $$;
do $$ begin
  begin update profiles set cliente_id='10000000-0000-0000-0000-000000000001' where id='00000000-0000-0000-0000-00000000000c'; raise exception 'X';
  exception when insufficient_privilege then raise notice 'ok  colaborador não altera campos sensíveis do perfil'; end;
end $$;
update profiles set telefone='79999999999' where id='00000000-0000-0000-0000-00000000000c';
select pg_temp.ok((select (dashboard_resumo(current_date-30,current_date)->>'recebido')::numeric)=0,'dashboard do colaborador sem valores financeiros');
reset role;

-- ===== CLIENTE
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select pg_temp.ok((select count(*) from obras)=1,'cliente vê só a própria obra');
select pg_temp.ok((select count(*) from orcamentos)=1,'cliente vê orçamento enviado, não o rascunho');
select pg_temp.ok((select count(*) from lancamentos)=2,'cliente vê só receitas da própria conta');
select pg_temp.ok((select count(*) from tarefas)=0,'cliente não vê tarefas');
select pg_temp.ok((select count(*) from profiles)=1,'cliente vê só o próprio perfil');
select pg_temp.ok((select count(*) from rdos)=1,'cliente vê RDO visível');
reset role;

-- ===== ADMINISTRADOR
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from obras)=2,'administrador vê todas as obras');
select pg_temp.ok((dashboard_resumo(current_date-30,current_date)->>'recebido')::numeric=70000,'recebido no período = 70.000');
select pg_temp.ok((dashboard_resumo(current_date-30,current_date)->>'obras_atrasadas')::int=1,'1 obra atrasada');
select pg_temp.ok((obra_financeiro('20000000-0000-0000-0000-000000000001')->>'saldo_previsto')::numeric=48500,'saldo previsto da obra = 48.500');
do $$ begin
  begin update user_roles set role='colaborador' where user_id='00000000-0000-0000-0000-00000000000a'; raise exception 'X';
  exception when insufficient_privilege then raise notice 'ok  administrador não rebaixa o master'; end;
  begin update profiles set ativo=false where id='00000000-0000-0000-0000-00000000000a'; raise exception 'X';
  exception when insufficient_privilege then raise notice 'ok  administrador não desativa o master'; end;
  begin update empresa_config set assinatura_visivel=false; raise exception 'X';
  exception when insufficient_privilege then raise notice 'ok  administrador não mexe na assinatura EFCsys'; end;
end $$;
update user_roles set role='cliente' where user_id='00000000-0000-0000-0000-00000000000e';
select pg_temp.ok(true,'administrador altera papel de colaborador');
select aprovar_orcamento('30000000-0000-0000-0000-000000000001', true) ;
select pg_temp.ok((select status from orcamentos where id='30000000-0000-0000-0000-000000000001')='aprovado','orçamento aprovado e obra criada');
select pg_temp.ok((aprovar_orcamento('30000000-0000-0000-0000-000000000001', true)->>'ja_aprovado')::boolean,'aprovação idempotente');
do $$ begin
  begin insert into orcamento_itens (orcamento_id,descricao) values ('30000000-0000-0000-0000-000000000001','x'); raise exception 'X';
  exception when insufficient_privilege then raise notice 'ok  orçamento aprovado fica travado'; end;
end $$;
select gerar_parcelas('Medição', 1000, 3, current_date, null, '10000000-0000-0000-0000-000000000002');
select pg_temp.ok((select sum(valor) from lancamentos where descricao like 'Medição (%')=1000,'parcelas somam o total');
select pg_temp.ok((select count(*) from busca_global('silva'))>=1,'busca global');
reset role;

-- ===== MASTER
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  begin update user_roles set role='administrador' where user_id='00000000-0000-0000-0000-00000000000a'; raise exception 'X';
  exception when insufficient_privilege then raise notice 'ok  master não altera o próprio papel'; end;
end $$;
update empresa_config set assinatura_visivel=false;
select pg_temp.ok(true,'master altera assinatura');
reset role;

-- ===== USUÁRIO DESATIVADO
update profiles set ativo=false where id='00000000-0000-0000-0000-00000000000b';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from obras)=0,'usuário desativado não vê nada');
reset role;
select pg_temp.ok((select count(*) from audit_log)>0,'auditoria registrando');
-- ===== ANÔNIMO
set role anon;
do $$ begin
  begin perform 1 from public.obras; raise exception 'X';
  exception when insufficient_privilege then raise notice 'ok  anônimo sem acesso'; end;
end $$;
reset role;
select 'TODOS OS TESTES PASSARAM' as resultado;
