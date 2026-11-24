# Técnica Engenharia — Gestão de Obras · v2 (fora do Lovable)

Sistema de gestão de obras: obras, cronograma, RDO com PDF, fotos, tarefas, orçamentos (PDF/WhatsApp/e-mail/aprovação), contratos, financeiro (entradas, despesas, contas a receber/pagar, parcelas), vistorias, laudos, materiais/estoque, fornecedores, equipe, agenda, documentos, relatórios (CSV), usuários e Portal do Cliente.

**Login:** nome de usuário **ou** e-mail. E-mail é opcional no cadastro; quem não tem e-mail recebe senha provisória do administrador.

Stack: React 18 + Vite + TypeScript + Tailwind · Supabase (Postgres, Auth, RLS, Storage, Edge Functions, Realtime) · PWA instalável · padrão EFCsys (skills `efcsys-standard`, `supabase`, `ui-ux`, `pwa`, `security`, `testing`).

## Estrutura
```
supabase/
  migrations/   7 migrations — schema, RLS, RPC, triggers, storage, auditoria
  functions/admin-users/   Edge Function de gestão de usuários (service role só aqui)
  tests/        stub + 37 testes de permissão (rodam em Postgres local)
src/
  auth/         sessão, guards de rota, matriz de permissões
  data/         camada de dados (Supabase) + modo demonstração isolado
  components/   design system (UI, CRUD genérico, layout, ColorBends)
  pages/        telas (Dashboard, Obras, RDO, Orçamentos, Financeiro, Portal…)
docs/           arquitetura, permissões, rotas
```

## Passo a passo — Supabase (você executa)
1. Crie um projeto novo em supabase.com (região São Paulo).
2. **SQL Editor** → rode, na ordem, os 7 arquivos de `supabase/migrations/`.
   (ou, com o CLI: `supabase link --project-ref SEU_REF` e `supabase db push`)
3. **Authentication → Sign In / Providers**: desative *Allow new users to sign up* (contas só pelo admin) e desative *Confirm email* (ninguém precisa confirmar e-mail).
4. **Authentication → URL Configuration**: Site URL = endereço do app; Redirect URLs = `https://SEU-DOMINIO/nova-senha`.
5. **Authentication → Users → Add user** (marque *Auto Confirm User*): crie o usuário do Eric. O **primeiro usuário vira Administrador Master** automaticamente. Depois rode `supabase/sql/01_eric_admin_master.sql` (troque `SEU_EMAIL`) para o login `eric` funcionar — o mesmo arquivo promove o Eric a Master se alguém tiver sido criado antes.
6. Edge Function: `supabase functions deploy admin-users` e defina os secrets:
   `supabase secrets set APP_URL=https://SEU-DOMINIO ALLOWED_ORIGINS=https://SEU-DOMINIO`
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem nas functions.)
7. Copie `.env.example` → `.env` com a URL e a **anon key** (nunca a service role).

## Rodar / publicar
```bash
npm install
npm run dev          # desenvolvimento
npm run build        # produção (dist/) — PWA com service worker
npm run build:demo   # preview com dados fictícios (dist-demo/), sem Supabase
```
Shard Cloud / Docker:
```bash
docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... -t tecnica-gestao .
docker run -p 8080:80 tecnica-gestao
```

## Testar as permissões do banco (opcional)
Num Postgres 15+ descartável:
```bash
psql -d teste -f supabase/tests/00_stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -d teste -f "$f"; done
psql -d teste -f supabase/tests/01_rls_teste.sql   # 44 verificações → "TODOS OS TESTES PASSARAM"
```

Desenvolvido por EFCsys • Todos os direitos reservados.
