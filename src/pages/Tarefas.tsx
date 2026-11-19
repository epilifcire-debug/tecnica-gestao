import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import { PRIORIDADE, TAREFA_STATUS, opts } from "@/data/types";
import { date, today } from "@/lib/format";
import { useSave } from "@/lib/hooks";
import { CrudPage, MenuItem } from "@/components/crud/CrudPage";
import { Badge, StatusBadge } from "@/components/ui/Feedback";
import { STAFF_PROFILES } from "./obra/obraConfig";

export default function Tarefas({ obraId }: { obraId?: string }) {
  const { role, userId } = useAuth();
  const gestor = isGestor(role);
  const [params] = useSearchParams();
  const hoje = today();
  const concluir = useSave((id: string) => api().update("tarefas", id, { status: "concluida" }), { invalidate: ["tarefas"], success: "Tarefa concluída." });
  const filtros = [
    { value: "abertas", label: "Abertas", opts: { in: { status: ["pendente", "em_andamento"] } } },
    { value: "vencidas", label: "Vencidas", opts: { in: { status: ["pendente", "em_andamento"] }, lt: { prazo: hoje } } },
    { value: "minhas", label: "Minhas", opts: { eq: { responsavel_id: userId } } },
    { value: "concluidas", label: "Concluídas", opts: { eq: { status: "concluida" } } },
    { value: "todas", label: "Todas" },
  ];
  if (params.get("filtro") === "vencidas") filtros.unshift(filtros.splice(1, 1)[0]);
  return (
    <CrudPage table="tarefas" singular="Tarefa" title="Tarefas" eyebrow="Operação" subtitle="Pendências da equipe, por obra e responsável." hideHeader={!!obraId}
      baseOpts={obraId ? { eq: { obra_id: obraId } } : undefined}
      embed={["obra", "responsavel"]} order={[{ col: "prazo" }]} searchCols={obraId ? undefined : ["titulo"]}
      filters={filtros}
      canEdit={(r) => gestor || r.responsavel_id === userId || r.created_by === userId}
      canDelete={(r) => gestor || r.created_by === userId}
      columns={[
        { key: "titulo", label: "Tarefa", mobile: "title", render: (r) => <span className="font-medium">{r.titulo}</span> },
        ...(obraId ? [] : [{ key: "obra", label: "Obra", mobile: "sub" as const, render: (r: any) => r.obra?.nome ?? "Geral" }]),
        { key: "responsavel", label: "Responsável", mobile: "meta", render: (r) => r.responsavel?.nome ?? "—" },
        { key: "prazo", label: "Prazo", mobile: "meta", render: (r) => <span className={r.prazo && r.prazo < hoje && ["pendente", "em_andamento"].includes(r.status) ? "font-semibold text-red-400" : ""}>{date(r.prazo)}</span> },
        { key: "prioridade", label: "Prioridade", mobile: "hide", render: (r) => <StatusBadge map={PRIORIDADE} value={r.prioridade} /> },
        { key: "status", label: "Status", mobile: "badge", render: (r) => r.prazo && r.prazo < hoje && ["pendente", "em_andamento"].includes(r.status) ? <Badge tone="bad">Vencida</Badge> : <StatusBadge map={TAREFA_STATUS} value={r.status} /> },
      ]}
      defaults={() => ({ status: "pendente", prioridade: "media", obra_id: obraId ?? "", responsavel_id: userId ?? "" })}
      fields={[
        { name: "titulo", label: "Título", required: true, col: 2 },
        { name: "obra_id", label: "Obra", type: "ref", ref: { table: "obras", placeholder: "Sem obra (geral)" }, disabled: () => !!obraId },
        { name: "responsavel_id", label: "Responsável", type: "ref", ref: STAFF_PROFILES, disabled: () => !gestor },
        { name: "prazo", label: "Prazo", type: "date" },
        { name: "prioridade", label: "Prioridade", type: "select", required: true, options: opts(PRIORIDADE) },
        { name: "status", label: "Status", type: "select", required: true, options: opts(TAREFA_STATUS) },
        { name: "descricao", label: "Descrição", type: "textarea" },
      ]}
      beforeSave={(p, isNew) => ({ ...p, ...(obraId && isNew ? { obra_id: obraId } : {}), ...(!gestor && isNew ? { responsavel_id: userId } : {}) })}
      extraActions={(r) => r.status !== "concluida" && (gestor || r.responsavel_id === userId) ? <MenuItem icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => concluir.mutate(r.id)}>Concluir</MenuItem> : null}
    />
  );
}
