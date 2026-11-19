import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import { VISTORIA_STATUS, opts } from "@/data/types";
import { dateTime } from "@/lib/format";
import { useSave } from "@/lib/hooks";
import { CrudPage, MenuItem } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/ui/Feedback";
import { STAFF_PROFILES } from "./obra/obraConfig";

export default function Vistorias() {
  const { role, userId } = useAuth();
  const gestor = isGestor(role);
  const realizar = useSave((id: string) => api().update("vistorias", id, { status: "realizada", realizada_em: new Date().toISOString() }), { invalidate: ["vistorias"], success: "Vistoria marcada como realizada." });
  return (
    <CrudPage table="vistorias" singular="Vistoria" title="Vistorias" eyebrow="Técnico" subtitle="Agenda e registro das vistorias técnicas."
      canCreate={gestor} canEdit={(r) => gestor || r.responsavel_id === userId} canDelete={() => gestor}
      embed={["obra", "cliente", "responsavel"]} order={[{ col: "data_agendada" }]} searchCols={["tipo", "endereco"]}
      filters={[{ value: "agendadas", label: "Agendadas", opts: { eq: { status: "agendada" } } }, { value: "realizadas", label: "Realizadas", opts: { eq: { status: "realizada" } } }, { value: "todas", label: "Todas" }]}
      columns={[
        { key: "tipo", label: "Vistoria", mobile: "title", render: (r) => <span className="font-medium">{r.tipo}</span> },
        { key: "obra", label: "Obra / Cliente", mobile: "sub", render: (r) => r.obra?.nome ?? r.cliente?.nome ?? r.endereco ?? "—" },
        { key: "data_agendada", label: "Data", mobile: "meta", render: (r) => dateTime(r.data_agendada) },
        { key: "responsavel", label: "Responsável", mobile: "meta", render: (r) => r.responsavel?.nome ?? "—" },
        { key: "status", label: "Status", mobile: "badge", render: (r) => <StatusBadge map={VISTORIA_STATUS} value={r.status} /> },
      ]}
      defaults={{ status: "agendada", tipo: "Vistoria técnica" }}
      fields={[
        { name: "tipo", label: "Tipo", type: "select", required: true, options: ["Vistoria técnica", "Vistoria de recebimento", "Vistoria cautelar de vizinhança", "Entrega de chaves", "Inspeção predial", "Perícia"].map((v) => ({ value: v, label: v })) },
        { name: "data_agendada", label: "Data e hora", type: "datetime", required: true },
        { name: "obra_id", label: "Obra", type: "ref", ref: { table: "obras" }, disabled: () => !gestor },
        { name: "cliente_id", label: "Cliente", type: "ref", ref: { table: "clientes" }, disabled: () => !gestor },
        { name: "endereco", label: "Endereço (se fora de obra)", col: 2 },
        { name: "responsavel_id", label: "Responsável", type: "ref", ref: STAFF_PROFILES, disabled: () => !gestor },
        { name: "status", label: "Status", type: "select", required: true, options: opts(VISTORIA_STATUS) },
        { name: "relatorio", label: "Relatório / constatações", type: "textarea" },
      ]}
      extraActions={(r) => r.status === "agendada" && (gestor || r.responsavel_id === userId) ? <MenuItem icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => realizar.mutate(r.id)}>Marcar como realizada</MenuItem> : null}
    />
  );
}
