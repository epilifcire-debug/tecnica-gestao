import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { api } from "@/data/api";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { friendlyError } from "@/lib/errors";
import { validEmail } from "@/lib/format";
import { AuthLayout } from "./AuthLayout";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!validEmail(email)) { setErr("Informe um e-mail válido."); return; }
    setBusy(true); setErr(null);
    try {
      await api().requestPasswordReset(email);
      setSent(true); // mensagem genérica: não revela se o e-mail existe
    } catch (e) {
      setErr(friendlyError(e));
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout>
      <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Voltar ao login</Link>
      {sent ? (
        <div className="card card-pad text-center" role="status">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-ok/15 text-ok"><MailCheck className="h-7 w-7" /></div>
          <h1 className="text-xl font-bold">Verifique seu e-mail</h1>
          <p className="mt-2 text-sm text-muted">Se o e-mail informado estiver cadastrado, você receberá em instantes um link seguro para criar uma nova senha.</p>
          <Link to="/login"><Button variant="secondary" className="mt-6 w-full">Voltar ao login</Button></Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Esqueci minha senha</h1>
          <p className="mt-1 text-sm text-muted">Informe seu e-mail para receber o link de redefinição.</p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <Field label="E-mail" htmlFor="email" error={err} required>
              <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="seu@email.com" value={email} invalid={!!err}
                onChange={(e) => { setEmail(e.target.value); setErr(null); }} disabled={busy} />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>Enviar link</Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
