import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Bell, Search, LogOut, Plus, Menu, Building2, LayoutDashboard, CalendarDays, X, ChevronDown, User, ClipboardList,
  ListChecks, Calculator, CircleDollarSign, Users, FileBadge2, AlertTriangle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { can } from "@/auth/permissions";
import { ROLE_LABEL } from "@/data/types";
import { api } from "@/data/api";
import { NAV, NAV_FOOTER } from "./nav";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Feedback";
import { useConfirm, Modal } from "@/components/ui/Modal";
import { Signature } from "./Signature";
import { GlobalSearch } from "./GlobalSearch";
import { IS_DEMO } from "@/lib/env";
import { today } from "@/lib/format";
import { DemoBar } from "./DemoBar";

export function AppShell() {
  const { profile, role, signOut } = useAuth();
  const confirm = useConfirm();
  const nav = useNavigate();
  const loc = useLocation();
  const [more, setMore] = useState(false);
  const [quick, setQuick] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => { setMore(false); setQuick(false); }, [loc.pathname]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const items = useMemo(() => NAV.filter((n) => can(role, n.modulo)), [role]);
  const footer = useMemo(() => NAV_FOOTER.filter((n) => can(role, n.modulo)), [role]);

  const logout = async () => {
    const ok = await confirm({ title: "Sair do sistema?", text: "Sua sessão será encerrada neste dispositivo.", confirm: "Sair" });
    if (!ok) return;
    await signOut();
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      {IS_DEMO && <DemoBar />}
      {/* ------------------------------------------------ Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line/70 bg-[#0c1016]/95 backdrop-blur lg:flex" aria-label="Menu principal">
        <Link to="/" className="flex justify-center px-6 pb-4 pt-5"><Logo variant="stack" size="sm" /></Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {items.map((n) => <SideLink key={n.to} {...n} />)}
          {footer.length > 0 && <div className="my-2 border-t border-line/60" />}
          {footer.map((n) => <SideLink key={n.to} {...n} />)}
        </nav>
        <div className="border-t border-line/60 px-4 py-3">
          <Link to="/perfil" className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-surface-2">
            <Avatar nome={profile?.nome} url={profile?.avatar_url} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile?.nome}</p>
              <p className="truncate text-xs text-muted">{role ? ROLE_LABEL[role] : ""}</p>
            </div>
          </Link>
          <button onClick={logout} className="mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink">
            <LogOut className="h-[18px] w-[18px]" /> Sair
          </button>
          <div className="mt-2 px-3"><Signature /></div>
        </div>
      </aside>

      {/* ------------------------------------------------ Topbar */}
      <header className="sticky top-0 z-20 border-b border-line/50 bg-bg/80 backdrop-blur-md" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <button className="grid h-10 w-10 place-items-center rounded-xl text-ink lg:hidden" onClick={() => setMore(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          <Link to="/" className="lg:hidden"><Logo variant="inline" /></Link>
          <button onClick={() => setSearch(true)} className="ml-auto hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface/80 px-3.5 text-sm text-muted transition hover:border-gold/40 sm:flex lg:ml-0">
            <Search className="h-4 w-4" /> <span className="flex-1 text-left">Buscar obras, clientes, tarefas, orçamentos…</span>
            <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px]">Ctrl + K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button onClick={() => setSearch(true)} className="grid h-10 w-10 place-items-center rounded-xl sm:hidden" aria-label="Buscar"><Search className="h-5 w-5" /></button>
            {role !== "cliente" && <Alerts />}
            <UserMenu onLogout={logout} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-7">
        <Outlet />
      </main>

      {/* ------------------------------------------------ Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-[#0c1016]/95 backdrop-blur lg:hidden" style={{ paddingBottom: "var(--safe-bottom)" }} aria-label="Navegação inferior">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          <BottomLink to="/" icon={<LayoutDashboard className="h-5 w-5" />} label="Início" />
          <BottomLink to="/obras" icon={<Building2 className="h-5 w-5" />} label="Obras" />
          <div className="flex justify-center">
            <button onClick={() => setQuick(true)} aria-label="Novo registro"
              className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-gold-soft to-gold text-[#1a1406] shadow-[0_8px_24px_-6px_rgb(var(--gold)/.8)] ring-4 ring-bg active:scale-95">
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>
          <BottomLink to="/agenda" icon={<CalendarDays className="h-5 w-5" />} label="Agenda" />
          <button onClick={() => setMore(true)} className="flex flex-col items-center gap-1 text-[11px] text-muted"><Menu className="h-5 w-5" />Mais</button>
        </div>
      </nav>

      {/* Drawer "Mais" */}
      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMore(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col border-r border-line bg-[#0c1016] animate-[fade-up_.2s_ease-out]" style={{ paddingTop: "var(--safe-top)" }}>
            <div className="flex items-center justify-between px-5 py-4">
              <Logo variant="inline" />
              <button onClick={() => setMore(false)} className="grid h-10 w-10 place-items-center rounded-xl" aria-label="Fechar menu"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">{[...items, ...footer].map((n) => <SideLink key={n.to} {...n} />)}</nav>
            <div className="border-t border-line/60 p-3 safe-bottom">
              <button onClick={logout} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-2"><LogOut className="h-[18px] w-[18px]" /> Sair</button>
              <div className="px-3 pt-1"><Signature /></div>
            </div>
          </div>
        </div>
      )}

      <QuickAdd open={quick} onClose={() => setQuick(false)} />
      <GlobalSearch open={search} onClose={() => setSearch(false)} />
    </div>
  );
}

function SideLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <NavLink to={to} end={to === "/"}
      className={({ isActive }) => clsx("group flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition",
        isActive ? "bg-gradient-to-r from-gold/20 to-gold/5 text-gold-soft ring-1 ring-gold/40" : "text-ink/75 hover:bg-surface-2 hover:text-ink")}>
      <Icon className="h-[19px] w-[19px] shrink-0" />{label}
    </NavLink>
  );
}

function BottomLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => clsx("flex flex-col items-center gap-1 text-[11px]", isActive ? "text-gold-soft" : "text-muted")}>
      {icon}{label}
    </NavLink>
  );
}

function UserMenu({ onLogout }: { onLogout: () => void }) {
  const { profile, role } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2" aria-haspopup="menu" aria-expanded={open}>
        <Avatar nome={profile?.nome} url={profile?.avatar_url} size={34} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[160px] truncate text-[13px] font-semibold">{profile?.nome}</span>
          <span className="block text-[11px] text-muted">{role ? ROLE_LABEL[role] : ""}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted md:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-fade-up">
            <Link to="/perfil" role="menuitem" onClick={() => setOpen(false)} className="flex h-11 items-center gap-2.5 px-3.5 text-sm hover:bg-surface-2"><User className="h-4 w-4" /> Meu perfil</Link>
            <button role="menuitem" onClick={() => { setOpen(false); onLogout(); }} className="flex h-11 w-full items-center gap-2.5 px-3.5 text-sm text-red-300 hover:bg-surface-2"><LogOut className="h-4 w-4" /> Sair</button>
          </div>
        </>
      )}
    </div>
  );
}

function Alerts() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["rpc", "alertas", role],
    queryFn: () => api().rpc<any>("dashboard_resumo", { p_inicio: today(), p_fim: today() }),
    refetchInterval: 5 * 60_000,
  });
  const d = q.data ?? {};
  const list = [
    { n: d.tarefas_vencidas, label: "Tarefas vencidas", to: "/tarefas?filtro=vencidas", icon: ListChecks },
    { n: d.obras_atrasadas, label: "Obras atrasadas", to: "/obras?filtro=atrasadas", icon: AlertTriangle },
    can(role, "orcamentos") && { n: d.orcamentos_pendentes, label: "Orçamentos aguardando retorno", to: "/orcamentos?status=enviado", icon: Calculator },
    { n: d.vistorias_pendentes, label: "Vistorias agendadas", to: "/vistorias", icon: ClipboardList },
    { n: d.laudos_pendentes, label: "Laudos pendentes", to: "/laudos", icon: FileBadge2 },
  ].filter(Boolean).filter((x: any) => x.n > 0) as { n: number; label: string; to: string; icon: any }[];
  const total = list.reduce((a, x) => a + x.n, 0);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-surface-2" aria-label={`Alertas${total ? `: ${total}` : ""}`}>
        <Bell className="h-5 w-5" />
        {total > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-fade-up">
            <p className="border-b border-line/70 px-4 py-3 text-sm font-semibold">Alertas e pendências</p>
            {list.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">Nenhuma pendência no momento.</p> :
              list.map((a) => (
                <Link key={a.label} to={a.to} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                  <a.icon className="h-4 w-4 text-gold" /><span className="flex-1">{a.label}</span><span className="font-semibold">{a.n}</span>
                </Link>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role } = useAuth();
  const nav = useNavigate();
  const go = (to: string) => { onClose(); nav(to); };
  const opts = [
    { label: "Novo RDO", icon: ClipboardList, to: "/obras?acao=rdo", ok: can(role, "obras") },
    { label: "Nova tarefa", icon: ListChecks, to: "/tarefas?novo=1", ok: can(role, "tarefas") },
    { label: "Compromisso", icon: CalendarDays, to: "/agenda?novo=1", ok: can(role, "agenda") },
    { label: "Nova obra", icon: Building2, to: "/obras?novo=1", ok: can(role, "clientes") },
    { label: "Orçamento", icon: Calculator, to: "/orcamentos/novo", ok: can(role, "orcamentos") },
    { label: "Lançamento", icon: CircleDollarSign, to: "/financeiro?novo=1", ok: can(role, "financeiro") },
    { label: "Cliente", icon: Users, to: "/clientes?novo=1", ok: can(role, "clientes") },
  ].filter((o) => o.ok);
  return (
    <Modal open={open} onClose={onClose} title="Criar novo" size="sm">
      <div className="grid grid-cols-3 gap-2.5 pb-2">
        {opts.map((o) => (
          <button key={o.label} onClick={() => go(o.to)} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-bg/40 px-2 py-4 text-[12.5px] hover:border-gold/50">
            <o.icon className="h-6 w-6 text-gold" />{o.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
