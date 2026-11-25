import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Building2, CalendarDays, CalendarRange, ChevronRight, CircleDollarSign,
  Clock, ClipboardCheck, FileBadge2, FileText, HardHat, ListChecks, Quote, Receipt, TriangleAlert, User, Users, Wallet, Landmark,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { useList, useRpc } from "@/lib/hooks";
import { ObraCover } from "@/components/ObraCover";
import { addDays, isoDate, longToday, MESES, money, moneyShort, time } from "@/lib/format";
import type { Obra, Row } from "@/data/types";
import { OBRA_STATUS } from "@/data/types";
import { Card, IconTile, SeeAll, type IconTone } from "@/components/ui/Layout";
import { Badge, Progress, Skeleton } from "@/components/ui/Feedback";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ColorBends, PRESET_PEROLA } from "@/components/ui/ColorBends";
import { Input } from "@/components/ui/Form";

type Periodo = "mes" | "mes_ant" | "ano" | "custom";
function range(p: Periodo, ci: string, cf: string): [string, string] {
  const n = new Date();
  if (p === "mes") return [isoDate(new Date(n.getFullYear(), n.getMonth(), 1)), isoDate(n)];
  if (p === "mes_ant") return [isoDate(new Date(n.getFullYear(), n.getMonth() - 1, 1)), isoDate(new Date(n.getFullYear(), n.getMonth(), 0))];
  if (p === "ano") return [isoDate(new Date(n.getFullYear(), 0, 1)), isoDate(n)];
  return [ci, cf];
}
const variation = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);

export default function Dashboard() {
  const { profile, role } = useAuth();
  const gestor = isGestor(role);
  const [p, setP] = useState<Periodo>("mes");
  const [ci, setCi] = useState(isoDate(addDays(new Date(), -30)));
  const [cf, setCf] = useState(isoDate(new Date()));
  const [ini, fim] = range(p, ci, cf);
  const valid = ini && fim && ini <= fim;
  const resumo = useRpc<Row>("dashboard_resumo", { p_inicio: ini, p_fim: fim }, [], !!valid);
  const cfg = useList<Row>("empresa_config", { limit: 1 });
  const nome = (profile?.nome ?? "").replace(/^(Eng\.|Dr\.|Dra\.)\s*/i, "").split(" ").slice(0, 2).join(" ");
  const cidade = cfg.data?.[0] ? `${cfg.data[0].cidade ?? ""}${cfg.data[0].uf ? "/" + cfg.data[0].uf : ""}` : "";
  const d = resumo.data;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative -mx-4 -mt-5 overflow-hidden px-4 pb-2 pt-6 sm:-mx-6 sm:px-6 lg:-mt-7 lg:pt-8">
        <div className="pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]"><ColorBends {...PRESET_PEROLA} intensity={0.75} /></div>
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 className="mt-2 text-[28px] font-bold sm:text-4xl">Olá, {nome || "bem-vindo"}</h1>
            <p className="mt-1.5 text-[15px] text-ink/80">Acompanhe aqui o andamento das suas obras e principais indicadores.</p>
          </div>
          <div className="flex items-start gap-6 lg:text-right">
            <div className="flex items-start gap-2.5 text-sm">
              <CalendarDays className="mt-0.5 h-4 w-4 text-ink/70" />
              <div><p>{longToday()}</p>{cidade && <p className="text-xs text-muted">{cidade}</p>}</div>
            </div>
            <div className="hidden text-[11px] font-medium leading-5 tracking-[0.5em] text-ink/70 xl:block">
              <p>PLANEJAMENTO</p><p>EXECUÇÃO</p><p>RESULTADOS</p><div className="ml-auto mt-1 h-0.5 w-10 bg-pearl" />
            </div>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          {([["mes", "Este mês"], ["mes_ant", "Mês anterior"], ["ano", "Este ano"], ["custom", "Personalizado"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setP(k)} className={clsx("chip", p === k && "chip-active")} aria-pressed={p === k}>
              {k === "custom" && <CalendarRange className="h-4 w-4" />}{l}
            </button>
          ))}
          {p === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" className="h-9 w-[150px]" value={ci} onChange={(e) => setCi(e.target.value)} aria-label="Data inicial" />
              <span className="text-muted">até</span>
              <Input type="date" className="h-9 w-[150px]" value={cf} onChange={(e) => setCf(e.target.value)} aria-label="Data final" />
            </div>
          )}
        </div>
        {p === "custom" && !valid && <p className="relative mt-2 text-sm text-red-300">A data inicial deve ser anterior à final.</p>}
      </section>

      {resumo.isError ? <ErrorState error={resumo.error} onRetry={() => resumo.refetch()} /> : (
        <>
          {/* --------------------------------------------------------- KPIs principais */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <Kpi loading={!d} to="/obras?status=em_andamento" tone="pearl" icon={<HardHat className="h-6 w-6" />} label="Obras em andamento"
              value={d?.obras_andamento ?? 0} delta={d && variation(d.obras_andamento, d.obras_andamento_ant)} />
            {gestor && <>
              <Kpi loading={!d} to="/financeiro?aba=receitas" tone="ok" icon={<CircleDollarSign className="h-6 w-6" />} label="Recebido no período" value={money(d?.recebido)} delta={d && variation(d.recebido, d.recebido_ant)} />
              <Kpi loading={!d} to="/financeiro?aba=despesas" tone="bad" icon={<Receipt className="h-6 w-6" />} label="Gastos no período" value={money(d?.gastos)} delta={d && variation(d.gastos, d.gastos_ant)} invert />
              <Kpi loading={!d} to="/financeiro?aba=receber" tone="info" icon={<FileText className="h-6 w-6" />} label="A receber" value={money(d?.a_receber)} delta={d && variation(d.a_receber, d.a_receber_ant)} />
            </>}
            {!gestor && <>
              <Kpi loading={!d} to="/tarefas?filtro=vencidas" tone="bad" icon={<ListChecks className="h-6 w-6" />} label="Tarefas vencidas" value={d?.tarefas_vencidas ?? 0} />
              <Kpi loading={!d} to="/vistorias" tone="violet" icon={<ClipboardCheck className="h-6 w-6" />} label="Vistorias pendentes" value={d?.vistorias_pendentes ?? 0} />
              <Kpi loading={!d} to="/laudos" tone="ok" icon={<FileBadge2 className="h-6 w-6" />} label="Laudos pendentes" value={d?.laudos_pendentes ?? 0} />
            </>}
          </div>

          {/* --------------------------------------------------------- pendências */}
          {gestor && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
              <Mini loading={!d} tone="violet" icon={<Users className="h-5 w-5" />} n={d?.clientes} label="Clientes cadastrados" to="/clientes" link="Ver clientes" />
              <Mini loading={!d} tone="warn" icon={<Clock className="h-5 w-5" />} n={d?.obras_atrasadas} label="Obras atrasadas" to="/obras?filtro=atrasadas" link="Ver obras" />
              <Mini loading={!d} tone="bad" icon={<ListChecks className="h-5 w-5" />} n={d?.tarefas_vencidas} label="Tarefas vencidas" to="/tarefas?filtro=vencidas" link="Ver tarefas" />
              <Mini loading={!d} tone="info" icon={<FileText className="h-5 w-5" />} n={d?.orcamentos_pendentes} label="Orçamentos pendentes" to="/orcamentos?status=enviado" link="Ver orçamentos" />
              <Mini loading={!d} tone="violet" icon={<ClipboardCheck className="h-5 w-5" />} n={d?.vistorias_pendentes} label="Vistorias pendentes" to="/vistorias" link="Ver vistorias" />
              <Mini loading={!d} tone="ok" icon={<FileBadge2 className="h-5 w-5" />} n={d?.laudos_pendentes} label="Laudos pendentes" to="/laudos" link="Ver laudos" />
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------------- gráficos */}
      {gestor && (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr_1.1fr]">
          <ReceitasGastos />
          <SaldoCard ini={ini} fim={fim} saldo={d?.saldo} loading={!d} />
          <Compromissos />
        </div>
      )}
      {!gestor && <div className="grid gap-4 lg:grid-cols-2"><Compromissos /><MinhasTarefas /></div>}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <ObrasDestaque />
        <div className="grid gap-4">
          {gestor && <Alertas d={d} />}
          <div className="card relative overflow-hidden p-5">
            <Quote className="h-6 w-6 text-pearl" />
            <p className="mt-2 font-display text-lg leading-snug">Disciplina na gestão.<br />Qualidade na entrega.<br />Confiança em cada projeto.</p>
            <div className="mt-4 h-0.5 w-12 bg-pearl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Delta({ v, invert }: { v: number | null | undefined; invert?: boolean }) {
  if (v === null || v === undefined || !isFinite(v)) return null;
  const up = v >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="mt-1 text-[12.5px]">
      <span className={clsx("inline-flex items-center gap-0.5 font-semibold", good ? "text-ok" : "text-red-400")}><Icon className="h-3.5 w-3.5" />{Math.abs(v).toFixed(0)}%</span>
      <span className="ml-1 text-muted">vs. período ant.</span>
    </p>
  );
}

function Kpi({ tone, icon, label, value, delta, to, loading, invert, className }: { tone: IconTone; icon: React.ReactNode; label: string; value: React.ReactNode; delta?: number | null | false; to: string; loading?: boolean; invert?: boolean; className?: string }) {
  return (
    <Link to={to} className={clsx("card group flex items-center gap-3.5 p-4 transition hover:border-pearl/40 sm:p-5", className)}>
      <IconTile tone={tone} size={48}>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        {loading ? <><Skeleton className="h-7 w-24" /><Skeleton className="mt-2 h-4 w-28" /></> : <>
          <p className="truncate text-[21px] font-bold tabular-nums sm:text-[20px] 2xl:text-[23px]">{value}</p>
          <p className="truncate text-[13px] text-ink/80">{label}</p>
          {delta !== false && <Delta v={delta as number} invert={invert} />}
        </>}
      </div>
      <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-pearl sm:block xl:hidden 2xl:block" />
    </Link>
  );
}

function Mini({ tone, icon, n, label, to, link, loading, className }: { tone: IconTone; icon: React.ReactNode; n?: number; label: string; to: string; link: string; loading?: boolean; className?: string }) {
  return (
    <Link to={to} className={clsx("card group flex items-center gap-3 p-4 transition hover:border-pearl/40", className)}>
      <IconTile tone={tone} size={42}>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        {loading ? <Skeleton className="h-6 w-10" /> : <p className="text-xl font-bold tabular-nums">{n ?? 0}</p>}
        <p className="truncate text-[13px] text-ink/80">{label}</p>
        <p className="mt-1 hidden items-center gap-1 text-[12px] text-pearl-soft sm:flex">{link}<ArrowRight className="h-3 w-3" /></p>
      </div>
    </Link>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p: any) => <p key={p.dataKey} className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name}: <strong>{money(p.value)}</strong></p>)}
    </div>
  );
}

function ReceitasGastos() {
  const y = new Date().getFullYear();
  const [ano, setAno] = useState(y);
  const q = useRpc<Row[]>("receitas_gastos_mensal", { p_ano: ano });
  const data = useMemo(() => (q.data ?? []).map((r) => ({ mes: MESES[r.mes - 1], recebido: Number(r.recebido), gastos: Number(r.gastos) })), [q.data]);
  const vazio = data.every((x) => !x.recebido && !x.gastos);
  return (
    <Card title={<span>Receitas e Gastos<span className="block text-[12px] font-normal text-muted">Comparativo mensal (valores em R$)</span></span>} icon={<BarChart3 className="h-5 w-5" />}
      action={<select className="input h-9 w-28" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">{[y, y - 1, y - 2].map((a) => <option key={a}>{a}</option>)}</select>}>
      {q.isLoading ? <Skeleton className="h-64 w-full" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : vazio ? (
        <EmptyState title="Sem lançamentos pagos neste ano." text="Os valores aparecem aqui assim que receitas e despesas forem baixadas no Financeiro." />
      ) : (
        <>
          <div className="h-64" role="img" aria-label={`Gráfico de receitas e gastos mensais de ${ano}`}>
            <ResponsiveContainer>
              <BarChart data={data} barGap={2} margin={{ left: -8, right: 4, top: 8 }}>
                <CartesianGrid stroke="rgb(36 44 56)" vertical={false} />
                <XAxis dataKey="mes" interval={0} tick={{ fill: "#8A94A3", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8A94A3", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : v)} width={56} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgb(255 255 255 / .03)" }} />
                <Bar dataKey="recebido" name="Recebimentos" fill="#22C55E" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="gastos" name="Gastos" fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-5 text-[13px] text-ink/80"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-ok" />Recebimentos</span><span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-bad" />Gastos</span></div>
        </>
      )}
    </Card>
  );
}

function SaldoCard({ ini, fim, saldo, loading }: { ini: string; fim: string; saldo?: number; loading: boolean }) {
  const q = useRpc<Row[]>("saldo_diario", { p_inicio: ini, p_fim: fim }, [], !!ini && !!fim && ini <= fim);
  const data = (q.data ?? []).map((r) => ({ dia: r.dia, saldo: Number(r.saldo) }));
  const neg = (saldo ?? 0) < 0;
  return (
    <Card title={<>Saldo Financeiro <span className="font-normal text-muted">(realizado)</span></>} icon={<Wallet className="h-5 w-5" />} pad={false}>
      <div className="px-5 pb-2 pt-3 text-center">
        {loading ? <Skeleton className="mx-auto h-10 w-48" /> : <p className={clsx("text-[32px] font-bold tabular-nums", neg ? "text-red-400" : "text-ok")}>{money(saldo)}</p>}
        <p className="text-[13px] text-ink/75">Recebido − Gastos (valores pagos)</p>
      </div>
      <div className="h-36">
        {data.length > 1 && (
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={neg ? "#EF4444" : "#22C55E"} stopOpacity={0.4} /><stop offset="1" stopColor={neg ? "#EF4444" : "#22C55E"} stopOpacity={0} /></linearGradient></defs>
              <Tooltip content={({ active, payload }: any) => active && payload?.length ? <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs">{new Date(payload[0].payload.dia + "T12:00").toLocaleDateString("pt-BR")}: <strong>{money(payload[0].value)}</strong></div> : null} />
              <Area type="monotone" dataKey="saldo" stroke={neg ? "#EF4444" : "#22C55E"} strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function Compromissos() {
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);
  const q = useList<Row>("compromissos", { embed: ["obra", "cliente", "responsavel"], gte: { inicio: agora.toISOString() }, eq: { concluido: false }, order: [{ col: "inicio" }], limit: 5 });
  return (
    <Card title="Próximos compromissos" icon={<CalendarDays className="h-5 w-5" />} action={<SeeAll to="/agenda" />} pad={false}>
      <div className="px-3 pb-3 pt-2 sm:px-4">
        {q.isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !q.data?.length ? <EmptyState title="Nenhum compromisso agendado." /> :
            <ul className="divide-y divide-line/50">
              {q.data.map((c, i) => {
                const dt = new Date(c.inicio);
                const tones = ["bg-red-900/50 text-red-200", "bg-blue-900/50 text-blue-200", "bg-surface-2 text-ink", "bg-surface-2 text-ink", "bg-surface-2 text-ink"];
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className={clsx("grid w-12 shrink-0 place-items-center rounded-lg py-1 text-center leading-none", tones[i])}>
                      <span className="text-lg font-bold">{String(dt.getDate()).padStart(2, "0")}</span>
                      <span className="text-[10px] uppercase">{MESES[dt.getMonth()]}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.titulo}</p>
                      <p className="truncate text-xs text-muted">{c.obra ? `Obra: ${c.obra.nome}` : c.cliente ? `Cliente: ${c.cliente.nome}` : c.local ?? ""}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-ink/80"><Clock className="h-3.5 w-3.5" />{time(c.inicio)}</span>
                    <User className="hidden h-4 w-4 text-muted sm:block" aria-label={c.responsavel?.nome} />
                  </li>
                );
              })}
            </ul>}
      </div>
    </Card>
  );
}

function MinhasTarefas() {
  const { userId } = useAuth();
  const q = useList<Row>("tarefas", { eq: { responsavel_id: userId }, in: { status: ["pendente", "em_andamento"] }, embed: ["obra"], order: [{ col: "prazo" }], limit: 6 });
  return (
    <Card title="Minhas tarefas" icon={<ListChecks className="h-5 w-5" />} action={<SeeAll to="/tarefas" />}>
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.length ? <EmptyState title="Nenhuma tarefa pendente." /> :
        <ul className="divide-y divide-line/50">{q.data.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0"><p className="truncate font-medium">{t.titulo}</p><p className="truncate text-xs text-muted">{t.obra?.nome ?? "Sem obra"}</p></div>
            <Badge tone={t.prazo && t.prazo < isoDate(new Date()) ? "bad" : "muted"}>{t.prazo ? new Date(t.prazo + "T12:00").toLocaleDateString("pt-BR") : "Sem prazo"}</Badge>
          </li>))}
        </ul>}
    </Card>
  );
}



function ObrasDestaque() {
  const q = useList<Obra>("obras", { eq: { status: "em_andamento" }, order: [{ col: "valor_contratado", asc: false }], limit: 4 });
  return (
    <Card title="Obras em destaque" icon={<Building2 className="h-5 w-5" />} action={<SeeAll to="/obras" label="Ver todas" />}>
      {q.isLoading ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div> :
        q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !q.data?.length ? <EmptyState title="Nenhuma obra em andamento." action={<Link to="/obras?novo=1" className="text-sm text-pearl-soft">Cadastrar obra</Link>} /> :
            <div className="grid gap-3 sm:grid-cols-2">
              {q.data.map((o) => (
                <Link key={o.id} to={`/obras/${o.id}`} className="group flex overflow-hidden rounded-xl border border-line/70 bg-bg/40 transition hover:border-pearl/40">
                  <ObraCover o={o} className="h-auto w-28 shrink-0 transition duration-500 group-hover:scale-105" />
                  <div className="min-w-0 flex-1 p-3">
                    <p className="truncate text-sm font-semibold">{o.nome}</p>
                    <Badge tone={OBRA_STATUS[o.status].tone} className="mt-1.5">{OBRA_STATUS[o.status].label}</Badge>
                    <div className="mt-3 flex items-center gap-2"><Progress value={o.progresso} /><span className="text-xs tabular-nums text-ink/80">{Math.round(o.progresso)}%</span></div>
                  </div>
                </Link>
              ))}
            </div>}
    </Card>
  );
}

function Alertas({ d }: { d?: Row }) {
  const rows: { n: number; label: string; hint: string; tone: IconTone; icon: React.ReactNode; to: string; strong?: boolean }[] = [
    { n: d?.tarefas_vencidas ?? 0, label: "Tarefas vencidas", hint: "Requer atenção", tone: "bad", icon: <ListChecks className="h-3.5 w-3.5" />, to: "/tarefas?filtro=vencidas", strong: true },
    { n: d?.obras_atrasadas ?? 0, label: "Obras atrasadas", hint: "Revisar cronograma", tone: "warn", icon: <TriangleAlert className="h-3.5 w-3.5" />, to: "/obras?filtro=atrasadas" },
    { n: d?.orcamentos_pendentes ?? 0, label: "Orçamentos pendentes", hint: "Aguardando retorno", tone: "info", icon: <FileText className="h-3.5 w-3.5" />, to: "/orcamentos?status=enviado" },
    { n: d?.vistorias_pendentes ?? 0, label: "Vistorias pendentes", hint: "Programar", tone: "violet", icon: <ClipboardCheck className="h-3.5 w-3.5" />, to: "/vistorias" },
    { n: d?.laudos_pendentes ?? 0, label: "Laudos pendentes", hint: "Em análise", tone: "ok", icon: <FileBadge2 className="h-3.5 w-3.5" />, to: "/laudos" },
  ];
  if (d && d.receber_vencido > 0) rows.splice(1, 0, { n: 0, label: `A receber vencido: ${moneyShort(d.receber_vencido)}`, hint: "Cobrar", tone: "bad", icon: <Landmark className="h-3.5 w-3.5" />, to: "/financeiro?aba=receber", strong: true });
  return (
    <Card title="Alertas e pendências" icon={<TriangleAlert className="h-5 w-5" />} pad={false}>
      <ul className="divide-y divide-line/50 px-4 pb-2 pt-1">
        {rows.map((r) => (
          <li key={r.label}>
            <Link to={r.to} className="flex items-center gap-3 py-2.5 text-sm hover:text-pearl-soft">
              <IconTile tone={r.tone} size={26}>{r.icon}</IconTile>
              {r.n > 0 && <span className="w-5 font-semibold tabular-nums">{r.n}</span>}
              <span className="flex-1">{r.label}</span>
              <span className={clsx("text-xs", r.strong ? "text-red-400" : "text-muted")}>{r.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
