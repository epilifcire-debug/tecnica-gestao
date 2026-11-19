import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, History } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import type { Row } from "@/data/types";
import { useList, useSave } from "@/lib/hooks";
import { dateTime, money, number } from "@/lib/format";
import { CrudPage, MenuItem } from "@/components/crud/CrudPage";
import { Badge } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormGrid, toPayload, validate, type FieldDef } from "@/components/crud/FormFields";

const MOV_FIELDS = (gestor: boolean): FieldDef[] => [
  { name: "tipo", label: "Tipo", type: "select", required: true, options: gestor ? [{ value: "entrada", label: "Entrada (compra)" }, { value: "saida", label: "Saída (uso em obra)" }, { value: "ajuste", label: "Ajuste de inventário (±)" }] : [{ value: "saida", label: "Saída (uso em obra)" }] },
  { name: "quantidade", label: "Quantidade", type: "number", required: true, validate: (v, a) => (Number(v) === 0 ? "Informe a quantidade." : a.tipo !== "ajuste" && Number(v) < 0 ? "Use valor positivo." : null) },
  { name: "obra_id", label: "Obra", type: "ref", ref: { table: "obras", opts: { eq: { status: "em_andamento" } } }, required: !gestor, hidden: (a) => a.tipo === "entrada" },
  { name: "custo_unitario", label: "Custo unitário (R$)", type: "money", hidden: (a) => a.tipo !== "entrada" },
  { name: "observacao", label: "Observação / NF", col: 2 },
];

export default function Materiais() {
  const { role } = useAuth();
  const gestor = isGestor(role);
  const [mov, setMov] = useState<{ m: Row; tipo: string } | null>(null);
  const [hist, setHist] = useState<Row | null>(null);
  return (
    <>
      <CrudPage table="materiais" singular="Material" title="Materiais" eyebrow="Estoque" subtitle="Controle de estoque com entradas, saídas por obra e alerta de mínimo."
        canCreate={gestor} canEdit={() => gestor} canDelete={() => gestor}
        searchCols={["nome", "categoria"]} order={[{ col: "nome" }]} embed={["fornecedor"]}
        filters={[{ value: "todos", label: "Todos" }, { value: "baixo", label: "Abaixo do mínimo" }]}
        columns={[
          { key: "nome", label: "Material", mobile: "title", render: (r) => <span className="font-medium">{r.nome}</span> },
          { key: "categoria", label: "Categoria", mobile: "sub" },
          { key: "estoque_atual", label: "Estoque", mobile: "meta", render: (r) => <span className="tabular-nums">{number(r.estoque_atual)} {r.unidade}</span> },
          { key: "estoque_minimo", label: "Mínimo", mobile: "hide", render: (r) => `${number(r.estoque_minimo)} ${r.unidade}` },
          { key: "custo_unitario", label: "Custo", mobile: "hide", render: (r) => (r.custo_unitario ? money(r.custo_unitario) : "—") },
          { key: "alerta", label: "Situação", mobile: "badge", render: (r) => Number(r.estoque_atual) < Number(r.estoque_minimo) ? <Badge tone="bad">Repor</Badge> : <Badge tone="ok">OK</Badge> },
        ]}
        defaults={{ unidade: "un", estoque_minimo: "0" }}
        fields={[
          { name: "nome", label: "Nome", required: true, col: 2 },
          { name: "unidade", label: "Unidade", type: "select", required: true, options: ["un", "saco", "m", "m²", "m³", "kg", "barra", "rolo", "lata", "caixa", "vb"].map((v) => ({ value: v, label: v })) },
          { name: "categoria", label: "Categoria" },
          { name: "estoque_minimo", label: "Estoque mínimo", type: "number", min: 0 },
          { name: "custo_unitario", label: "Custo unitário (R$)", type: "money" },
          { name: "fornecedor_id", label: "Fornecedor preferencial", type: "ref", ref: { table: "fornecedores" } },
        ]}
        extraActions={(r) => <>
          {gestor && <MenuItem icon={<ArrowDownToLine className="h-4 w-4" />} onClick={() => setMov({ m: r, tipo: "entrada" })}>Registrar entrada</MenuItem>}
          <MenuItem icon={<ArrowUpFromLine className="h-4 w-4" />} onClick={() => setMov({ m: r, tipo: "saida" })}>Registrar saída</MenuItem>
          <MenuItem icon={<History className="h-4 w-4" />} onClick={() => setHist(r)}>Movimentações</MenuItem>
        </>}
      />
      <MovModal mov={mov} onClose={() => setMov(null)} gestor={gestor} />
      <Historico m={hist} onClose={() => setHist(null)} />
    </>
  );
}

function MovModal({ mov, onClose, gestor }: { mov: { m: Row; tipo: string } | null; onClose: () => void; gestor: boolean }) {
  const fields = MOV_FIELDS(gestor);
  const [v, setV] = useState<Row>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [last, setLast] = useState<string | null>(null);
  if (mov && last !== mov.m.id + mov.tipo) { setLast(mov.m.id + mov.tipo); setV({ tipo: mov.tipo, quantidade: "", obra_id: "", custo_unitario: "", observacao: "" }); setErr({}); }
  const save = useSave((p: Row) => api().insert("material_movimentos", p), { invalidate: ["materiais", "material_movimentos"], success: "Movimentação registrada.", onDone: () => { setLast(null); onClose(); } });
  return (
    <Modal open={!!mov} onClose={onClose} busy={save.isPending} title={`${mov?.m.nome ?? ""} — movimentação`} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} onClick={() => {
        const e = validate(fields, v); setErr(e); if (Object.keys(e).length) return;
        save.mutate({ ...toPayload(fields, v), material_id: mov!.m.id });
      }}>Registrar</Button></>}>
      <p className="mb-4 text-sm text-muted">Estoque atual: <strong className="text-ink">{number(mov?.m.estoque_atual)} {mov?.m.unidade}</strong></p>
      <FormGrid fields={fields} values={v} errors={err} onChange={(n, x) => setV((s) => ({ ...s, [n]: x }))} />
    </Modal>
  );
}

function Historico({ m, onClose }: { m: Row | null; onClose: () => void }) {
  const q = useList<Row>("material_movimentos", { eq: { material_id: m?.id }, embed: ["obra"], order: [{ col: "created_at", asc: false }], limit: 50 }, !!m);
  return (
    <Modal open={!!m} onClose={onClose} title={`Movimentações — ${m?.nome ?? ""}`} size="md">
      {!q.data?.length ? <p className="py-6 text-center text-sm text-muted">{q.isLoading ? "Carregando…" : "Nenhuma movimentação."}</p> :
        <ul className="divide-y divide-line/50">{q.data.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div><p className="font-medium capitalize">{x.tipo}{x.obra ? ` · ${x.obra.nome}` : ""}</p><p className="text-xs text-muted">{dateTime(x.created_at)}{x.observacao ? ` · ${x.observacao}` : ""}</p></div>
            <span className={`tabular-nums font-semibold ${x.tipo === "saida" ? "text-red-400" : "text-ok"}`}>{x.tipo === "saida" ? "−" : "+"}{number(x.quantidade)} {m?.unidade}</span>
          </li>))}</ul>}
    </Modal>
  );
}
