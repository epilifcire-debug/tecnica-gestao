import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { LAUDO_STATUS, opts } from "@/data/types";
import { date, pad, today } from "@/lib/format";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge, StatusBadge } from "@/components/ui/Feedback";
import { STAFF_PROFILES } from "./obra/obraConfig";

export default function Laudos() {
  const { role, userId } = useAuth();
  const gestor = isGestor(role);
  const hoje = today();
  return (
    <CrudPage table="laudos" singular="Laudo" title="Laudos e pareceres" eyebrow="Técnico" subtitle="Elaboração, revisão e entrega de laudos técnicos."
      canCreate={gestor} canEdit={(r) => gestor || r.responsavel_id === userId} canDelete={() => gestor}
      embed={["obra", "cliente", "responsavel"]} order={[{ col: "numero", asc: false }]} searchCols={["titulo", "tipo", "art_numero"]}
      filters={[{ value: "pendentes", label: "Pendentes", opts: { in: { status: ["em_elaboracao", "em_revisao"] } } }, { value: "concluidos", label: "Concluídos", opts: { in: { status: ["concluido", "entregue"] } } }, { value: "todos", label: "Todos" }]}
      columns={[
        { key: "numero", label: "Nº", mobile: "hide", render: (r) => <span className="text-muted tabular-nums">{pad(r.numero, 4)}</span> },
        { key: "titulo", label: "Laudo", mobile: "title", render: (r) => <span className="font-medium">{r.titulo}</span> },
        { key: "tipo", label: "Tipo", mobile: "sub" },
        { key: "prazo", label: "Prazo / Emissão", mobile: "meta", render: (r) => r.data_emissao ? `Emitido ${date(r.data_emissao)}` : r.prazo_entrega ? <span className={r.prazo_entrega < hoje ? "text-red-400" : ""}>Prazo {date(r.prazo_entrega)}</span> : "—" },
        { key: "responsavel", label: "Responsável", mobile: "meta", render: (r) => r.responsavel?.nome ?? "—" },
        { key: "status", label: "Status", mobile: "badge", render: (r) => <span className="flex gap-1"><StatusBadge map={LAUDO_STATUS} value={r.status} />{r.visivel_cliente && <Badge tone="gold">Portal</Badge>}</span> },
      ]}
      defaults={{ status: "em_elaboracao", tipo: "Laudo de inspeção predial" }}
      fields={[
        { name: "titulo", label: "Título", required: true, col: 2 },
        { name: "tipo", label: "Tipo", type: "select", required: true, options: ["Laudo de inspeção predial", "Laudo elétrico", "Laudo de estabilidade", "Laudo de vistoria cautelar", "Parecer técnico", "Relatório técnico"].map((v) => ({ value: v, label: v })) },
        { name: "status", label: "Status", type: "select", required: true, options: opts(LAUDO_STATUS) },
        { name: "obra_id", label: "Obra", type: "ref", ref: { table: "obras" }, disabled: () => !gestor },
        { name: "cliente_id", label: "Cliente", type: "ref", ref: { table: "clientes" }, disabled: () => !gestor },
        { name: "responsavel_id", label: "Responsável técnico", type: "ref", ref: STAFF_PROFILES, disabled: () => !gestor },
        { name: "art_numero", label: "Nº da ART/RRT" },
        { name: "prazo_entrega", label: "Prazo de entrega", type: "date" },
        { name: "data_emissao", label: "Data de emissão", type: "date" },
        { name: "conteudo", label: "Conteúdo / constatações", type: "textarea" },
        { name: "conclusao", label: "Conclusão", type: "textarea" },
        { name: "visivel_cliente", label: "Disponibilizar no Portal do Cliente (quando concluído)", type: "switch", disabled: () => !gestor },
      ]}
    />
  );
}
