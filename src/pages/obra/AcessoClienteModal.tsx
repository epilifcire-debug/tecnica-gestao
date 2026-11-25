import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle, Power, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/data/api";
import type { Obra, Row } from "@/data/types";
import { useGet, useList } from "@/lib/hooks";
import { digits, maskPhone, validEmail } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Feedback";
import { Modal, useConfirm } from "@/components/ui/Modal";

const slug = (s: string) => {
  const p = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w && !["da", "de", "do", "das", "dos", "e", "ltda", "sa", "me", "eireli"].includes(w));
  return (p.length > 1 ? `${p[0]}.${p[p.length - 1]}` : p[0] ?? "cliente").slice(0, 30);
};
const senhaAleatoria = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(r, (n) => a[n % a.length]).join("") + "7";
};

/**
 * Acesso do cliente ao Portal: cria o login (perfil "cliente") vinculado ao cadastro do cliente desta obra.
 * O banco (RLS) garante que ele só enxerga as obras desse cliente — nada interno.
 */
export function AcessoClienteModal({ open, onClose, obra }: { open: boolean; onClose: () => void; obra: Obra }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const cliente = useGet<Row>("clientes", obra.cliente_id ?? undefined);
  const acessos = useList<Row>("profiles", { eq: { cliente_id: obra.cliente_id } }, open && !!obra.cliente_id);
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [criado, setCriado] = useState<{ username: string; senha: string; tel: string } | null>(null);

  const [init, setInit] = useState(false);
  useEffect(() => { if (!open) setInit(false); }, [open]);
  useEffect(() => {
    if (open && !init && cliente.data && acessos.data) {
      setInit(true);
      const usados = new Set(acessos.data.map((u) => (u.email ?? "").toLowerCase()));
      const nomes = new Set(acessos.data.map((u) => u.username));
      let u = slug(cliente.data.nome ?? ""), n = 1;
      while (nomes.has(u)) u = `${slug(cliente.data.nome ?? "")}${++n}`;
      setNome(acessos.data.length ? "" : cliente.data.nome ?? ""); setUsername(u);
      setEmail(cliente.data.email && !usados.has(cliente.data.email.toLowerCase()) ? cliente.data.email : ""); setTel(cliente.data.telefone ? maskPhone(cliente.data.telefone) : "");
      setSenha(senhaAleatoria()); setErr({}); setCriado(null);
    }
  }, [open, init, cliente.data, acessos.data]);

  const outrasObras = useList<Row>("obras", { eq: { cliente_id: obra.cliente_id } }, open && !!obra.cliente_id);
  const nObras = useMemo(() => outrasObras.data?.length ?? 1, [outrasObras.data]);

  const criar = async () => {
    if (busy) return;
    const e: Record<string, string> = {};
    if (nome.trim().split(/\s+/).length < 2) e.nome = "Informe nome e sobrenome.";
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) e.username = "Use 3 a 30 letras minúsculas, números, ponto, hífen ou _.";
    if (email && !validEmail(email)) e.email = "E-mail inválido.";
    if (tel && ![10, 11].includes(digits(tel).length)) e.tel = "Telefone inválido.";
    if (senha.length < 8) e.senha = "Mínimo de 8 caracteres.";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api().invoke("admin-users", {
        action: "create", role: "cliente", cliente_id: obra.cliente_id, nome: nome.trim(), username,
        email: email.trim().toLowerCase() || undefined, telefone: digits(tel), senha_provisoria: senha, ativo: true,
      });
      setCriado({ username, senha, tel: digits(tel) });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Acesso do cliente criado.");
    } catch (x) { toast.error(friendlyError(x)); } finally { setBusy(false); }
  };

  const toggle = async (u: Row) => {
    const ok = await confirm(u.ativo
      ? { title: "Bloquear acesso do cliente?", text: `${u.nome} não conseguirá mais entrar no Portal. Os dados da obra continuam intactos.`, confirm: "Bloquear", danger: true }
      : { title: "Reativar acesso?", text: `${u.nome} volta a acompanhar a obra pelo Portal.`, confirm: "Reativar" });
    if (!ok) return;
    try { await api().invoke("admin-users", { action: "set_active", user_id: u.id, ativo: !u.ativo }); qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success(u.ativo ? "Acesso bloqueado." : "Acesso reativado."); }
    catch (x) { toast.error(friendlyError(x)); }
  };

  const mensagem = criado ? `Olá, ${nome.split(" ")[0]}! Você já pode acompanhar a sua obra "${obra.nome}" pelo app da Técnica Engenharia.\n\nAcesse: ${window.location.origin}\nUsuário: ${criado.username}\nSenha: ${criado.senha}\n\nNo primeiro acesso, troque a senha em Meu perfil.` : "";
  const copiar = async () => { try { await navigator.clipboard.writeText(mensagem); toast.success("Mensagem copiada."); } catch { toast.error("Não foi possível copiar. Selecione o texto e copie."); } };

  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Acesso do cliente ao Portal" size="md"
      footer={criado
        ? <><Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={copiar}>Copiar mensagem</Button>
            {criado.tel && <Button icon={<MessageCircle className="h-4 w-4" />} onClick={() => window.open(`https://wa.me/55${criado.tel}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener")}>Enviar no WhatsApp</Button>}</>
        : <><Button variant="secondary" onClick={onClose} disabled={busy}>Fechar</Button><Button loading={busy} icon={<UserPlus className="h-4 w-4" />} onClick={criar}>Criar acesso</Button></>}>
      <p className="mb-4 rounded-xl border border-line bg-bg/40 p-3 text-[13px] text-ink/80">
        O cliente <strong>{cliente.data?.nome ?? "…"}</strong> verá somente {nObras > 1 ? `as ${nObras} obras do cadastro dele` : "esta obra"}: andamento, etapas, fotos e RDOs marcados como visíveis, documentos liberados, orçamentos e parcelas. Nenhuma tela interna.
      </p>

      {!!acessos.data?.length && (
        <div className="mb-5">
          <p className="label">Acessos já criados</p>
          <ul className="divide-y divide-line/60 rounded-xl border border-line">
            {acessos.data.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{u.nome}</p><p className="truncate text-xs text-muted">@{u.username}{u.email ? ` · ${u.email}` : ""}</p></div>
                <Badge tone={u.ativo ? "ok" : "bad"}>{u.ativo ? "Ativo" : "Bloqueado"}</Badge>
                <button onClick={() => toggle(u)} aria-label={u.ativo ? "Bloquear" : "Reativar"} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink"><Power className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {criado ? (
        <div className="space-y-3">
          <p className="text-sm text-ok">Acesso criado. Envie os dados ao cliente:</p>
          <pre className="whitespace-pre-wrap rounded-xl border border-line bg-bg/60 p-3 text-[13px] leading-relaxed text-ink/90">{mensagem}</pre>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome de quem vai acessar" required error={err.nome} htmlFor="ac-n" className="sm:col-span-2"><Input id="ac-n" value={nome} invalid={!!err.nome} onChange={(e) => setNome(e.target.value)} /></Field>
          <Field label="Usuário (login)" required error={err.username} htmlFor="ac-u"><Input id="ac-u" autoCapitalize="none" value={username} invalid={!!err.username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} /></Field>
          <Field label="Senha provisória" required error={err.senha} htmlFor="ac-s" hint="Gerada automaticamente; pode trocar."><PasswordInput id="ac-s" value={senha} invalid={!!err.senha} onChange={(e) => setSenha(e.target.value)} /></Field>
          <Field label="E-mail (opcional)" error={err.email} htmlFor="ac-e"><Input id="ac-e" type="email" value={email} invalid={!!err.email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="WhatsApp (opcional)" error={err.tel} htmlFor="ac-t" hint="Para enviar os dados de acesso."><Input id="ac-t" type="tel" value={tel} invalid={!!err.tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(99) 99999-9999" /></Field>
        </div>
      )}
    </Modal>
  );
}
