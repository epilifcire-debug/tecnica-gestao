import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { api } from "@/data/api";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, PasswordInput } from "@/components/ui/Form";
import { FullScreenLoader } from "@/components/ui/Feedback";
import { friendlyError } from "@/lib/errors";
import { AuthLayout } from "./AuthLayout";

const RULES = [
  { test: (s: string) => s.length >= 8, label: "Mínimo de 8 caracteres" },
  { test: (s: string) => /[A-Za-z]/.test(s) && /\d/.test(s), label: "Letras e números" },
  { test: (s: string) => /[A-Z]/.test(s), label: "Uma letra maiúscula" },
];

export default function NovaSenha() {
  const { status, recovery, signOut } = useAuth();
  const nav = useNavigate();
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, []);
  const ok = useMemo(() => RULES.every((r) => r.test(s1)), [s1]);
  const hasSession = status === "ready" || recovery;

  if (!hasSession && !waited) return <FullScreenLoader label="Validando link…" />;
  if (!hasSession)
    return (
      <AuthLayout>
        <div className="card card-pad text-center">
          <h1 className="text-xl font-bold">Link inválido ou expirado</h1>
          <p className="mt-2 text-sm text-muted">Solicite um novo link de redefinição de senha.</p>
          <Link to="/esqueci-senha"><Button className="mt-6 w-full">Solicitar novo link</Button></Link>
        </div>
      </AuthLayout>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!ok) { setErr("A senha não atende aos requisitos."); return; }
    if (s1 !== s2) { setErr("As senhas não conferem."); return; }
    setBusy(true); setErr(null);
    try {
      await api().updatePassword(s1);
      await signOut();
      toast.success("Senha alterada com sucesso. Faça login novamente.");
      nav("/login", { replace: true });
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold">Criar nova senha</h1>
      <p className="mt-1 text-sm text-muted">Defina uma senha forte para sua conta.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Field label="Nova senha" htmlFor="s1" required>
          <PasswordInput id="s1" autoComplete="new-password" value={s1} onChange={(e) => { setS1(e.target.value); setErr(null); }} disabled={busy} />
        </Field>
        <ul className="grid gap-1.5 text-[13px]" aria-label="Requisitos da senha">
          {RULES.map((r) => {
            const pass = r.test(s1);
            return <li key={r.label} className={clsx("flex items-center gap-2", pass ? "text-ok" : "text-muted")}>{pass ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{r.label}</li>;
          })}
        </ul>
        <Field label="Confirmar nova senha" htmlFor="s2" required error={err}>
          <PasswordInput id="s2" autoComplete="new-password" value={s2} invalid={!!err} onChange={(e) => { setS2(e.target.value); setErr(null); }} disabled={busy} />
        </Field>
        {s2 && s1 !== s2 && !err && <p className="text-[13px] text-orange-300">As senhas ainda não conferem.</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!ok || s1 !== s2}>Salvar nova senha</Button>
      </form>
    </AuthLayout>
  );
}
