import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { CalendarDays, Check, Clock, MapPin, Plus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import type { Row } from "@/data/types";
import { COMPROMISSO_TIPO } from "@/data/types";
import { addDays, isoDate, time } from "@/lib/format";
import { useList, useSave } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { PageHeader, Tabs } from "@/components/ui/Layout";
import { Badge } from "@/components/ui/Feedback";
import { EmptyState, QueryView } from "@/components/ui/States";
import { CrudForm } from "@/components/crud/CrudPage";
import type { FieldDef } from "@/components/crud/FormFields";
import { STAFF_PROFILES } from "./obra/obraConfig";

export default function Agenda() {
  const { role, userId } = useAuth();
  const gestor = isGestor(role);
  const [params, setParams] = useSearchParams();
  const [aba, setAba] = useState<"proximos" | "meus" | "passados">("proximos");
  const [edit, setEdit] = useState<Row | null>(null);
  useEffect(() => { if (params.get("novo")) { setEdit({}); params.delete("novo"); setParams(params, { replace: true }); } }, []); // eslint-disable-line
  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
  const opts = aba === "passados"
    ? { lt: { inicio: hoje0.toISOString() }, order: [{ col: "inicio", asc: false }], limit: 60 }
    : { gte: { inicio: hoje0.toISOString() }, lte: { inicio: addDays(hoje0, 90).toISOString() }, order: [{ col: "inicio" }], ...(aba === "meus" ? { eq: { responsavel_id: userId } } : {}) };
  const q = useList<Row>("compromissos", { ...opts, embed: ["obra", "cliente", "responsavel"] });
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    (q.data ?? []).forEach((c) => { const k = isoDate(new Date(c.inicio)); m.set(k, [...(m.get(k) ?? []), c]); });
    return [...m.entries()];
  }, [q.data]);
  const done = useSave((c: Row) => api().update("compromissos", c.id, { concluido: !c.concluido }), { invalidate: ["compromissos"] });

  const fields: FieldDef[] = [
    { name: "titulo", label: "Título", required: true, col: 2 },
    { name: "tipo", label: "Tipo", type: "select", required: true, options: Object.entries(COMPROMISSO_TIPO).map(([value, label]) => ({ value, label })) },
    { name: "inicio", label: "Início", type: "datetime", required: true },
    { name: "fim", label: "Término", type: "datetime", validate: (v, a) => (v && a.inicio && v < a.inicio ? "Deve ser após o início." : null) },
    { name: "local", label: "Local" },
    { name: "obra_id", label: "Obra", type: "ref", ref: { table: "obras" } },
    { name: "cliente_id", label: "Cliente", type: "ref", ref: { table: "clientes" }, hidden: () => !gestor },
    { name: "responsavel_id", label: "Responsável", type: "ref", ref: STAFF_PROFILES, disabled: () => !gestor },
    { name: "observacoes", label: "Observações", type: "textarea" },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Agenda" title="Compromissos" subtitle="Visitas técnicas, reuniões, vistorias e entregas." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({})}>Novo compromisso</Button>} />
      <Tabs value={aba} onChange={setAba} className="mb-4" items={[{ value: "proximos", label: "Próximos 90 dias" }, { value: "meus", label: "Meus" }, { value: "passados", label: "Anteriores" }]} />
      <QueryView q={q} empty={<EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nenhum compromisso neste período." />}>
        {() => (
          <div className="space-y-5">
            {groups.map(([d, list]) => {
              const dt = new Date(d + "T12:00");
              const isHoje = d === isoDate(new Date());
              return (
                <section key={d}>
                  <h2 className={clsx("mb-2 flex items-center gap-2 text-sm font-semibold", isHoje && "text-gold-soft")}>
                    {dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).replace(/^\w/, (c) => c.toUpperCase())}{isHoje && <Badge tone="gold">Hoje</Badge>}
                  </h2>
                  <ul className="space-y-2">
                    {list.map((c) => (
                      <li key={c.id} className={clsx("card flex items-center gap-3 p-3.5", c.concluido && "opacity-60")}>
                        <button onClick={() => done.mutate(c)} aria-label={c.concluido ? "Reabrir" : "Concluir"} disabled={!gestor && c.responsavel_id !== userId && c.created_by !== userId}
                          className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full border", c.concluido ? "border-ok bg-ok/20 text-ok" : "border-line text-transparent hover:text-muted")}><Check className="h-4 w-4" /></button>
                        <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(c)}>
                          <p className={clsx("truncate font-medium", c.concluido && "line-through")}>{c.titulo}</p>
                          <p className="flex flex-wrap gap-x-3 text-[12.5px] text-muted">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{time(c.inicio)}{c.fim ? `–${time(c.fim)}` : ""}</span>
                            {(c.obra || c.cliente) && <span>{c.obra ? `Obra: ${c.obra.nome}` : `Cliente: ${c.cliente.nome}`}</span>}
                            {c.local && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.local}</span>}
                            {c.responsavel && <span>{c.responsavel.nome}</span>}
                          </p>
                        </button>
                        <Badge className="hidden sm:inline-flex">{COMPROMISSO_TIPO[c.tipo as keyof typeof COMPROMISSO_TIPO]}</Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </QueryView>
      <CrudForm c={{ table: "compromissos", singular: "Compromisso", title: "", columns: [], fields, defaults: () => { const d = new Date(); d.setMinutes(0); d.setHours(d.getHours() + 1); return { tipo: "visita_tecnica", inicio: d.toISOString(), responsavel_id: userId }; },
        beforeSave: (p, isNew) => (isNew && !gestor ? { ...p, responsavel_id: userId } : p) }} row={edit} onClose={() => setEdit(null)} />
    </div>
  );
}
