import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Layers, RotateCcw } from "lucide-react";
import { api } from "@/data/api";
import type { Row } from "@/data/types";
import { LANC_STATUS } from "@/data/types";
import { date, isoDate, money, today } from "@/lib/format";
import { useRpc, useSave } from "@/lib/hooks";
import { CrudPage, MenuItem } from "@/components/crud/CrudPage";
import { Button } from "@/components/ui/Button";
import { Badge, Skeleton, StatusBadge } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { FormGrid, toPayload, validate, type FieldDef } from "@/components/crud/FormFields";

const CATS = ["Medição", "Sinal", "Material", "Mão de obra", "Locação", "Projeto", "Impostos", "Administrativo", "Combustível", "Geral"].map((v) => ({ value: v, label: v }));
const FORMAS = ["PIX", "Transferência", "Boleto", "Cartão", "Dinheiro", "Cheque"].map((v) => ({ value: v, label: v }));

export default function Financeiro() {
  const [params] = useSearchParams();
  const hoje = today();
  const n = new Date();
  const ini = isoDate(new Date(n.getFullYear(), n.getMonth(), 1));
  const r = useRpc<Row>("dashboard_resumo", { p_inicio: ini, p_fim: hoje });
  const [parc, setParc] = useState(false);
  const pagar = useSave((id: string) => api().update("lancamentos", id, { status: "pago", pago_em: hoje }), { invalidate: ["lancamentos"], success: "Baixa registrada." });
  const estornar = useSave((id: string) => api().update("lancamentos", id, { status: "pendente", pago_em: null }), { invalidate: ["lancamentos"], success: "Baixa desfeita." });

  const abas = [
    { value: "todos", label: "Todos" },
    { value: "receitas", label: "Entradas", opts: { eq: { tipo: "receita", status: "pago" } } },
    { value: "despesas", label: "Despesas", opts: { eq: { tipo: "despesa", status: "pago" } } },
    { value: "receber", label: "Contas a receber", opts: { eq: { tipo: "receita", status: "pendente" } } },
    { value: "pagar", label: "Contas a pagar", opts: { eq: { tipo: "despesa", status: "pendente" } } },
  ];
  const a = params.get("aba");
  if (a) { const i = abas.findIndex((x) => x.value === a); if (i > 0) abas.unshift(abas.splice(i, 1)[0]); }
  const obraParam = params.get("obra");
  const d = r.data;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Recebido no mês", d?.recebido, "text-ok"], ["Gastos no mês", d?.gastos, "text-red-400"], ["Saldo do mês", d?.saldo, (d?.saldo ?? 0) < 0 ? "text-red-400" : "text-pearl-soft"],
          ["A receber", d?.a_receber, "text-blue-300"], ["A pagar", d?.a_pagar, "text-orange-300"],
        ].map(([k, v, c]) => (
          <div key={k as string} className="card p-4">
            <p className="text-[12.5px] text-muted">{k}</p>
            {r.isLoading ? <Skeleton className="mt-1 h-7 w-28" /> : <p className={`mt-0.5 text-lg font-bold tabular-nums sm:text-xl ${c}`}>{money(v as number)}</p>}
          </div>
        ))}
      </div>
      {d && d.receber_vencido > 0 && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-red-200">Há <strong>{money(d.receber_vencido)}</strong> em recebimentos vencidos. Filtre “Contas a receber” para cobrar.</p>}

      <CrudPage table="lancamentos" singular="Lançamento" title="Financeiro" eyebrow="Gestão financeira" subtitle="Entradas, despesas, contas a receber e a pagar."
        headerActions={<Button variant="secondary" icon={<Layers className="h-4 w-4" />} onClick={() => setParc(true)}>Gerar parcelas</Button>}
        embed={["obra", "cliente", "fornecedor"]} order={[{ col: "vencimento", asc: false }]} searchCols={["descricao", "categoria"]}
        baseOpts={obraParam ? { eq: { obra_id: obraParam } } : undefined}
        filters={abas}
        columns={[
          { key: "descricao", label: "Descrição", mobile: "title", render: (x) => <span className="font-medium">{x.descricao}</span> },
          { key: "ref", label: "Obra / Pessoa", mobile: "sub", render: (x) => [x.obra?.nome, x.cliente?.nome ?? x.fornecedor?.nome].filter(Boolean).join(" · ") || x.categoria },
          { key: "vencimento", label: "Vencimento", mobile: "meta", render: (x) => <span className={x.status === "pendente" && x.vencimento < hoje ? "font-semibold text-red-400" : ""}>{date(x.vencimento)}</span> },
          { key: "valor", label: "Valor", mobile: "meta", className: "text-right", render: (x) => <span className={`font-semibold tabular-nums ${x.tipo === "receita" ? "text-ok" : "text-red-400"}`}>{x.tipo === "receita" ? "+" : "−"} {money(x.valor)}</span> },
          { key: "status", label: "Status", mobile: "badge", render: (x) => x.status === "pendente" && x.vencimento < hoje ? <Badge tone="bad">Vencido</Badge> : <StatusBadge map={LANC_STATUS} value={x.status} /> },
        ]}
        defaults={{ tipo: "receita", status: "pendente", categoria: "Medição", vencimento: hoje, obra_id: obraParam ?? "" }}
        fields={[
          { name: "tipo", label: "Tipo", type: "select", required: true, options: [{ value: "receita", label: "Entrada (receita)" }, { value: "despesa", label: "Saída (despesa)" }] },
          { name: "status", label: "Situação", type: "select", required: true, options: [{ value: "pendente", label: "Pendente" }, { value: "pago", label: "Pago / recebido" }, { value: "cancelado", label: "Cancelado" }] },
          { name: "descricao", label: "Descrição", required: true, col: 2 },
          { name: "valor", label: "Valor (R$)", type: "money", required: true, validate: (v) => (Number(String(v).replace(/\./g, "").replace(",", ".")) > 0 ? null : "Informe um valor maior que zero.") },
          { name: "categoria", label: "Categoria", type: "select", required: true, options: CATS },
          { name: "vencimento", label: "Vencimento", type: "date", required: true },
          { name: "pago_em", label: "Data do pagamento", type: "date", hidden: (v) => v.status !== "pago" },
          { name: "forma_pagamento", label: "Forma de pagamento", type: "select", options: FORMAS },
          { name: "obra_id", label: "Obra", type: "ref", ref: { table: "obras" } },
          { name: "cliente_id", label: "Cliente", type: "ref", ref: { table: "clientes" }, hidden: (v) => v.tipo !== "receita" },
          { name: "fornecedor_id", label: "Fornecedor", type: "ref", ref: { table: "fornecedores" }, hidden: (v) => v.tipo !== "despesa" },
          { name: "observacoes", label: "Observações", type: "textarea" },
        ]}
        beforeSave={(p) => ({ ...p, pago_em: p.status === "pago" ? p.pago_em ?? hoje : null })}
        extraActions={(x) => x.status === "pendente"
          ? <MenuItem icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => pagar.mutate(x.id)}>{x.tipo === "receita" ? "Registrar recebimento" : "Registrar pagamento"}</MenuItem>
          : x.status === "pago" ? <MenuItem icon={<RotateCcw className="h-4 w-4" />} onClick={() => estornar.mutate(x.id)}>Desfazer baixa</MenuItem> : null}
      />
      <Parcelas open={parc} onClose={() => setParc(false)} />
    </div>
  );
}

const PF: FieldDef[] = [
  { name: "p_descricao", label: "Descrição", required: true, col: 2, placeholder: "Ex.: Medição — Residência Silva" },
  { name: "p_valor_total", label: "Valor total (R$)", type: "money", required: true },
  { name: "p_parcelas", label: "Nº de parcelas", type: "number", required: true, min: 1, max: 120 },
  { name: "p_primeiro_vencimento", label: "1º vencimento", type: "date", required: true },
  { name: "p_categoria", label: "Categoria", type: "select", required: true, options: CATS },
  { name: "p_obra", label: "Obra", type: "ref", ref: { table: "obras" } },
  { name: "p_cliente", label: "Cliente", type: "ref", ref: { table: "clientes" } },
];
function Parcelas({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [v, setV] = useState<Row>({ p_parcelas: "3", p_primeiro_vencimento: today(), p_categoria: "Medição" });
  const [e, setE] = useState<Record<string, string>>({});
  const save = useSave((p: Row) => api().rpc<number>("gerar_parcelas", p), { invalidate: ["lancamentos"], success: (n) => `${n} parcelas geradas em Contas a receber.`, onDone: onClose });
  return (
    <Modal open={open} onClose={onClose} busy={save.isPending} title="Gerar parcelas a receber" size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} onClick={() => { const er = validate(PF, v); setE(er); if (!Object.keys(er).length) save.mutate(toPayload(PF, v)); }}>Gerar</Button></>}>
      <FormGrid fields={PF} values={v} errors={e} onChange={(k, x) => setV((s) => ({ ...s, [k]: x }))} />
    </Modal>
  );
}
