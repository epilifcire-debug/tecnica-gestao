import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { can, homeFor, type Modulo } from "./permissions";
import { FullScreenLoader } from "@/components/ui/Feedback";
import { NoPermission } from "@/components/ui/States";

/** Rotas autenticadas: espera a sessão ser validada (sem flash de login/admin). */
export function RequireAuth() {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === "loading") return <FullScreenLoader label="Validando sua sessão…" />;
  if (status !== "ready") return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search, status }} />;
  return <Outlet />;
}

/** Autorização por módulo. Dados protegidos nem são requisitados se não houver permissão. */
export function RequireModule({ modulo, children }: { modulo: Modulo; children: React.ReactNode }) {
  const { role } = useAuth();
  // cliente vive só no Portal (inclusive o próprio perfil)
  if (role === "cliente" && modulo !== "portal") return <Navigate to={modulo === "perfil" ? "/portal/perfil" : "/portal"} replace />;
  if (!can(role, modulo)) {
    // cliente nunca vê telas internas: qualquer rota interna leva ao Portal da obra dele
    if (role === "cliente") return <Navigate to={homeFor(role)} replace />;
    return <NoPermission />;
  }
  return <>{children}</>;
}

/** Login/recuperação: usuário já autenticado vai para a home do seu perfil. */
export function PublicOnly() {
  const { status, role } = useAuth();
  if (status === "loading") return <FullScreenLoader label="Carregando…" />;
  if (status === "ready") return <Navigate to={homeFor(role)} replace />;
  return <Outlet />;
}
