import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PublicOnly, RequireAuth, RequireModule } from "./auth/guards";
import { AppShell } from "./components/layout/AppShell";
import { InstallPrompt, UpdatePrompt } from "./components/layout/PwaPrompts";
import { FullScreenLoader, Spinner } from "./components/ui/Feedback";
import { useAuth } from "./auth/AuthProvider";
import Login from "./pages/auth/Login";
import EsqueciSenha from "./pages/auth/EsqueciSenha";
import NovaSenha from "./pages/auth/NovaSenha";
import type { Modulo } from "./auth/permissions";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Obras = lazy(() => import("./pages/Obras"));
const ObraDetalhe = lazy(() => import("./pages/obra/ObraDetalhe"));
const RdoForm = lazy(() => import("./pages/obra/RdoForm"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const OrcamentoEditor = lazy(() => import("./pages/OrcamentoEditor"));
const Contratos = lazy(() => import("./pages/Contratos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Vistorias = lazy(() => import("./pages/Vistorias"));
const Laudos = lazy(() => import("./pages/Laudos"));
const Materiais = lazy(() => import("./pages/Materiais"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const Equipe = lazy(() => import("./pages/Equipe"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Portal = lazy(() => import("./pages/portal/Portal"));
const NotFound = lazy(() => import("./pages/NotFound"));

const P = (m: Modulo, el: React.ReactNode) => <RequireModule modulo={m}>{el}</RequireModule>;
const PageLoader = () => <div className="grid min-h-[50vh] place-items-center"><Spinner /></div>;

export function App() {
  const { status } = useAuth();
  if (status === "loading") return <FullScreenLoader label="Validando sua sessão…" />;
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          </Route>
          <Route path="/nova-senha" element={<NovaSenha />} />

          <Route element={<RequireAuth />}>
            <Route path="/portal/*" element={P("portal", <Portal />)} />
            <Route element={<AppShell />}>
              <Route index element={P("dashboard", <Dashboard />)} />
              <Route path="obras" element={P("obras", <Obras />)} />
              <Route path="obras/:id" element={P("obras", <ObraDetalhe />)} />
              <Route path="obras/:id/rdo/:rdoId" element={P("obras", <RdoForm />)} />
              <Route path="clientes" element={P("clientes", <Clientes />)} />
              <Route path="orcamentos" element={P("orcamentos", <Orcamentos />)} />
              <Route path="orcamentos/:id" element={P("orcamentos", <OrcamentoEditor />)} />
              <Route path="contratos" element={P("contratos", <Contratos />)} />
              <Route path="financeiro" element={P("financeiro", <Financeiro />)} />
              <Route path="tarefas" element={P("tarefas", <Tarefas />)} />
              <Route path="vistorias" element={P("vistorias", <Vistorias />)} />
              <Route path="laudos" element={P("laudos", <Laudos />)} />
              <Route path="materiais" element={P("materiais", <Materiais />)} />
              <Route path="fornecedores" element={P("fornecedores", <Fornecedores />)} />
              <Route path="equipe" element={P("equipe", <Equipe />)} />
              <Route path="agenda" element={P("agenda", <Agenda />)} />
              <Route path="documentos" element={P("documentos", <Documentos />)} />
              <Route path="relatorios" element={P("relatorios", <Relatorios />)} />
              <Route path="configuracoes" element={P("configuracoes", <Configuracoes />)} />
              <Route path="usuarios" element={P("usuarios", <Usuarios />)} />
              <Route path="perfil" element={P("perfil", <Perfil />)} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      <UpdatePrompt />
      <InstallPrompt />
    </>
  );
}
