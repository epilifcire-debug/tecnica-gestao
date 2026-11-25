import { lazy, Suspense, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Form";
import { friendlyError } from "@/lib/errors";
import { validEmail } from "@/lib/format";
import { IS_DEMO } from "@/lib/env";
import { AuthLayout } from "./AuthLayout";
const DemoLogins = IS_DEMO ? lazy(() => import("./DemoLogins")) : null;

export default function Login() {
  const { signIn, status } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string; status?: string } };
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [errors, setErrors] = useState<{ email?: string; senha?: string }>({});
  const [erro, setErro] = useState<string | null>(status === "inactive" ? "Seu acesso está desativado. Procure o administrador." : status === "no_profile" ? "Seu usuário não possui perfil de acesso configurado." : null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // impede múltiplos envios
    const er: typeof errors = {};
    const login = email.trim();
    if (!login) er.email = "Informe seu usuário ou e-mail.";
    else if (login.includes("@") && !validEmail(login)) er.email = "E-mail inválido.";
    else if (!login.includes("@") && login.length < 3) er.email = "Usuário inválido.";
    if (!senha) er.senha = "Informe sua senha.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true); setErro(null);
    try {
      await signIn(email, senha);
      // o AuthProvider valida perfil/ativo; PublicOnly redireciona conforme o papel
      const from = loc.state?.from;
      if (from && from !== "/login") nav(from, { replace: true });
    } catch (err) {
      setErro(friendlyError(err, "Não foi possível entrar. Tente novamente."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="text-center lg:text-left">
        <h1 className="text-2xl font-bold">Bem-vindo!</h1>
        <p className="mt-1 text-sm text-muted">Faça login para continuar</p>
      </div>
      <form onSubmit={submit} noValidate className="mt-7 space-y-4">
        {erro && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-3 text-sm text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{erro}</div>}
        <Field label="Usuário ou e-mail" htmlFor="email" error={errors.email} required>
          <Input id="email" type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" placeholder="seu.usuario ou seu@email.com" value={email}
            invalid={!!errors.email} onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: undefined })); }} disabled={busy} />
        </Field>
        <Field label="Senha" htmlFor="senha" error={errors.senha} required>
          <PasswordInput id="senha" autoComplete="current-password" placeholder="••••••••" value={senha}
            invalid={!!errors.senha} onChange={(e) => { setSenha(e.target.value); setErrors((x) => ({ ...x, senha: undefined })); }} disabled={busy} />
        </Field>
        <div className="flex justify-end">
          <Link to="/esqueci-senha" className="text-sm text-pearl-soft hover:underline">Esqueci minha senha</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy} icon={!busy && <LogIn className="h-4 w-4" />}>{busy ? "Entrando…" : "Entrar"}</Button>
      </form>
      {DemoLogins && <Suspense fallback={null}><DemoLogins onPick={(e: string) => { setEmail(e); setSenha("demonstracao"); }} /></Suspense>}
      <p className="mt-8 text-center text-xs text-muted">Acesso restrito. Contas são criadas pelo administrador.</p>
    </AuthLayout>
  );
}
