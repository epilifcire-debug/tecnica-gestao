import { useMemo, useState } from "react";
import { KeyRound, Plus, Power, Search, ShieldCheck, UserCog } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { api } from "@/data/api";
import type { Role, Row } from "@/data/types";
import { ROLE_LABEL } from "@/data/types";
import { useDebounced, useList } from "@/lib/hooks";
import { date, maskPhone } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { PageHeader, Tabs } from "@/components/ui/Layout";
import { Avatar, Badge } from "@/components/ui/Feedback";
import { EmptyState, QueryView } from "@/components/ui/States";
import { Modal, useConfirm } from "@/components/ui/Modal";
import { FormGrid, toForm, validate, type FieldDef } from "@/components/crud/FormFields";
import { digits } from "@/lib/format";
import { IS_DEMO } from "@/lib/env";

const ADMIN_ROLES: Role[] = ["admin_master", "administrador"];

export default function Usuarios() {
  const { role: myRole, userId } = useAuth();
  const master = myRole === "admin_master";
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [aba, setAba] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [term, setTerm] = useState("");
  const t = useDebounced(term);
  const [edit, setEdit] = useState<Row | null>(null);
  const profiles = useList<Row>("profiles", { embed: ["cliente"], order: [{ col: "nome" }] });
  const roles = useList<Row>("user_roles");
  const rows = useMemo(() => {
    const rm = new Map((roles.data ?? []).map((r) => [r.user_id, r.role as Role]));
    return (profiles.data ?? []).map((p): Row => ({ ...p, role: rm.get(p.id) }))
      .filter((p) => (aba === "todos" ? true : aba === "ativos" ? p.ativo : !p.ativo))
      .filter((p) => !t || `${p.nome} ${p.email ?? ""} ${p.username}`.toLowerCase().includes(t.toLowerCase()));
  }, [profiles.data, roles.data, aba, t]);
  const canManage = (r?: Role) => master || (!!r && !ADMIN_ROLES.includes(r));

  const toggle = async (u: Row) => {
    const ok = await confirm(u.ativo
      ? { title: "Desativar usuário?", text: <>O usuário <strong>{u.nome}</strong> perderá acesso ao sistema imediatamente, mas seus registros históricos serão preservados.</>, confirm: "Desativar", danger: true }
      : { title: "Reativar usuário?", text: <>{u.nome} voltará a acessar o sistema com o perfil atual.</>, confirm: "Reativar" });
    if (!ok) return;
    try { await api().invoke("admin-users", { action: "set_active", user_id: u.id, ativo: !u.ativo }); toast.success(u.ativo ? "Usuário desativado." : "Usuário reativado."); qc.invalidateQueries({ queryKey: ["profiles"] }); }
    catch (e) { toast.error(friendlyError(e)); }
  };
  const reset = async (u: Row) => {
    if (!(await confirm({ title: "Enviar redefinição de senha?", text: u.email ? `Um link seguro será enviado para ${u.email}.` : "Este usuário não tem e-mail: use Editar → Definir nova senha.", confirm: "Enviar" }))) return;
    try { await api().invoke("admin-users", { action: "reset_password", user_id: u.id }); toast.success("E-mail de redefinição enviado."); } catch (e) { toast.error(friendlyError(e)); }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Administração" title="Usuários" subtitle="Acesso ao sistema, perfis e status." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({})}>Novo usuário</Button>} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={aba} onChange={setAba} items={[{ value: "ativos", label: "Ativos" }, { value: "inativos", label: "Inativos" }, { value: "todos", label: "Todos" }]} />
        <div className="relative md:ml-auto md:w-80"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input h-10 pl-10" placeholder="Buscar nome ou e-mail…" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Buscar usuários" /></div>
      </div>
      <QueryView q={{ ...profiles, isLoading: profiles.isLoading || roles.isLoading, data: rows }} empty={<EmptyState title="Nenhum usuário encontrado." />}>
        {(list) => (
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {list.map((u) => (
              <li key={u.id} className="card flex items-center gap-3 p-3.5">
                <Avatar nome={u.nome} url={u.avatar_url} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">{u.nome}{u.role === "admin_master" && <ShieldCheck className="h-4 w-4 text-pearl" aria-label="Administrador Master" />}{u.id === userId && <span className="text-xs text-muted">(você)</span>}</p>
                  <p className="truncate text-[12.5px] text-muted">@{u.username}{u.email ? ` · ${u.email}` : ""}{u.telefone ? ` · ${maskPhone(u.telefone)}` : ""}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={u.role && ADMIN_ROLES.includes(u.role) ? "pearl" : u.role === "cliente" ? "info" : "muted"}>{u.role ? ROLE_LABEL[u.role as Role] : "Sem perfil"}</Badge>
                    <Badge tone={u.ativo ? "ok" : "bad"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                    {u.cliente && <span className="text-[11.5px] text-muted">{u.cliente.nome}</span>}
                    <span className="text-[11.5px] text-muted">desde {date(u.created_at)}</span>
                  </div>
                </div>
                {canManage(u.role) && (
                  <div className="flex">
                    <button aria-label="Editar" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink" onClick={() => setEdit(u)}><UserCog className="h-4 w-4" /></button>
                    <button aria-label="Redefinir senha" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink" onClick={() => reset(u)}><KeyRound className="h-4 w-4" /></button>
                    {u.id !== userId && <button aria-label={u.ativo ? "Desativar" : "Reativar"} className={`grid h-9 w-9 place-items-center rounded-lg ${u.ativo ? "text-muted hover:text-red-300" : "text-ok"}`} onClick={() => toggle(u)}><Power className="h-4 w-4" /></button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryView>
      <UserForm row={edit} onClose={() => setEdit(null)} master={master} self={edit?.id === userId} />
    </div>
  );
}

function UserForm({ row, onClose, master, self }: { row: Row | null; onClose: () => void; master: boolean; self: boolean }) {
  const isNew = !!row && !row.id;
  const qc = useQueryClient();
  const roleOpts = (master ? ["admin_master", "administrador", "colaborador", "cliente"] : ["colaborador", "cliente"]).map((r) => ({ value: r, label: ROLE_LABEL[r as Role] }));
  const fields: FieldDef[] = [
    { name: "nome", label: "Nome completo", required: true, col: 2, validate: (v) => (String(v).trim().split(/\s+/).length < 2 ? "Informe nome e sobrenome." : null) },
    { name: "username", label: "Nome de usuário (login)", required: true, hint: "Minúsculo, sem espaço. Ex.: joao.santos",
      validate: (v) => (/^[a-z0-9._-]{3,30}$/.test(String(v).trim().toLowerCase()) ? null : "Use 3 a 30 letras, números, ponto, hífen ou _.") },
    { name: "email", label: "E-mail (opcional)", type: "email", disabled: () => !isNew, hint: !isNew ? "O e-mail de acesso não pode ser alterado aqui." : "Sem e-mail, a pessoa entra só pelo nome de usuário." },
    { name: "telefone", label: "Telefone", type: "tel" },
    { name: "cargo", label: "Cargo / função", hidden: (v) => v.role === "cliente" },
    { name: "role", label: "Perfil de acesso", type: "select", required: true, options: roleOpts, disabled: () => self, hint: self ? "Você não pode alterar o seu próprio perfil." : undefined },
    { name: "cliente_id", label: "Cliente vinculado", type: "ref", ref: { table: "clientes" }, required: true, hidden: (v) => v.role !== "cliente", hint: "O cliente verá somente as obras deste cadastro no Portal." },
    { name: "senha_provisoria", label: "Senha provisória", hidden: () => !isNew, hint: "Obrigatória sem e-mail. Com e-mail, deixe em branco para enviar convite.",
      validate: (v, a) => (!a.email && !v ? "Informe uma senha (mín. 8) ou um e-mail." : v && String(v).length < 8 ? "Mínimo de 8 caracteres." : null) },
    { name: "nova_senha", label: "Definir nova senha (opcional)", hidden: () => isNew, hint: "Útil para quem não tem e-mail. Mínimo 8 caracteres.", validate: (v) => (v && String(v).length < 8 ? "Mínimo de 8 caracteres." : null) },
    { name: "ativo", label: "Usuário ativo", type: "switch", hidden: () => !isNew },
  ];
  const [v, setV] = useState<Row>({});
  const [e, setE] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Row | null>(null);
  if (row !== last) { setLast(row); if (row) { setV(toForm(fields, row, { role: "colaborador", ativo: true })); setE({}); } }

  const submit = async () => {
    if (busy) return;
    const er = validate(fields, v); setE(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const body = { nome: String(v.nome).trim(), username: String(v.username).trim().toLowerCase(), telefone: digits(String(v.telefone ?? "")), cargo: v.cargo || null, role: v.role, cliente_id: v.role === "cliente" ? v.cliente_id : null };
      if (isNew) {
        const r = await api().invoke<Row>("admin-users", { action: "create", ...body, email: v.email ? String(v.email).trim().toLowerCase() : undefined, senha_provisoria: v.senha_provisoria || undefined, ativo: !!v.ativo });
        toast.success(r.convite_enviado && !IS_DEMO ? "Usuário cadastrado com sucesso. Convite enviado por e-mail." : "Usuário cadastrado com sucesso.");
      } else {
        await api().invoke("admin-users", { action: "update", user_id: row!.id, ...body, ...(v.nova_senha ? { nova_senha: v.nova_senha } : {}), ...(self ? { role: undefined } : {}) });
        toast.success("Usuário atualizado.");
      }
      qc.invalidateQueries({ queryKey: ["profiles"] }); qc.invalidateQueries({ queryKey: ["user_roles"] });
      onClose();
    } catch (err) { toast.error(friendlyError(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!row} onClose={onClose} busy={busy} title={isNew ? "Novo usuário" : "Editar usuário"} size="md"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button loading={busy} onClick={submit}>{isNew ? "Cadastrar" : "Salvar"}</Button></>}>
      <FormGrid fields={fields} values={v} errors={e} onChange={(n, x) => { setV((s) => ({ ...s, [n]: x })); setE((s) => ({ ...s, [n]: "" })); }} />
    </Modal>
  );
}
