import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Obra, Row } from "@/data/types";
import { OBRA_STATUS } from "@/data/types";
import { useList } from "@/lib/hooks";
import { date, downloadCsv, isoDate, money, today } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Tabs } from "@/components/ui/Layout";
import { Badge, Progress } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Form";
import { EmptyState, QueryView } from "@/components/ui/States";

export default function Relatorios() {
  const [aba, setAba] = useState<"obras" | "financeiro" | "receber">("obras");
  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Análises" title="Relatórios" subtitle="Indicadores consolidados a partir dos dados reais do sistema, com exportação para Excel (CSV)." />
      <Tabs value={aba} onChange={setAba} className="mb-4" items={[{ value: "obras", label: "Obras" }, { value: "financeiro", label: "Financeiro por categoria" }, { value: "receber", label: "Contas a receber" }]} />
      {aba === "obras" && <RelObras />}
      {aba === "financeiro" && <RelFinanceiro />}
      {aba === "receber" && <RelReceber />}
    </div>
  );
}

function RelObras() {
  const obras = useList<Obra>("obras", { embed: ["cliente"], order: [{ col: "nome" }] });
  const lanc = useList<Row>("lancamentos", { eq: { status: "pago" } });
  const rows = useMemo(() => (obras.data ?? []).map((o) => {
    const l = (lanc.data ?? []).filter((x) => x.obra_id === o.id);
    const rec = l.filter((x) => x.tipo === "receita").reduce((a, x) => a + Number(x.valor), 0);
    const desp = l.filter((x) => x.tipo === "despesa").reduce((a, x) => a + Number(x.valor), 0);
    return { ...o, rec, desp, margem: rec - desp };
  }), [obras.data, lanc.data]);
  const exp = () => downloadCsv(`obras-${today()}.csv`, ["Obra", "Cliente", "Status", "Progresso (%)", "Início", "Previsão", "Contratado", "Recebido", "Despesas", "Resultado"],
    rows.map((o) => [o.nome, o.cliente?.nome, OBRA_STATUS[o.status].label, Math.round(o.progresso), date(o.data_inicio), date(o.previsao_termino), Number(o.valor_contratado), o.rec, o.desp, o.margem]));
  return (
    <Card title="Situação das obras" action={<Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exp} disabled={!rows.length}>Exportar CSV</Button>} pad={false}>
      <QueryView q={{ ...obras, isLoading: obras.isLoading || lanc.isLoading, data: rows }} empty={<div className="p-5"><EmptyState title="Nenhuma obra cadastrada." /></div>}>
        {(list) => (
          <div className="overflow-x-auto p-2">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="border-b border-line/60">{["Obra", "Status", "Progresso", "Contratado", "Recebido", "Despesas", "Resultado"].map((h) => <th key={h} className="table-head px-3 py-2.5">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line/40">
                {list.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2.5"><p className="font-medium">{o.nome}</p><p className="text-xs text-muted">{o.cliente?.nome}</p></td>
                    <td className="px-3"><Badge tone={OBRA_STATUS[o.status].tone}>{OBRA_STATUS[o.status].label}</Badge></td>
                    <td className="px-3"><div className="flex w-32 items-center gap-2"><Progress value={o.progresso} /><span className="text-xs tabular-nums">{Math.round(o.progresso)}%</span></div></td>
                    <td className="px-3 tabular-nums">{money(o.valor_contratado)}</td>
                    <td className="px-3 tabular-nums text-ok">{money(o.rec)}</td>
                    <td className="px-3 tabular-nums text-red-400">{money(o.desp)}</td>
                    <td className={`px-3 font-semibold tabular-nums ${o.margem < 0 ? "text-red-400" : ""}`}>{money(o.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
    </Card>
  );
}

function RelFinanceiro() {
  const n = new Date();
  const [ini, setIni] = useState(isoDate(new Date(n.getFullYear(), 0, 1)));
  const [fim, setFim] = useState(today());
  const q = useList<Row>("lancamentos", { eq: { status: "pago" }, gte: { pago_em: ini }, lte: { pago_em: fim } });
  const grupos = useMemo(() => {
    const m = new Map<string, { receita: number; despesa: number }>();
    (q.data ?? []).forEach((l) => { const g = m.get(l.categoria) ?? { receita: 0, despesa: 0 }; g[l.tipo as "receita" | "despesa"] += Number(l.valor); m.set(l.categoria, g); });
    return [...m.entries()].sort((a, b) => b[1].receita + b[1].despesa - (a[1].receita + a[1].despesa));
  }, [q.data]);
  const tot = grupos.reduce((a, [, g]) => ({ r: a.r + g.receita, d: a.d + g.despesa }), { r: 0, d: 0 });
  const max = Math.max(1, ...grupos.map(([, g]) => Math.max(g.receita, g.despesa)));
  return (
    <Card title="Realizado por categoria" action={<div className="flex flex-wrap items-center gap-2">
      <Input type="date" className="h-9 w-[150px]" value={ini} onChange={(e) => setIni(e.target.value)} aria-label="De" />
      <Input type="date" className="h-9 w-[150px]" value={fim} onChange={(e) => setFim(e.target.value)} aria-label="Até" />
      <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!grupos.length} onClick={() => downloadCsv(`financeiro-${ini}-a-${fim}.csv`, ["Categoria", "Receitas", "Despesas", "Saldo"], grupos.map(([k, g]) => [k, g.receita, g.despesa, g.receita - g.despesa]))}>CSV</Button>
    </div>}>
      <QueryView q={{ ...q, data: grupos }} empty={<EmptyState title="Nenhum lançamento pago no período." />}>
        {(list) => (
          <>
            <ul className="space-y-3">
              {list.map(([k, g]) => (
                <li key={k} className="grid gap-1.5 sm:grid-cols-[180px_1fr] sm:items-center">
                  <p className="text-sm font-medium">{k}</p>
                  <div className="space-y-1">
                    {g.receita > 0 && <div className="flex items-center gap-2"><div className="h-2 rounded bg-ok" style={{ width: `${(g.receita / max) * 100}%` }} /><span className="text-xs tabular-nums text-ok">{money(g.receita)}</span></div>}
                    {g.despesa > 0 && <div className="flex items-center gap-2"><div className="h-2 rounded bg-bad" style={{ width: `${(g.despesa / max) * 100}%` }} /><span className="text-xs tabular-nums text-red-400">{money(g.despesa)}</span></div>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap justify-end gap-6 border-t border-line/60 pt-4 text-sm">
              <span>Receitas <strong className="text-ok">{money(tot.r)}</strong></span><span>Despesas <strong className="text-red-400">{money(tot.d)}</strong></span><span>Saldo <strong className="text-gold-soft">{money(tot.r - tot.d)}</strong></span>
            </div>
          </>
        )}
      </QueryView>
    </Card>
  );
}

function RelReceber() {
  const hoje = today();
  const q = useList<Row>("lancamentos", { eq: { tipo: "receita", status: "pendente" }, embed: ["obra", "cliente"], order: [{ col: "vencimento" }] });
  const faixas = useMemo(() => {
    const f = { vencido: 0, d30: 0, d60: 0, mais: 0 };
    (q.data ?? []).forEach((l) => {
      const dias = Math.round((new Date(l.vencimento + "T12:00").getTime() - Date.now()) / 864e5);
      if (l.vencimento < hoje) f.vencido += Number(l.valor); else if (dias <= 30) f.d30 += Number(l.valor); else if (dias <= 60) f.d60 += Number(l.valor); else f.mais += Number(l.valor);
    });
    return f;
  }, [q.data, hoje]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Vencido", faixas.vencido, "text-red-400"], ["Até 30 dias", faixas.d30, "text-gold-soft"], ["31 a 60 dias", faixas.d60, "text-blue-300"], ["Acima de 60 dias", faixas.mais, "text-ink"]].map(([k, v, c]) => (
          <div key={k as string} className="card p-4"><p className="text-[12.5px] text-muted">{k}</p><p className={`text-lg font-bold tabular-nums ${c}`}>{money(v as number)}</p></div>
        ))}
      </div>
      <Card title="Títulos em aberto" action={<Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!q.data?.length}
        onClick={() => downloadCsv(`a-receber-${hoje}.csv`, ["Descrição", "Cliente", "Obra", "Vencimento", "Valor"], (q.data ?? []).map((l) => [l.descricao, l.cliente?.nome, l.obra?.nome, date(l.vencimento), Number(l.valor)]))}>CSV</Button>}>
        <QueryView q={q} empty={<EmptyState title="Nenhum valor a receber." />}>
          {(rows) => <ul className="divide-y divide-line/50">{rows.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{l.descricao}</p><p className="truncate text-xs text-muted">{[l.cliente?.nome, l.obra?.nome].filter(Boolean).join(" · ")}</p></div>
              <div className="text-right"><p className="font-semibold tabular-nums">{money(l.valor)}</p><p className={`text-xs ${l.vencimento < hoje ? "text-red-400" : "text-muted"}`}>{date(l.vencimento)}</p></div>
            </li>))}</ul>}
        </QueryView>
      </Card>
    </div>
  );
}
