import { Link } from "react-router-dom";
import type { Obra, Row } from "@/data/types";
import { LANC_STATUS } from "@/data/types";
import { useList, useRpc } from "@/lib/hooks";
import { date, money } from "@/lib/format";
import { Card } from "@/components/ui/Layout";
import { Skeleton, StatusBadge } from "@/components/ui/Feedback";
import { EmptyState, ErrorState, QueryView } from "@/components/ui/States";

function Ring({ v }: { v: number }) {
  const r = 46, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, v));
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32" role="img" aria-label={`${p}% recebido`}>
      <circle cx="60" cy="60" r={r} stroke="rgb(36 44 56)" strokeWidth="10" fill="none" />
      <circle cx="60" cy="60" r={r} stroke="url(#rg)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset .8s" }} />
      <defs><linearGradient id="rg"><stop offset="0" stopColor="#D6AC42" /><stop offset="1" stopColor="#F0CF78" /></linearGradient></defs>
      <text x="60" y="60" textAnchor="middle" fontSize="22" fontWeight="700" fill="#ECEFF3">{p.toFixed(0)}%</text>
      <text x="60" y="78" textAnchor="middle" fontSize="10" fill="#8A94A3">Recebido</text>
    </svg>
  );
}

export function FinanceiroObraTab({ obra }: { obra: Obra }) {
  const f = useRpc<Row>("obra_financeiro", { p_obra: obra.id });
  const mov = useList<Row>("lancamentos", { eq: { obra_id: obra.id }, order: [{ col: "vencimento", asc: false }] });
  const d = f.data;
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="Resumo financeiro">
        {f.isLoading ? <Skeleton className="h-56" /> : f.isError ? <ErrorState error={f.error} onRetry={() => f.refetch()} /> : d && (
          <>
            <dl className="space-y-3 text-sm">
              {[["Valor contratado", d.valor_contratado], ["Recebido", d.recebido], ["A receber", d.a_receber], ["Despesas", d.despesas], ["A pagar", d.a_pagar]].map(([k, v]) => (
                <div key={k as string} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="tabular-nums">{money(v as number)}</dd></div>
              ))}
              <div className="flex justify-between border-t border-line/60 pt-3 text-[15px] font-semibold"><dt>Saldo previsto</dt><dd className="tabular-nums text-gold-soft">{money(d.saldo_previsto)}</dd></div>
            </dl>
            <div className="mt-4 flex justify-center"><Ring v={Number(d.percentual_recebido)} /></div>
          </>
        )}
      </Card>
      <Card title="Movimentações" action={<Link to={`/financeiro?obra=${obra.id}&novo=1`} className="text-sm text-gold-soft">Novo lançamento</Link>}>
        <QueryView q={mov} empty={<EmptyState title="Nenhum lançamento nesta obra." />}>
          {(rows) => (
            <ul className="divide-y divide-line/50">
              {rows.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{l.descricao}</p><p className="text-xs text-muted">{l.categoria} · venc. {date(l.vencimento)}{l.pago_em ? ` · pago ${date(l.pago_em)}` : ""}</p></div>
                  <div className="text-right"><p className={`font-semibold tabular-nums ${l.tipo === "receita" ? "text-ok" : "text-red-400"}`}>{l.tipo === "receita" ? "+" : "−"} {money(l.valor)}</p><StatusBadge map={LANC_STATUS} value={l.status} /></div>
                </li>
              ))}
            </ul>
          )}
        </QueryView>
      </Card>
    </div>
  );
}
