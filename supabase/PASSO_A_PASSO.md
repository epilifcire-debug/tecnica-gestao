# Supabase — Técnica Engenharia (passo a passo)

Arquivos que você vai usar (todos nesta pasta `supabase/`):
| Arquivo | Onde usar |
|---|---|
| `SETUP_COMPLETO.sql` | SQL Editor — cria todo o banco |
| `sql/01_eric_admin_master.sql` | SQL Editor — login `eric` + garante Admin Master |
| `functions/admin-users/index.ts` | Edge Functions — gestão de usuários |

## 1. Criar o projeto
supabase.com → **New project** → região **South America (São Paulo)**. Guarde a senha do banco.

## 2. Banco
**SQL Editor → New query** → cole todo o `SETUP_COMPLETO.sql` → **Run**. Deve terminar sem erro.

## 3. Autenticação
**Authentication → Sign In / Providers → Email**:
- desligue **Allow new users to sign up**
- desligue **Confirm email**

**Authentication → URL Configuration**:
- Site URL: endereço do app (ex.: `https://tecnica.efcsys.com`)
- Redirect URLs: `https://tecnica.efcsys.com/nova-senha`

## 4. Seu usuário (Admin Master)
**Authentication → Users → Add user → Create new user**: seu e-mail + senha, marque **Auto Confirm User**.
O primeiro usuário vira **Administrador Master** sozinho.
Depois, no SQL Editor, rode `sql/01_eric_admin_master.sql` trocando `SEU_EMAIL` pelo seu e-mail → libera o login `eric`.

## 5. Edge Function `admin-users`
Pelo painel: **Edge Functions → Deploy a new function → Via editor** → nome `admin-users` → cole o `functions/admin-users/index.ts` → **Deploy**. Deixe **Verify JWT** ligado.
**Edge Functions → Secrets** → adicione:
- `APP_URL` = `https://tecnica.efcsys.com`
- `ALLOWED_ORIGINS` = `https://tecnica.efcsys.com`

## 6. Me envie
**Project Settings → API**: a **Project URL** e a chave **anon / public**.
Não envie a `service_role`.
