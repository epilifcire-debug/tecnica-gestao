import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, MapPin, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { useDebounced, useList } from "@/lib/hooks";
import type { Obra, ObraStatus } from "@/data/types";
import { OBRA_STATUS } from "@/data/types";
import { today, date } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { PageHeader, Tabs } from "@/components/ui/Layout";
import { Badge, Progress } from "@/components/ui/Feedback";
import { EmptyState, QueryView } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { CrudForm } from "@/components/crud/CrudPage";
import { ObraCover } from "@/components/ObraCover";
import { OBRA_DEFAULTS, OBRA_FIELDS } from "./obra/obraConfig";

type Tab = "todas" | "em_andamento" | "orcamento" | "concluida" | "atrasadas";

export default function Obras() {
  const { role } = useAuth();
  const gestor = isGestor(role);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("filtro") === "atrasadas" ? "atrasadas" : (params.get("status") as Tab)) || "todas");
  const [term, setTerm] = useState("");
  const t = useDebounced(term);
  const [novo, setNovo] = useState<Record<string, unknown> | null>(null);
  const [pickRdo, setPickRdo] = useState(params.get("acao") === "rdo");

  useEffect(() => { if (params.get("novo") && gestor) { setNovo({}); } if (params.has("novo") || params.has("acao")) { params.delete("novo"); params.delete("acao"); setParams(params, { replace: true }); } }, []); // eslint-disable-line

  const q = useList<Obra>("obras", { embed: ["cliente"], order: [{ col: "created_at", asc: false }], search: t ? { cols: ["nome", "endereco"], term: t } : undefined });
  const all = q.data ?? [];
  const hoje = today();
  const filtro = (o: Obra) =>
    tab === "todas" ? true : tab === "orcamento" ? ["orcamento", "planejamento"].includes(o.status)
      : tab === "atrasadas" ? o.status === "em_andamento" && !!o.previsao_termino && o.previsao_termino < hoje && o.progresso < 100
        : o.status === tab;
  const rows = useMemo(() => all.filter(filtro), [all, tab]); // eslint-disable-line
  const count = (k: Tab) => all.filter((o) => (k === "todas" ? true : k === "orcamento" ? ["orcamento", "planejamento"].includes(o.status) : k === "atrasadas" ? o.status === "em_andamento" && !!o.previsao_termino && o.previsao_termino < hoje && o.progresso < 100 : o.status === k)).length;

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Gestão de obras" title="Obras" subtitle="Acompanhe andamento, cronograma, RDO e financeiro de cada obra."
        actions={<>
          <Button variant="secondary" icon={<ClipboardList className="h-4 w-4" />} onClick={() => setPickRdo(true)}>Novo RDO</Button>
          {gestor && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setNovo({})}>Nova obra</Button>}
        </>} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={tab} onChange={setTab} items={[
          { value: "todas", label: "Todas", count: count("todas") }, { value: "em_andamento", label: "Em andamento", count: count("em_andamento") },
          { value: "orcamento", label: "Em orçamento", count: count("orcamento") }, { value: "concluida", label: "Concluídas", count: count("concluida") },
          { value: "atrasadas", label: "Atrasadas", count: count("atrasadas") },
        ]} />
        <div className="relative md:ml-auto md:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input h-10 pl-10" placeholder="Buscar obra ou endereço…" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Buscar obras" />
        </div>
      </div>

      <QueryView q={{ ...q, data: rows }} empty={<EmptyState icon={<SlidersHorizontal className="h-6 w-6" />} title={all.length ? "Nenhuma obra neste filtro." : "Nenhuma obra cadastrada."}
        action={gestor && !all.length ? <Button size="sm" variant="secondary" onClick={() => setNovo({})}>Cadastrar obra</Button> : undefined} />}>
        {(list) => (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((o) => {
              const atrasada = o.status === "em_andamento" && !!o.previsao_termino && o.previsao_termino < hoje && o.progresso < 100;
              return (
                <li key={o.id}>
                  <Link to={`/obras/${o.id}`} className="card group flex gap-3 overflow-hidden p-3 transition hover:border-pearl/40">
                    <ObraCover o={o} className="h-24 w-24 shrink-0 rounded-xl transition duration-500 group-hover:scale-[1.03]" />
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold">{o.nome}</p>
                        <span className="text-sm font-semibold tabular-nums text-pearl-soft">{Math.round(o.progresso)}%</span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted"><MapPin className="h-3 w-3 shrink-0" />{o.endereco || o.cliente?.nome || "—"}</p>
                      <Progress value={o.progresso} className="mt-2.5" />
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={OBRA_STATUS[o.status as ObraStatus].tone}>{OBRA_STATUS[o.status as ObraStatus].label}</Badge>
                        {atrasada && <Badge tone="bad">Atrasada</Badge>}
                        {o.previsao_termino && <span className="text-[11.5px] text-muted">Término {date(o.previsao_termino)}</span>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </QueryView>

      <CrudForm c={{ table: "obras", singular: "Obra", title: "Obras", columns: [], fields: OBRA_FIELDS, defaults: OBRA_DEFAULTS }} row={novo} onClose={() => setNovo(null)} />

      <Modal open={pickRdo} onClose={() => setPickRdo(false)} title="Novo RDO — escolha a obra" size="sm">
        {!all.filter((o) => o.status === "em_andamento").length ? <EmptyState title="Nenhuma obra em andamento disponível." /> :
          <ul className="space-y-2">
            {all.filter((o) => o.status === "em_andamento").map((o) => (
              <li key={o.id}><button className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left hover:border-pearl/50" onClick={() => nav(`/obras/${o.id}/rdo/novo`)}>
                <ObraCover o={o} className="h-10 w-10 rounded-lg" /><span className="flex-1 truncate text-sm font-medium">{o.nome}</span>
              </button></li>
            ))}
          </ul>}
      </Modal>
    </div>
  );
}
