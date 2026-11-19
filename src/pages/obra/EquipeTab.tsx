import { useState } from "react";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import type { Obra, Row } from "@/data/types";
import { useList, useSave } from "@/lib/hooks";
import { maskPhone } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Layout";
import { Avatar } from "@/components/ui/Feedback";
import { Select } from "@/components/ui/Form";
import { EmptyState, QueryView } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";

export function EquipeTab({ obra }: { obra: Obra }) {
  const { role } = useAuth();
  const gestor = isGestor(role);
  const acessos = useList<Row>("obra_usuarios", { eq: { obra_id: obra.id }, embed: ["usuario"] });
  const equipe = useList<Row>("obra_equipe", { eq: { obra_id: obra.id }, embed: ["funcionario"] });
  const [addU, setAddU] = useState(false);
  const [addF, setAddF] = useState(false);
  const rmU = useSave((uid: string) => api().removeWhere("obra_usuarios", { obra_id: obra.id, user_id: uid }), { invalidate: ["obra_usuarios"], success: "Acesso removido." });
  const rmF = useSave((fid: string) => api().removeWhere("obra_equipe", { obra_id: obra.id, funcionario_id: fid }), { invalidate: ["obra_equipe"], success: "Removido da equipe." });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Equipe alocada" icon={<Users className="h-5 w-5" />} action={gestor && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddF(true)}>Alocar</Button>}>
        <QueryView q={equipe} empty={<EmptyState title="Ninguém alocado nesta obra." />}>
          {(rows) => <ul className="divide-y divide-line/50">{rows.map((r) => (
            <li key={r.funcionario_id} className="flex items-center gap-3 py-2.5">
              <Avatar nome={r.funcionario?.nome} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.funcionario?.nome}</p><p className="text-xs text-muted">{r.funcao_na_obra || r.funcionario?.funcao}{r.funcionario?.telefone ? ` · ${maskPhone(r.funcionario.telefone)}` : ""}</p></div>
              {gestor && <button aria-label="Remover" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-red-300" onClick={() => rmF.mutate(r.funcionario_id)}><Trash2 className="h-4 w-4" /></button>}
            </li>))}</ul>}
        </QueryView>
      </Card>
      <Card title="Acesso ao sistema nesta obra" icon={<UserPlus className="h-5 w-5" />} action={gestor && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddU(true)}>Liberar</Button>}>
        <p className="mb-3 text-[13px] text-muted">Colaboradores listados aqui podem ver a obra, lançar RDO, fotos, tarefas e atualizar o cronograma.</p>
        <QueryView q={acessos} empty={<EmptyState title="Nenhum colaborador com acesso." />}>
          {(rows) => <ul className="divide-y divide-line/50">{rows.map((r) => (
            <li key={r.user_id} className="flex items-center gap-3 py-2.5">
              <Avatar nome={r.usuario?.nome} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.usuario?.nome ?? "Usuário"}</p><p className="text-xs text-muted">{r.usuario?.cargo ?? r.papel}</p></div>
              {gestor && <button aria-label="Remover acesso" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-red-300" onClick={() => rmU.mutate(r.user_id)}><Trash2 className="h-4 w-4" /></button>}
            </li>))}</ul>}
        </QueryView>
      </Card>
      {gestor && <AddModal open={addF} onClose={() => setAddF(false)} title="Alocar funcionário" table="funcionarios" exclude={(equipe.data ?? []).map((r) => r.funcionario_id)}
        onPick={(id) => api().insert("obra_equipe", { obra_id: obra.id, funcionario_id: id })} invalidate="obra_equipe" />}
      {gestor && <AddModal open={addU} onClose={() => setAddU(false)} title="Liberar acesso" table="profiles" opts={{ isNull: ["cliente_id"], eq: { ativo: true } }} exclude={(acessos.data ?? []).map((r) => r.user_id)}
        onPick={(id) => api().insert("obra_usuarios", { obra_id: obra.id, user_id: id })} invalidate="obra_usuarios" />}
    </div>
  );
}

function AddModal({ open, onClose, title, table, opts, exclude, onPick, invalidate }: { open: boolean; onClose: () => void; title: string; table: string; opts?: any; exclude: string[]; onPick: (id: string) => Promise<unknown>; invalidate: string }) {
  const q = useList<Row>(table, { order: [{ col: "nome" }], ...opts }, open);
  const [v, setV] = useState("");
  const save = useSave(() => onPick(v), { invalidate: [invalidate], success: "Adicionado.", onDone: () => { setV(""); onClose(); } });
  const options = (q.data ?? []).filter((r) => !exclude.includes(r.id)).map((r) => ({ value: r.id, label: r.nome + (r.funcao ? ` — ${r.funcao}` : r.cargo ? ` — ${r.cargo}` : "") }));
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!v} loading={save.isPending} onClick={() => save.mutate(undefined)}>Adicionar</Button></>}>
      <Select value={v} onChange={(e) => setV(e.target.value)} options={options} placeholder={q.isLoading ? "Carregando…" : options.length ? "Selecione…" : "Ninguém disponível"} aria-label="Selecionar" />
    </Modal>
  );
}
