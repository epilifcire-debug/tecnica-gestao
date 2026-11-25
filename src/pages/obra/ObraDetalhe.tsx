import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Pencil, Ruler, User, Building, CircleDollarSign, ClipboardList } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { useGet, useList } from "@/lib/hooks";
import type { Obra, Row } from "@/data/types";
import { OBRA_STATUS } from "@/data/types";
import { date, money, today } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Tabs, Card } from "@/components/ui/Layout";
import { Badge, Progress, Skeleton } from "@/components/ui/Feedback";
import { ErrorState, NoPermission } from "@/components/ui/States";
import { CrudForm } from "@/components/crud/CrudPage";
import { ObraCover } from "@/components/ObraCover";
import { OBRA_FIELDS } from "./obraConfig";
import { CronogramaTab } from "./CronogramaTab";
import { RdoTab } from "./RdoTab";
import { FotosTab } from "./FotosTab";
import { FinanceiroObraTab } from "./FinanceiroObraTab";
import { DocsTab } from "./DocsTab";
import { EquipeTab } from "./EquipeTab";
import TarefasObra from "../Tarefas";

type T = "resumo" | "cronograma" | "rdo" | "fotos" | "tarefas" | "financeiro" | "docs" | "equipe";

export default function ObraDetalhe() {
  const { id } = useParams();
  const { role } = useAuth();
  const gestor = isGestor(role);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("aba") as T) || "resumo";
  const setTab = (t: T) => { params.set("aba", t); setParams(params, { replace: true }); };
  const q = useGet<Obra>("obras", id, ["cliente", "responsavel"]);
  const [edit, setEdit] = useState<Row | null>(null);

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64" /></div>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <NoPermission />;
  const o = q.data;
  const atrasada = o.status === "em_andamento" && !!o.previsao_termino && o.previsao_termino < today() && o.progresso < 100;

  const tabs: { value: T; label: string }[] = [
    { value: "resumo", label: "Resumo" }, { value: "cronograma", label: "Cronograma" }, { value: "rdo", label: "RDO" },
    { value: "fotos", label: "Fotos" }, { value: "tarefas", label: "Tarefas" },
    ...(gestor ? [{ value: "financeiro" as T, label: "Financeiro" }] : []),
    { value: "docs", label: "Documentos" }, { value: "equipe", label: "Equipe" },
  ];

  return (
    <div className="animate-fade-up">
      <button onClick={() => (window.history.length > 1 ? nav(-1) : nav("/obras"))} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Obras</button>

      <section className="card relative mb-5 overflow-hidden">
        <div className="relative h-44 sm:h-56">
          <ObraCover o={o} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5"><Badge tone={OBRA_STATUS[o.status].tone}>{OBRA_STATUS[o.status].label}</Badge>{atrasada && <Badge tone="bad">Atrasada</Badge>}<Badge>#{o.codigo}</Badge></div>
              <h1 className="truncate text-2xl font-bold sm:text-3xl">{o.nome}</h1>
              {o.endereco && <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/80"><MapPin className="h-3.5 w-3.5" />{o.endereco}{o.cidade ? ` — ${o.cidade}/${o.uf ?? ""}` : ""}</p>}
            </div>
            <div className="flex gap-2">
              <Link to={`/obras/${o.id}/rdo/novo`}><Button variant="secondary" size="sm" icon={<ClipboardList className="h-4 w-4" />}>Novo RDO</Button></Link>
              {gestor && <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(o)}>Editar</Button>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-line/60 px-4 py-3 sm:px-5">
          <span className="text-sm text-muted">Andamento geral</span><Progress value={o.progresso} className="flex-1" /><span className="text-sm font-semibold tabular-nums">{Math.round(o.progresso)}%</span>
        </div>
      </section>

      <Tabs value={tab} onChange={setTab} items={tabs} className="mb-4" />

      {tab === "resumo" && <Resumo o={o} gestor={gestor} />}
      {tab === "cronograma" && <CronogramaTab obra={o} />}
      {tab === "rdo" && <RdoTab obra={o} />}
      {tab === "fotos" && <FotosTab obra={o} />}
      {tab === "tarefas" && <TarefasObra obraId={o.id} />}
      {tab === "financeiro" && gestor && <FinanceiroObraTab obra={o} />}
      {tab === "docs" && <DocsTab obra={o} />}
      {tab === "equipe" && <EquipeTab obra={o} />}

      <CrudForm c={{ table: "obras", singular: "Obra", title: "Obras", columns: [], fields: OBRA_FIELDS }} row={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function Info({ icon, k, v }: { icon: React.ReactNode; k: string; v: React.ReactNode }) {
  return <div className="flex gap-3"><span className="mt-0.5 text-pearl">{icon}</span><div><p className="text-[12px] text-muted">{k}</p><p className="text-[14.5px]">{v || "—"}</p></div></div>;
}

function Resumo({ o, gestor }: { o: Obra; gestor: boolean }) {
  const rdos = useList<Row>("rdos", { eq: { obra_id: o.id }, order: [{ col: "data", asc: false }], limit: 5 });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card title="Dados da obra">
        <div className="grid gap-4 sm:grid-cols-2">
          <Info icon={<User className="h-4 w-4" />} k="Cliente" v={o.cliente?.nome} />
          <Info icon={<User className="h-4 w-4" />} k="Engenheiro responsável" v={o.responsavel?.nome} />
          <Info icon={<Building className="h-4 w-4" />} k="Tipo" v={o.tipo} />
          <Info icon={<Ruler className="h-4 w-4" />} k="Área" v={o.area_m2 ? `${Number(o.area_m2).toLocaleString("pt-BR")} m²` : null} />
          <Info icon={<CalendarDays className="h-4 w-4" />} k="Início" v={date(o.data_inicio)} />
          <Info icon={<CalendarDays className="h-4 w-4" />} k="Previsão de término" v={date(o.previsao_termino)} />
          {gestor && <Info icon={<CircleDollarSign className="h-4 w-4" />} k="Valor contratado" v={money(o.valor_contratado)} />}
        </div>
        {o.descricao && <p className="mt-4 whitespace-pre-line border-t border-line/60 pt-4 text-sm text-ink/85">{o.descricao}</p>}
      </Card>
      <Card title="Últimas atualizações">
        {rdos.isLoading ? <Skeleton className="h-32" /> : !rdos.data?.length ? <p className="py-6 text-center text-sm text-muted">Nenhum RDO registrado ainda.</p> :
          <ol className="relative space-y-4 border-l border-line pl-5">
            {rdos.data.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-pearl ring-4 ring-surface" />
                <Link to={`/obras/${o.id}/rdo/${r.id}`} className="block hover:text-pearl-soft">
                  <p className="text-[12px] text-muted">{date(r.data)}</p>
                  <p className="line-clamp-2 text-sm">{r.servicos_executados || "RDO sem descrição de serviços"}</p>
                </Link>
              </li>
            ))}
          </ol>}
      </Card>
    </div>
  );
}
