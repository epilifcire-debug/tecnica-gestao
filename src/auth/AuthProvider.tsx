import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/data/api";
import type { Profile, Role } from "@/data/types";
import { friendlyError } from "@/lib/errors";

type Status = "loading" | "anon" | "ready" | "inactive" | "no_profile";

interface AuthCtx {
  status: Status;
  userId: string | null;
  profile: Profile | null;
  role: Role | null;
  recovery: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(reason?: string): Promise<void>;
  refresh(): Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [recovery, setRecovery] = useState(false);
  const roleRef = useRef<Role | null>(null);

  const clearLocal = useCallback(() => {
    qc.clear(); // remove dados sensíveis em cache
    setProfile(null); setRole(null); setUserId(null); roleRef.current = null;
  }, [qc]);

  const loadAccess = useCallback(async (uid: string) => {
    try {
      const { profile: p, role: r } = await api().loadAccess(uid);
      if (!p || !r) { setStatus("no_profile"); return; }
      if (!p.ativo) {
        await api().signOut();
        clearLocal();
        setStatus("inactive");
        return;
      }
      if (roleRef.current && roleRef.current !== r) {
        qc.clear(); // papel mudou: descarta dados carregados com a permissão anterior
        toast.info("Seu perfil de acesso foi atualizado.");
      }
      roleRef.current = r;
      setProfile(p as Profile); setRole(r); setUserId(uid); setStatus("ready");
    } catch (e) {
      toast.error(friendlyError(e, "Não foi possível validar seu acesso."));
      setStatus((s) => (s === "loading" ? "no_profile" : s));
    }
  }, [clearLocal, qc]);

  useEffect(() => {
    let alive = true;
    api().getSession().then((s) => {
      if (!alive) return;
      if (s.user) loadAccess(s.user.id); else setStatus("anon");
    });
    const off = api().onAuthChange((s, event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT" || !s.user) { clearLocal(); setStatus((st) => (st === "inactive" ? st : "anon")); return; }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") loadAccess(s.user.id);
    });
    return () => { alive = false; off(); };
  }, [loadAccess, clearLocal]);

  // Usuário desativado / papel alterado enquanto está logado
  useEffect(() => {
    if (!userId) return;
    return api().watchAccess(userId, () => loadAccess(userId));
  }, [userId, loadAccess]);

  const value = useMemo<AuthCtx>(() => ({
    status, userId, profile, role, recovery,
    async signIn(email, password) {
      await api().signIn(email, password);
      const s = await api().getSession();
      if (s.user) await loadAccess(s.user.id);
    },
    async signOut(reason) {
      await api().signOut();
      clearLocal();
      setRecovery(false);
      setStatus("anon");
      try { sessionStorage.removeItem("tecnica-last-route"); } catch { /* */ }
      if (reason) toast.info(reason);
    },
    async refresh() { if (userId) await loadAccess(userId); },
  }), [status, userId, profile, role, recovery, loadAccess, clearLocal]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
}
