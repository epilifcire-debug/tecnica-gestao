import { useNavigate, useSearchParams } from "react-router-dom";
import { Copy, Plus } from "lucide-react";
import { api } from "@/data/api";
import { ORC_STATUS } from "@/data/types";
import { date, money, pad, today } from "@/lib/format";
import { useSave } from "@/lib/hooks";
import { CrudPage, MenuItem } from "@/components/crud/CrudPage";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Feedback";

export default function Orcamentos() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const hoje = today();
  const dup = useSave((id: string) => api().rpc<string>("duplicar_orcamento", { p_orcamento: id }), { invalidate: ["orcamentos"], success: "Cópia criada.", onDone: (id) => nav(`/orcamentos/${id}`) });
  const filtros = [
    { value: "todos", label: "Todos" },
    { value: "enviado", label: "Aguardando retorno", opts: { eq: { status: "enviado" } } },
    { value: "rascunho", label: "Rascunhos", opts: { eq: { status: "rascunho" } } },
    { value: "aprovado", label: "Aprovados", opts: { eq: { status: "aprovado" } } },
    { value: "recusado", label: "Recusados", opts: { eq: { status: "recusado" } } },
  ];
  const st = params.get("status");
  if (st) { const i = filtros.findIndex((f) => f.value === st); if (i > 0) filtros.unshift(filtros.splice(i, 1)[0]); }
  return (
    <CrudPage table="orcamentos" singular="Orçamento" title="Orçamentos" eyebrow="Comercial" subtitle="Propostas com itens, PDF e envio por WhatsApp ou e-mail."
      canCreate={false} canEdit={() => false} canDelete={(r) => r.status === "rascunho"}
      headerActions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => nav("/orcamentos/novo")}>Novo orçamento</Button>}
      embed={["cliente", "obra"]} order={[{ col: "numero", asc: false }]} searchCols={["titulo"]} filters={filtros}
      onRowClick={(r) => nav(`/orcamentos/${r.id}`)}
      columns={[
        { key: "numero", label: "Nº", mobile: "hide", render: (r) => <span className="tabular-nums text-muted">{pad(r.numero)}</span> },
        { key: "titulo", label: "Orçamento", mobile: "title", render: (r) => <span className="font-medium">{r.titulo}</span> },
        { key: "cliente", label: "Cliente", mobile: "sub", render: (r) => r.cliente?.nome ?? "—" },
        { key: "total", label: "Total", mobile: "meta", render: (r) => <span className="font-semibold tabular-nums">{money(r.total)}</span> },
        { key: "validade", label: "Validade", mobile: "meta", render: (r) => date(r.validade) },
        { key: "status", label: "Status", mobile: "badge", render: (r) => r.status === "enviado" && r.validade && r.validade < hoje ? <Badge tone="warn">Vencido</Badge> : <StatusBadge map={ORC_STATUS} value={r.status} /> },
      ]}
      fields={[]}
      extraActions={(r) => <MenuItem icon={<Copy className="h-4 w-4" />} onClick={() => dup.mutate(r.id)}>Duplicar</MenuItem>}
    />
  );
}
