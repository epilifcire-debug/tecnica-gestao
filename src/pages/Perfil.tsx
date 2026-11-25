import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { api } from "@/data/api";
import { ROLE_LABEL } from "@/data/types";
import { digits, maskPhone } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { compressImage } from "@/lib/pdf";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Form";
import { Card, PageHeader } from "@/components/ui/Layout";
import { Avatar, Badge } from "@/components/ui/Feedback";
import { useConfirm } from "@/components/ui/Modal";

export default function Perfil() {
  const { profile, role, refresh, signOut } = useAuth();
  const nav = useNavigate();
  const confirm = useConfirm();
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [cargo, setCargo] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [s1, setS1] = useState(""); const [s2, setS2] = useState(""); const [pBusy, setPBusy] = useState(false); const [pErr, setPErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (profile) { setNome(profile.nome); setTel(profile.telefone ? maskPhone(profile.telefone) : ""); setCargo(profile.cargo ?? ""); } }, [profile]);
  if (!profile) return null;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const er: Record<string, string> = {};
    if (nome.trim().length < 3) er.nome = "Informe seu nome completo.";
    if (tel && ![10, 11].includes(digits(tel).length)) er.tel = "Telefone inválido. Use (99) 99999-9999.";
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      // só campos permitidos: papel/ativo/e-mail não são alteráveis aqui (bloqueado também no banco)
      await api().update("profiles", profile.id, { nome: nome.trim(), telefone: digits(tel) || null, cargo: cargo.trim() || null });
      await refresh();
      toast.success("Perfil atualizado.");
    } catch (x) { toast.error(friendlyError(x)); } finally { setBusy(false); }
  };
  const avatar = async (f?: File) => {
    if (!f) return;
    try {
      const blob = await compressImage(f, 512, 0.85);
      const path = `${profile.id}/avatar-${Date.now()}.jpg`;
      await api().upload("avatars", path, blob);
      const url = await api().fileUrl("avatars", path);
      await api().update("profiles", profile.id, { avatar_url: url });
      await refresh();
      toast.success("Foto atualizada.");
    } catch (x) { toast.error(friendlyError(x)); }
  };
  const senha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pBusy) return;
    if (s1.length < 8 || !/[A-Za-z]/.test(s1) || !/\d/.test(s1)) { setPErr("Use ao menos 8 caracteres, com letras e números."); return; }
    if (s1 !== s2) { setPErr("As senhas não conferem."); return; }
    setPBusy(true); setPErr("");
    try { await api().updatePassword(s1); setS1(""); setS2(""); toast.success("Senha alterada com sucesso."); }
    catch (x) { setPErr(friendlyError(x)); } finally { setPBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-4">
      <PageHeader eyebrow="Conta" title="Meu perfil" />
      <Card>
        <div className="mb-5 flex items-center gap-4">
          <div className="relative">
            <Avatar nome={profile.nome} url={profile.avatar_url} size={72} />
            <button onClick={() => file.current?.click()} aria-label="Alterar foto" className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-pearl text-[#0B0B0D] ring-4 ring-surface"><Camera className="h-4 w-4" /></button>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => avatar(e.target.files?.[0])} />
          </div>
          <div><p className="text-lg font-semibold">{profile.nome}</p><p className="text-sm text-muted">@{profile.username}{profile.email ? ` · ${profile.email}` : ""}</p><Badge tone="pearl" className="mt-1.5">{role ? ROLE_LABEL[role] : ""}</Badge></div>
        </div>
        <form onSubmit={salvar} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required error={err.nome} htmlFor="n" className="sm:col-span-2"><Input id="n" value={nome} invalid={!!err.nome} onChange={(e) => setNome(e.target.value)} /></Field>
          <Field label="Usuário (login)" htmlFor="us" hint="Alterado somente pelo administrador."><Input id="us" value={profile.username} disabled /></Field>
          <Field label="E-mail" htmlFor="em" hint="Para incluir ou alterar o e-mail, fale com o administrador."><Input id="em" value={profile.email ?? "Sem e-mail"} disabled /></Field>
          <Field label="Telefone" error={err.tel} htmlFor="t"><Input id="t" type="tel" inputMode="tel" value={tel} invalid={!!err.tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(99) 99999-9999" /></Field>
          {role !== "cliente" && <Field label="Cargo / função" htmlFor="c"><Input id="c" value={cargo} onChange={(e) => setCargo(e.target.value)} /></Field>}
          <Field label="Perfil de acesso" htmlFor="r" hint="Definido pelo administrador."><Input id="r" value={role ? ROLE_LABEL[role] : ""} disabled /></Field>
          <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={busy} icon={<Save className="h-4 w-4" />}>Salvar</Button></div>
        </form>
      </Card>
      <Card title="Alterar senha" icon={<KeyRound className="h-4 w-4" />}>
        <form onSubmit={senha} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Nova senha" htmlFor="s1"><PasswordInput id="s1" autoComplete="new-password" value={s1} onChange={(e) => { setS1(e.target.value); setPErr(""); }} /></Field>
          <Field label="Confirmar nova senha" htmlFor="s2" error={pErr}><PasswordInput id="s2" autoComplete="new-password" value={s2} invalid={!!pErr} onChange={(e) => { setS2(e.target.value); setPErr(""); }} /></Field>
          <div className="flex justify-end sm:col-span-2"><Button type="submit" variant="secondary" loading={pBusy}>Alterar senha</Button></div>
        </form>
      </Card>
      <div className="flex justify-center pt-2">
        <Button variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={async () => { if (await confirm({ title: "Sair do sistema?", confirm: "Sair" })) { await signOut(); nav("/login", { replace: true }); } }}>Sair</Button>
      </div>
    </div>
  );
}
