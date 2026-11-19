import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import type { Obra, Row } from "@/data/types";
import { ETAPA_STATUS } from "@/data/types";
import { useList, useSave } from "@/lib/hooks";
import { date, parseDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Layout";
import { Progress, StatusBadge } from "@/components/ui/Feedback";
import { EmptyState, QueryView } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/Modal";
import { CrudForm } from "@/components/crud/CrudPage";
import type { FieldDef } from "@/components/crud/FormFields";

const FIELDS: FieldDef[] = [
  { name: "nome", label: "Etapa", required: true, col: 2 },
  { name: "ordem", label: "Ordem", type: "number", min: 0 },
  { name: "peso", label: "Peso no andamento", type: "number", min: 0.1, hint: "Etapas mais pesadas contam mais no % geral.", required: true },
  { name: "inicio_previsto", label: "Início previsto", type: "date" },
  { name: "fim_previsto", label: "Fim previsto", type: "date", validate: (v, a) => (v && a.inicio_previsto && v < a.inicio_previsto ? "Deve ser após o início." : null) },
  { name: "percentual", label: "Realizado (%)", type: "number", min: 0, max: 100, required: true },
  { name: "observacoes", label: "Observações", type: "textarea" },
];

/** % planejado para hoje, pela posição no intervalo previsto */
function planejado(e: Row) {
  const i = parseDate(e.inicio_previsto), f = parseDate(e.fim_previsto);
  if (!i || !f) return 0;
  const n = Date.now();
  if (n <= i.getTime()) return 0;
  if (n >= f.getTime()) return 100;
  return Math.round(((n - i.getTime()) / (f.getTime() - i.getTime())) * 100);
}

export function CronogramaTab({ obra }: { obra: Obra }) {
  const { role } = useAuth();
  const gestor = isGestor(role);
  const [modo, setModo] = useState<"realizado" | "planejado">("realizado");
  const [edit, setEdit] = useState<Row | null>(null);
  const confirm = useConfirm();
  const q = useList<Row>("obra_etapas", { eq: { obra_id: obra.id }, order: [{ col: "ordem" }] });
  const upd = useSave((a: { id: string; percentual: number }) => api().update("obra_etapas", a.id, { percentual: a.percentual }), { invalidate: ["obra_etapas", "obras"], success: "Andamento atualizado." });
  const del = useSave((id: string) => api().remove("obra_etapas", id), { invalidate: ["obra_etapas", "obras"], success: "Etapa removida." });

  return (
    <Card title="Cronograma" action={
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5 text-sm">
          {(["planejado", "realizado"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)} aria-pressed={modo === m} className={clsx("h-8 rounded-md px-3 capitalize", modo === m ? "bg-ink text-bg font-semibold" : "text-muted")}>{m === "planejado" ? "Planejado" : "Realizado"}</button>
          ))}
        </div>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ ordem: (q.data?.length ?? 0) + 1 })}>Etapa</Button>
      </div>}>
      <QueryView q={q} empty={<EmptyState title="Nenhuma etapa cadastrada." text="Cadastre as etapas para acompanhar o andamento planejado × realizado." />}>
        {(rows) => (
          <ul className="divide-y divide-line/50">
            {rows.map((e) => {
              const v = modo === "realizado" ? Number(e.percentual) : planejado(e);
              const atraso = modo === "realizado" && planejado(e) - Number(e.percentual) > 15;
              return (
                <li key={e.id} className="grid gap-2 py-3.5 sm:grid-cols-[220px_1fr_auto] sm:items-center sm:gap-5">
                  <button className="text-left" onClick={() => setEdit(e)}>
                    <p className="font-medium">{e.nome}</p>
                    <p className="text-[12px] text-muted">{date(e.inicio_previsto)} → {date(e.fim_previsto)}</p>
                  </button>
                  <div className="flex items-center gap-3">
                    <Progress value={v} tone={v >= 100 ? "ok" : atraso ? "bad" : "gold"} className="h-2" />
                    <span className="w-11 text-right text-sm font-semibold tabular-nums">{v}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge map={ETAPA_STATUS} value={e.status} />
                    {modo === "realizado" && (
                      <select aria-label={`Atualizar ${e.nome}`} className="input h-9 w-[92px]" value={Number(e.percentual)} disabled={upd.isPending}
                        onChange={(ev) => upd.mutate({ id: e.id, percentual: Number(ev.target.value) })}>
                        {Array.from(new Set([...Array.from({ length: 11 }, (_, i) => i * 10), Number(e.percentual)])).sort((a, b) => a - b).map((p) => <option key={p} value={p}>{p}%</option>)}
                      </select>
                    )}
                    {gestor && <button aria-label={`Excluir etapa ${e.nome}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-red-300"
                      onClick={async () => (await confirm({ title: "Excluir etapa?", text: `A etapa “${e.nome}” será removida do cronograma.`, danger: true, confirm: "Excluir" })) && del.mutate(e.id)}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QueryView>
      <CrudForm c={{ table: "obra_etapas", singular: "Etapa", title: "", columns: [], fields: FIELDS, defaults: { peso: 1, percentual: 0 }, beforeSave: (p, isNew) => (isNew ? { ...p, obra_id: obra.id } : p) }}
        row={edit} onClose={() => setEdit(null)} />
    </Card>
  );
}
