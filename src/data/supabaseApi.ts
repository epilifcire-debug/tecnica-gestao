import type { Api, ListOpts } from "./api";
import type { Role, Row } from "./types";
import { selectString } from "./schema";
import { supabase } from "@/lib/supabase";

function applyFilters(q: any, o: ListOpts = {}) {
  for (const [k, v] of Object.entries(o.eq ?? {})) q = q.eq(k, v);
  for (const [k, v] of Object.entries(o.neq ?? {})) q = q.neq(k, v);
  for (const [k, v] of Object.entries(o.in ?? {})) q = q.in(k, v);
  for (const [k, v] of Object.entries(o.gte ?? {})) q = q.gte(k, v);
  for (const [k, v] of Object.entries(o.lte ?? {})) q = q.lte(k, v);
  for (const [k, v] of Object.entries(o.lt ?? {})) q = q.lt(k, v);
  for (const k of o.isNull ?? []) q = q.is(k, null);
  if (o.search?.term.trim()) {
    const t = o.search.term.trim().replace(/[%,()]/g, " ");
    q = q.or(o.search.cols.map((c) => `${c}.ilike.%${t}%`).join(","));
  }
  for (const ord of o.order ?? []) q = q.order(ord.col, { ascending: ord.asc ?? true, nullsFirst: false });
  if (o.limit) q = q.limit(o.limit);
  return q;
}

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw res.error;
  return res.data;
}

export const supabaseApi: Api = {
  async list(table, opts) {
    const q = applyFilters(supabase().from(table).select(selectString(table, opts?.embed)), opts);
    return check(await q) as any[];
  },
  async get(table, id, embed, key = "id") {
    return check(await supabase().from(table).select(selectString(table, embed)).eq(key, id).maybeSingle()) as any;
  },
  async insert(table, row) {
    return check(await supabase().from(table).insert(row).select().single()) as any;
  },
  async update(table, id, patch, key = "id") {
    return check(await supabase().from(table).update(patch).eq(key, id).select().single()) as any;
  },
  async remove(table, id, key = "id") {
    const { error, count } = await supabase().from(table).delete({ count: "exact" }).eq(key, id);
    if (error) throw error;
    if (count === 0) throw Object.assign(new Error("Você não possui permissão para esta ação."), { code: "42501" });
  },
  async removeWhere(table, eq) {
    let q: any = supabase().from(table).delete();
    for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
  },
  async rpc(fn, args) {
    return check(await supabase().rpc(fn, args ?? {})) as any;
  },
  async invoke(fn, body) {
    const { data, error } = await supabase().functions.invoke(fn, { body });
    if (error) {
      // corpo da resposta traz a mensagem amigável
      const ctx: any = (error as any).context;
      try {
        const j = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
        if (j?.error) throw new Error(j.error);
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
      throw error;
    }
    return data as any;
  },

  async upload(bucket, path, file) {
    const { error } = await supabase().storage.from(bucket).upload(path, file, {
      upsert: false, contentType: (file as File).type || undefined, cacheControl: "3600",
    });
    if (error) throw error;
    return path;
  },
  async fileUrl(bucket, path) {
    if (bucket === "avatars" || bucket === "empresa") return supabase().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const { data, error } = await supabase().storage.from(bucket).createSignedUrl(path, 60 * 30);
    if (error) throw error;
    return data.signedUrl;
  },
  async removeFile(bucket, path) {
    const { error } = await supabase().storage.from(bucket).remove([path]);
    if (error) throw error;
  },

  async getSession() {
    const { data } = await supabase().auth.getSession();
    const u = data.session?.user;
    return { user: u ? { id: u.id, email: u.email ?? "" } : null };
  },
  onAuthChange(cb) {
    const { data } = supabase().auth.onAuthStateChange((event, session) => {
      const u = session?.user;
      cb({ user: u ? { id: u.id, email: u.email ?? "" } : null, recovery: event === "PASSWORD_RECOVERY" }, event);
    });
    return () => data.subscription.unsubscribe();
  },
  async signIn(email, password) {
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
  },
  async signOut() {
    await supabase().auth.signOut({ scope: "local" });
  },
  async requestPasswordReset(email) {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    // não revela se o e-mail existe: só propaga erro de rede/limite
    if (error && (error.status === 429 || /fetch/i.test(error.message))) throw error;
  },
  async updatePassword(password) {
    const { error } = await supabase().auth.updateUser({ password });
    if (error) throw error;
  },
  async loadAccess(userId) {
    const [p, r] = await Promise.all([
      supabase().from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase().from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
    if (p.error) throw p.error;
    return { profile: p.data as Row | null, role: ((r.data?.role as Role) ?? null) };
  },
  watchAccess(userId, cb) {
    const ch = supabase()
      .channel(`acesso-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${userId}` }, cb)
      .subscribe();
    // redundância: revalida a cada 2 min e ao voltar para a aba
    const t = window.setInterval(cb, 120_000);
    const vis = () => document.visibilityState === "visible" && cb();
    document.addEventListener("visibilitychange", vis);
    return () => { supabase().removeChannel(ch); window.clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  },
};
