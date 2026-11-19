import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/ui/Feedback";
import { CONTRATO_STATUS, opts } from "@/data/types";
import { date, money, pad } from "@/lib/format";

export default function Contratos() {
  return (
    <CrudPage table="contratos" singular="Contrato" title="Contratos" eyebrow="Comercial" subtitle="Contratos firmados com clientes, vigência e valores."
      embed={["cliente", "obra"]} order={[{ col: "numero", asc: false }]} searchCols={["objeto"]}
      filters={[{ value: "todos", label: "Todos" }, { value: "vigente", label: "Vigentes", opts: { eq: { status: "vigente" } } }, { value: "rascunho", label: "Rascunhos", opts: { eq: { status: "rascunho" } } }, { value: "concluido", label: "Concluídos", opts: { eq: { status: "concluido" } } }]}
      columns={[
        { key: "numero", label: "Nº", mobile: "hide", render: (r) => <span className="tabular-nums text-muted">{pad(r.numero)}</span> },
        { key: "objeto", label: "Objeto", mobile: "title", render: (r) => <span className="font-medium">{r.objeto}</span> },
        { key: "cliente", label: "Cliente", mobile: "sub", render: (r) => r.cliente?.nome ?? "—" },
        { key: "valor", label: "Valor", mobile: "meta", render: (r) => <span className="tabular-nums">{money(r.valor)}</span> },
        { key: "vigencia", label: "Vigência", mobile: "meta", render: (r) => `${date(r.inicio_vigencia)} – ${date(r.fim_vigencia)}` },
        { key: "status", label: "Status", mobile: "badge", render: (r) => <StatusBadge map={CONTRATO_STATUS} value={r.status} /> },
      ]}
      defaults={{ status: "rascunho" }}
      fields={[
        { name: "objeto", label: "Objeto do contrato", required: true, col: 2 },
        { name: "cliente_id", label: "Cliente", type: "ref", required: true, ref: { table: "clientes" } },
        { name: "obra_id", label: "Obra", type: "ref", ref: { table: "obras" } },
        { name: "valor", label: "Valor (R$)", type: "money", required: true },
        { name: "status", label: "Status", type: "select", required: true, options: opts(CONTRATO_STATUS) },
        { name: "data_assinatura", label: "Data de assinatura", type: "date" },
        { name: "inicio_vigencia", label: "Início da vigência", type: "date" },
        { name: "fim_vigencia", label: "Fim da vigência", type: "date", validate: (v, a) => (v && a.inicio_vigencia && v < a.inicio_vigencia ? "Deve ser após o início." : null) },
        { name: "observacoes", label: "Observações", type: "textarea" },
      ]}
    />
  );
}
