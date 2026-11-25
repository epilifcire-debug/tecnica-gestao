import { lazy, Suspense, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate, Navigate, useParams, Link } from "react-router-dom";
import clsx from "clsx";
import { Bell, Building2, CircleDollarSign, FileText, LogOut, MessageCircle, Phone, Mail, ChevronRight } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import type { Obra, Row } from "@/data/types";
import { LANC_STATUS, ORC_STATUS, LAUDO_STATUS } from "@/data/types";
import { useList, useGet } from "@/lib/hooks";
import { date, digits, money, maskPhone, pad } from "@/lib/format";
import { Logo } from "@/components/ui/Logo";
import { Avatar, Badge, Progress, Skeleton, StatusBadge } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Layout";
import { EmptyState, QueryView } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/Modal";
import { ObraCover } from "@/components/ObraCover";
import { Signature } from "@/components/layout/Signature";
import { IS_DEMO } from "@/lib/env";
import { DemoBar } from "@/components/layout/DemoBar";
import { FotosTab } from "../obra/FotosTab";
import { DocsTab, openFile } from "../obra/DocsTab";

const Perfil = lazy(() => import("../Perfil"));

/** Portal do Cliente — somente leitura, dados filtrados pela RLS (cliente_id do perfil). */
export default function Portal() {
  const { profile, signOut } = useAuth();
  const confirm = useConfirm();
  const nav = useNavigate();
  const obras = useList<Obra>("obras", { order: [{ col: "created_at", asc: false }] });
  const sair = async () => { if (await confirm({ title: "Sair do Portal?", confirm: "Sair" })) { await signOut(); nav("/login", { replace: true }); } };
  return (
    <div className="min-h-dvh pb-24">
      {IS_DEMO && <DemoBar />}
      <header className="sticky top-0 z-20 border-b border-line/50 bg-bg/85 backdrop-blur" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Logo variant="inline" />
          <div className="ml-auto flex items-center gap-2">
            <Link to="/portal/perfil" aria-label="Meu perfil"><Avatar nome={profile?.nome} url={profile?.avatar_url} size={34} /></Link>
            <button onClick={sair} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2" aria-label="Sair"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-5">
        <Routes>
          <Route index element={<Inicio obras={obras} />} />
          <Route path="obra/:id" element={<ObraPortal />} />
          <Route path="documentos" element={<DocsPortal obras={obras.data ?? []} />} />
          <Route path="financeiro" element={<FinPortal />} />
          <Route path="contato" element={<Contato />} />
          <Route path="perfil" element={<Suspense fallback={<Skeleton className="h-64" />}><Perfil /></Suspense>} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
        <div className="mt-10 text-center"><Signature /></div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-[#0b0b0d]/95 backdrop-blur" style={{ paddingBottom: "var(--safe-bottom)" }} aria-label="Portal">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {[["/portal", "Minha obra", Building2], ["/portal/documentos", "Documentos", FileText], ["/portal/financeiro", "Financeiro", CircleDollarSign], ["/portal/contato", "Contato", MessageCircle]].map(([to, l, I]: any) => (
            <NavLink key={to} to={to} end={to === "/portal"} className={({ isActive }) => clsx("flex flex-col items-center justify-center gap-1 text-[11px]", isActive ? "text-pearl-soft" : "text-muted")}><I className="h-5 w-5" />{l}</NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Inicio({ obras }: { obras: ReturnType<typeof useList<Obra>> }) {
  const { profile } = useAuth();
  const list = obras.data ?? [];
  if (obras.isLoading) return <Skeleton className="h-64" />;
  if (list.length === 1) return <ObraPortal obraId={list[0].id} hello={profile?.nome} />;
  return (
    <>
      <h1 className="text-2xl font-bold">Olá, {profile?.nome?.split(" ")[0]}</h1>
      <p className="mb-5 text-sm text-muted">Acompanhe suas obras com a Técnica Engenharia.</p>
      <QueryView q={obras} empty={<EmptyState title="Nenhuma obra vinculada ao seu cadastro." text="Assim que sua obra for cadastrada, você acompanhará tudo por aqui." />}>
        {(l) => <ul className="space-y-3">{l.map((o) => (
          <li key={o.id}><Link to={`/portal/obra/${o.id}`} className="card flex items-center gap-3 p-3">
            <ObraCover o={o} className="h-16 w-16 rounded-xl" />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{o.nome}</p><div className="mt-2 flex items-center gap-2"><Progress value={o.progresso} /><span className="text-xs">{Math.round(o.progresso)}%</span></div></div>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Link></li>))}</ul>}
      </QueryView>
    </>
  );
}

function ObraPortal({ obraId, hello }: { obraId?: string; hello?: string }) {
  const p = useParams();
  const id = obraId ?? p.id;
  const q = useGet<Obra>("obras", id, ["responsavel"]);
  const rdos = useList<Row>("rdos", { eq: { obra_id: id }, order: [{ col: "data", asc: false }], limit: 6 });
  const etapas = useList<Row>("obra_etapas", { eq: { obra_id: id }, order: [{ col: "ordem" }] });
  const laudos = useList<Row>("laudos", { eq: { obra_id: id } });
  const [aba, setAba] = useState<"resumo" | "fotos">("resumo");
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (!q.data) return <EmptyState title="Obra não encontrada." />;
  const o = q.data;
  return (
    <div className="space-y-4 animate-fade-up">
      {hello && <p className="text-sm text-muted">Olá, {hello.split(" ")[0]} 👋</p>}
      <section className="card overflow-hidden">
        <div className="relative h-40"><ObraCover o={o} className="absolute inset-0 h-full w-full" /><div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" /></div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2"><h1 className="text-xl font-bold">{o.nome}</h1><Bell className="h-5 w-5 text-muted" /></div>
          <p className="text-sm text-muted">{Math.round(o.progresso)}% concluída</p>
          <Progress value={o.progresso} className="mt-2 h-2" />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-muted">Prazo</p><p>{date(o.data_inicio)} – {date(o.previsao_termino)}</p></div>
            <div><p className="text-xs text-muted">Responsável</p><p>{o.responsavel?.nome ?? "Técnica Engenharia"}</p></div>
          </div>
        </div>
      </section>
      <div className="flex gap-2">{(["resumo", "fotos"] as const).map((t) => <button key={t} onClick={() => setAba(t)} className={clsx("chip", aba === t && "chip-active")}>{t === "resumo" ? "Atualizações" : "Fotos"}</button>)}</div>
      {aba === "fotos" ? <FotosTab obra={o} readOnly /> : (
        <>
          <Card title="Últimas atualizações">
            <QueryView q={rdos} empty={<p className="text-sm text-muted">Ainda não há atualizações publicadas.</p>}>
              {(l) => <ul className="space-y-3">{l.map((r) => <li key={r.id} className="flex gap-3 text-sm"><span className="w-12 shrink-0 text-muted">{date(r.data).slice(0, 5)}</span><span>{r.servicos_executados}</span></li>)}</ul>}
            </QueryView>
          </Card>
          <Card title="Etapas">
            <QueryView q={etapas} empty={<p className="text-sm text-muted">Cronograma ainda não publicado.</p>}>
              {(l) => <ul className="space-y-3">{l.map((e) => <li key={e.id}><div className="mb-1 flex justify-between text-sm"><span>{e.nome}</span><span className="tabular-nums">{Math.round(e.percentual)}%</span></div><Progress value={e.percentual} tone={e.percentual >= 100 ? "ok" : "pearl"} /></li>)}</ul>}
            </QueryView>
          </Card>
          {!!laudos.data?.length && <Card title="Laudos">{laudos.data.map((l) => (
            <button key={l.id} disabled={!l.storage_path} onClick={() => l.storage_path && openFile("documentos", l.storage_path)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm">
              <span>{l.titulo}</span><StatusBadge map={LAUDO_STATUS} value={l.status} /></button>))}</Card>}
        </>
      )}
    </div>
  );
}

function DocsPortal({ obras }: { obras: Obra[] }) {
  const orc = useList<Row>("orcamentos", { order: [{ col: "numero", asc: false }] });
  return (
    <div className="space-y-4 animate-fade-up">
      <h1 className="text-2xl font-bold">Documentos</h1>
      {obras.map((o) => <div key={o.id}><p className="mb-2 text-sm text-muted">{o.nome}</p><DocsTab obra={o} readOnly /></div>)}
      <Card title="Orçamentos">
        <QueryView q={orc} empty={<p className="text-sm text-muted">Nenhum orçamento.</p>}>
          {(l) => <ul className="divide-y divide-line/50">{l.map((x) => <li key={x.id} className="flex items-center justify-between py-2.5 text-sm"><span>Nº {pad(x.numero)} — {x.titulo}</span><span className="flex items-center gap-2"><strong>{money(x.total)}</strong><StatusBadge map={ORC_STATUS} value={x.status} /></span></li>)}</ul>}
        </QueryView>
      </Card>
    </div>
  );
}

function FinPortal() {
  const q = useList<Row>("lancamentos", { embed: ["obra"], order: [{ col: "vencimento" }] });
  const tot = useMemo(() => (q.data ?? []).reduce((a, l) => ({ pago: a.pago + (l.status === "pago" ? Number(l.valor) : 0), aberto: a.aberto + (l.status === "pendente" ? Number(l.valor) : 0) }), { pago: 0, aberto: 0 }), [q.data]);
  return (
    <div className="space-y-4 animate-fade-up">
      <h1 className="text-2xl font-bold">Financeiro</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="text-xs text-muted">Pago</p><p className="text-lg font-bold text-ok">{money(tot.pago)}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Em aberto</p><p className="text-lg font-bold text-pearl-soft">{money(tot.aberto)}</p></div>
      </div>
      <Card title="Parcelas">
        <QueryView q={q} empty={<p className="text-sm text-muted">Nenhuma parcela registrada.</p>}>
          {(l) => <ul className="divide-y divide-line/50">{l.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div><p className="font-medium">{x.descricao}</p><p className="text-xs text-muted">Vencimento {date(x.vencimento)}{x.pago_em ? ` · pago em ${date(x.pago_em)}` : ""}</p></div>
              <div className="text-right"><p className="font-semibold tabular-nums">{money(x.valor)}</p><StatusBadge map={LANC_STATUS} value={x.status} /></div>
            </li>))}</ul>}
        </QueryView>
      </Card>
    </div>
  );
}

function Contato() {
  const cfg = useList<Row>("empresa_config", { limit: 1 });
  const c = cfg.data?.[0];
  return (
    <div className="space-y-4 animate-fade-up">
      <h1 className="text-2xl font-bold">Fale com a Técnica</h1>
      <Card>
        {!c ? <Skeleton className="h-24" /> : (
          <div className="grid gap-2">
            {c.telefone && <a href={`https://wa.me/55${digits(c.telefone)}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-line p-3.5 hover:border-pearl/50"><MessageCircle className="h-5 w-5 text-ok" /><span className="flex-1">WhatsApp</span><span className="text-sm text-muted">{maskPhone(c.telefone)}</span></a>}
            {c.telefone && <a href={`tel:+55${digits(c.telefone)}`} className="flex items-center gap-3 rounded-xl border border-line p-3.5 hover:border-pearl/50"><Phone className="h-5 w-5 text-pearl" /><span className="flex-1">Ligar</span></a>}
            {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-3 rounded-xl border border-line p-3.5 hover:border-pearl/50"><Mail className="h-5 w-5 text-blue-300" /><span className="flex-1">E-mail</span><span className="text-sm text-muted">{c.email}</span></a>}
            {c.endereco && <p className="pt-2 text-sm text-muted">{c.endereco} — {c.cidade}/{c.uf}</p>}
            <Badge tone="pearl" className="mt-2 w-fit">{c.nome_fantasia}</Badge>
          </div>
        )}
      </Card>
    </div>
  );
}
