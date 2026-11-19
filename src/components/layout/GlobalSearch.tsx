import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Calculator, ListChecks, Search, Users } from "lucide-react";
import { api } from "@/data/api";
import { useDebounced } from "@/lib/hooks";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Feedback";

const ICON = { obra: Building2, cliente: Users, tarefa: ListChecks, orcamento: Calculator } as const;
const ROUTE = { obra: (id: string) => `/obras/${id}`, cliente: (id: string) => `/clientes?ver=${id}`, tarefa: (id: string) => `/tarefas?ver=${id}`, orcamento: (id: string) => `/orcamentos/${id}` };
const LABEL = { obra: "Obra", cliente: "Cliente", tarefa: "Tarefa", orcamento: "Orçamento" };

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState("");
  const t = useDebounced(term.trim(), 250);
  const nav = useNavigate();
  useEffect(() => { if (!open) setTerm(""); }, [open]);
  const q = useQuery({ queryKey: ["rpc", "busca", t], queryFn: () => api().rpc<any[]>("busca_global", { p_termo: t }), enabled: open && t.length >= 2 });
  return (
    <Modal open={open} onClose={onClose} title="Buscar no sistema" size="md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input autoFocus className="input pl-10" placeholder="Obras, clientes, tarefas, orçamentos…" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Termo de busca" />
      </div>
      <div className="mt-3 min-h-[120px]">
        {t.length < 2 ? <p className="py-8 text-center text-sm text-muted">Digite ao menos 2 letras.</p>
          : q.isLoading ? <div className="grid place-items-center py-8"><Spinner /></div>
          : q.isError ? <p className="py-8 text-center text-sm text-red-300">Não foi possível buscar agora.</p>
          : !q.data?.length ? <p className="py-8 text-center text-sm text-muted">Nada encontrado para “{t}”.</p>
          : <ul className="divide-y divide-line/60">
              {q.data.map((r) => {
                const I = ICON[r.tipo as keyof typeof ICON] ?? Search;
                return (
                  <li key={r.tipo + r.id}>
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-2"
                      onClick={() => { onClose(); nav(ROUTE[r.tipo as keyof typeof ROUTE](r.id)); }}>
                      <I className="h-4 w-4 shrink-0 text-gold" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.titulo}</span><span className="block truncate text-xs text-muted">{r.subtitulo}</span></span>
                      <span className="text-[11px] text-muted">{LABEL[r.tipo as keyof typeof LABEL]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>}
      </div>
    </Modal>
  );
}
