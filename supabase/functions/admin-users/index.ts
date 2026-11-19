// =====================================================================
// Edge Function: admin-users
// Gestão de usuários com privilégio de service role (server-side).
//   POST { action: "create" | "update" | "set_active" | "reset_password", ... }
// Regras:
//   • quem chama precisa estar autenticado, ATIVO e ser admin_master/administrador
//   • só admin_master cria/edita perfis administrativos (admin_master/administrador)
//   • administrador gerencia apenas colaborador e cliente
//   • ninguém altera o próprio papel nem desativa a si mesmo
//   • o banco ainda garante "ao menos um admin_master ativo"
// Segredos: SUPABASE_SERVICE_ROLE_KEY fica só aqui (nunca no frontend).
// =====================================================================
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Role = "admin_master" | "administrador" | "colaborador" | "cliente";
const ROLES: Role[] = ["admin_master", "administrador", "colaborador", "cliente"];
const ADMIN_ROLES: Role[] = ["admin_master", "administrador"];

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const onlyDigits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");
const str = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function assertRole(v: unknown): Role {
  if (typeof v !== "string" || !ROLES.includes(v as Role)) throw new HttpError(400, "Perfil de acesso inválido.");
  return v as Role;
}

async function getRole(admin: SupabaseClient, userId: string): Promise<Role | null> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return (data?.role as Role) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Método não permitido." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = Deno.env.get("APP_URL") ?? "";

  try {
    // ---- identidade de quem chama (token validado pelo Auth)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) throw new HttpError(401, "Sessão expirada. Faça login novamente.");
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) throw new HttpError(401, "Sessão expirada. Faça login novamente.");

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: callerProfile } = await admin.from("profiles").select("ativo").eq("id", caller.id).maybeSingle();
    const callerRole = await getRole(admin, caller.id);
    if (!callerProfile?.ativo || !callerRole || !ADMIN_ROLES.includes(callerRole)) {
      throw new HttpError(403, "Você não possui permissão para gerenciar usuários.");
    }
    const isMaster = callerRole === "admin_master";

    const body = await req.json().catch(() => { throw new HttpError(400, "Requisição inválida."); });
    const action = body?.action;

    // Pode o chamador gerenciar um usuário com este papel?
    const canManage = (role: Role | null) => isMaster || (role !== null && !ADMIN_ROLES.includes(role));

    // =================================================================
    if (action === "create") {
      const nome = str(body.nome);
      const email = str(body.email, 254).toLowerCase();
      const telefone = onlyDigits(body.telefone);
      const cargo = str(body.cargo, 80) || null;
      const role = assertRole(body.role ?? "colaborador");
      const clienteId = role === "cliente" ? str(body.cliente_id, 36) || null : null;
      const senha = typeof body.senha_provisoria === "string" ? body.senha_provisoria : "";

      if (nome.length < 3) throw new HttpError(400, "Informe o nome completo.");
      if (!EMAIL_RE.test(email)) throw new HttpError(400, "Informe um e-mail válido.");
      if (telefone && (telefone.length < 10 || telefone.length > 11)) throw new HttpError(400, "Telefone inválido. Use (99) 99999-9999.");
      if (!canManage(role)) throw new HttpError(403, "Somente o Administrador Master pode criar perfis administrativos.");
      if (role === "cliente" && !clienteId) throw new HttpError(400, "Selecione o cliente vinculado a este acesso.");
      if (senha && senha.length < 8) throw new HttpError(400, "A senha provisória deve ter ao menos 8 caracteres.");

      const { data: dup } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
      if (dup) throw new HttpError(409, "Já existe um usuário com este e-mail.");

      const meta = { nome, telefone, cargo };
      let newUserId: string;
      if (senha) {
        const { data, error } = await admin.auth.admin.createUser({
          email, password: senha, email_confirm: true, user_metadata: meta, app_metadata: { role, cliente_id: clienteId },
        });
        if (error || !data.user) throw new HttpError(400, "Não foi possível criar o usuário.");
        newUserId = data.user.id;
      } else {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: meta, redirectTo: appUrl ? `${appUrl}/nova-senha` : undefined,
        });
        if (error || !data.user) {
          throw new HttpError(400, "Não foi possível enviar o convite. Verifique o e-mail ou informe uma senha provisória.");
        }
        newUserId = data.user.id;
      }

      // Garante papel e vínculo (o convite não aceita app_metadata)
      const { error: roleErr } = await admin.from("user_roles").upsert({ user_id: newUserId, role, updated_by: caller.id });
      if (roleErr) throw new HttpError(400, "Usuário criado, mas não foi possível definir o perfil de acesso.");
      await admin.from("profiles").update({ nome, telefone: telefone || null, cargo, cliente_id: clienteId, ativo: body.ativo !== false })
        .eq("id", newUserId);
      if (body.ativo === false) await admin.auth.admin.updateUserById(newUserId, { ban_duration: "876000h" });

      return json(req, 200, { ok: true, user_id: newUserId, convite_enviado: !senha });
    }

    // =================================================================
    if (action === "update") {
      const userId = str(body.user_id, 36);
      if (!userId) throw new HttpError(400, "Usuário não informado.");
      const targetRole = await getRole(admin, userId);
      if (!targetRole) throw new HttpError(404, "Usuário não encontrado.");
      if (!canManage(targetRole)) throw new HttpError(403, "Você não pode alterar este usuário.");

      const patch: Record<string, unknown> = {};
      if (body.nome !== undefined) {
        const nome = str(body.nome);
        if (nome.length < 3) throw new HttpError(400, "Informe o nome completo.");
        patch.nome = nome;
      }
      if (body.telefone !== undefined) {
        const t = onlyDigits(body.telefone);
        if (t && (t.length < 10 || t.length > 11)) throw new HttpError(400, "Telefone inválido. Use (99) 99999-9999.");
        patch.telefone = t || null;
      }
      if (body.cargo !== undefined) patch.cargo = str(body.cargo, 80) || null;

      if (body.role !== undefined) {
        const newRole = assertRole(body.role);
        if (userId === caller.id && newRole !== targetRole) throw new HttpError(403, "Você não pode alterar o seu próprio perfil de acesso.");
        if (!canManage(newRole)) throw new HttpError(403, "Somente o Administrador Master pode conceder perfis administrativos.");
        if (newRole !== targetRole) {
          const { error } = await admin.from("user_roles").update({ role: newRole, updated_by: caller.id }).eq("user_id", userId);
          if (error) throw new HttpError(400, error.message.includes("Administrador Master") ? error.message : "Não foi possível alterar o perfil de acesso.");
          await admin.auth.admin.updateUserById(userId, { app_metadata: { role: newRole } });
        }
        patch.cliente_id = newRole === "cliente" ? (str(body.cliente_id, 36) || null) : null;
        if (newRole === "cliente" && !patch.cliente_id) throw new HttpError(400, "Selecione o cliente vinculado a este acesso.");
      } else if (body.cliente_id !== undefined && targetRole === "cliente") {
        patch.cliente_id = str(body.cliente_id, 36) || null;
      }

      if (Object.keys(patch).length) {
        const { error } = await admin.from("profiles").update(patch).eq("id", userId);
        if (error) throw new HttpError(400, "Não foi possível salvar as alterações.");
      }
      return json(req, 200, { ok: true });
    }

    // =================================================================
    if (action === "set_active") {
      const userId = str(body.user_id, 36);
      const ativo = body.ativo === true;
      if (!userId) throw new HttpError(400, "Usuário não informado.");
      if (userId === caller.id) throw new HttpError(403, "Você não pode desativar a sua própria conta.");
      const targetRole = await getRole(admin, userId);
      if (!targetRole) throw new HttpError(404, "Usuário não encontrado.");
      if (!canManage(targetRole)) throw new HttpError(403, "Você não pode alterar este usuário.");

      const { error } = await admin.from("profiles").update({ ativo }).eq("id", userId);
      if (error) {
        throw new HttpError(400, error.message.includes("Administrador Master") ? error.message : "Não foi possível alterar o status.");
      }
      // Bloqueio real no Auth: impede login e renovação de token
      await admin.auth.admin.updateUserById(userId, { ban_duration: ativo ? "none" : "876000h" });
      return json(req, 200, { ok: true });
    }

    // =================================================================
    if (action === "reset_password") {
      const userId = str(body.user_id, 36);
      const targetRole = await getRole(admin, userId);
      if (!targetRole) throw new HttpError(404, "Usuário não encontrado.");
      if (!canManage(targetRole)) throw new HttpError(403, "Você não pode alterar este usuário.");
      const { data: p } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
      if (!p?.email) throw new HttpError(404, "Usuário não encontrado.");
      const { error } = await userClient.auth.resetPasswordForEmail(p.email, {
        redirectTo: appUrl ? `${appUrl}/nova-senha` : undefined,
      });
      if (error) throw new HttpError(400, "Não foi possível enviar o e-mail de redefinição.");
      return json(req, 200, { ok: true });
    }

    throw new HttpError(400, "Ação inválida.");
  } catch (e) {
    if (e instanceof HttpError) return json(req, e.status, { error: e.message });
    console.error("admin-users:", e instanceof Error ? e.message : e);
    return json(req, 500, { error: "Erro inesperado. Tente novamente." });
  }
});
