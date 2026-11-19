import { Link } from "react-router-dom";
import { ClipboardList, Plus, Users } from "lucide-react";
import type { Obra, Row } from "@/data/types";
import { CLIMA } from "@/data/types";
import { useList } from "@/lib/hooks";
import { date } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Layout";
import { Badge } from "@/components/ui/Feedback";
import { EmptyState, QueryView } from "@/components/ui/States";

export function RdoTab({ obra }: { obra: Obra }) {
  const q = useList<Row>("rdos", { eq: { obra_id: obra.id }, embed: ["autor"], order: [{ col: "data", asc: false }] });
  return (
    <Card title="Diário de obra (RDO)" icon={<ClipboardList className="h-5 w-5" />} action={<Link to={`/obras/${obra.id}/rdo/novo`}><Button size="sm" icon={<Plus className="h-4 w-4" />}>Novo RDO</Button></Link>}>
      <QueryView q={q} empty={<EmptyState title="Nenhum RDO registrado." text="Registre diariamente clima, equipe, serviços e ocorrências." />}>
        {(rows) => (
          <ul className="divide-y divide-line/50">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={`/obras/${obra.id}/rdo/${r.id}`} className="flex items-start gap-4 py-3.5 hover:text-gold-soft">
                  <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-surface-2 py-1.5 text-center leading-tight">
                    <span className="text-lg font-bold">{date(r.data).slice(0, 2)}</span><span className="text-[10px] uppercase text-muted">{date(r.data).slice(3, 5)}/{date(r.data).slice(8)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">{r.servicos_executados || "Sem descrição de serviços"}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      {r.clima_manha && <Badge>{CLIMA[r.clima_manha as keyof typeof CLIMA]}</Badge>}
                      {r.efetivo_total != null && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.efetivo_total}</span>}
                      {r.ocorrencias && <Badge tone="warn">Ocorrência</Badge>}
                      {r.autor?.nome && <span>por {r.autor.nome}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </Card>
  );
}
