/** Converte erros técnicos (Supabase/Postgres/rede) em mensagens claras em português. */
export function friendlyError(err: unknown, fallback = "Não foi possível concluir a operação. Tente novamente."): string {
  const e = err as { message?: string; code?: string; status?: number; name?: string } | null;
  const msg = (e?.message ?? String(err ?? "")).toString();
  const low = msg.toLowerCase();

  if (!navigator.onLine || low.includes("failed to fetch") || low.includes("networkerror") || low.includes("load failed"))
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  if (low.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (low.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (low.includes("user is banned") || low.includes("banned")) return "Seu acesso está desativado. Procure o administrador.";
  if (low.includes("rate limit") || e?.status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (low.includes("jwt expired") || low.includes("refresh token")) return "Sua sessão expirou. Faça login novamente.";
  if (low.includes("new password should be different")) return "A nova senha deve ser diferente da anterior.";
  if (low.includes("password should be at least")) return "A senha não atende aos requisitos mínimos.";
  if (e?.code === "23505" || low.includes("duplicate key")) return "Já existe um registro com estes dados.";
  if (e?.code === "23503") return "Este registro está vinculado a outros dados e não pode ser removido.";
  if (e?.code === "23514" && msg && !low.includes("violates check")) return msg;
  if (e?.code === "23514") return "Algum valor informado é inválido. Revise os campos.";
  if (e?.code === "42501" || low.includes("row-level security") || low.includes("permission denied"))
    return /[áéíóúãõç]/i.test(msg) && !low.includes("row-level") ? msg : "Você não possui permissão para esta ação.";
  if (e?.code === "22023" || e?.code === "P0002") return msg;
  // mensagens já em português vindas das nossas funções
  if (/[áéíóúãõç]/i.test(msg) && msg.length < 200) return msg;
  return fallback;
}
