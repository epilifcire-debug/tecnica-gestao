import type { ReactNode } from "react";
import { AlertTriangle, Lock, Inbox, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import { Skeleton } from "./Feedback";
import { friendlyError } from "@/lib/errors";

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center animate-fade-up">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-bad/30 bg-bad/5 px-6 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-bad/15 text-red-300">{offline ? <WifiOff className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}</div>
      <p className="font-medium">{offline ? "Você está sem conexão" : "Não foi possível carregar"}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{friendlyError(error)}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export function NoPermission() {
  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="card card-pad flex flex-col items-center py-12 text-center">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-pearl/10 text-pearl"><Lock className="h-7 w-7" /></div>
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="mt-2 text-sm text-muted">Você não possui permissão para acessar esta área.</p>
        <Link to="/" className="mt-5"><Button variant="secondary">Voltar ao início</Button></Link>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );
}

/** Renderiza loading / erro / vazio / conteúdo de forma consistente */
export function QueryView<T>({ q, empty, children, skeleton }: {
  q: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown };
  empty?: ReactNode; children: (data: T) => ReactNode; skeleton?: ReactNode;
}) {
  if (q.isLoading) return <>{skeleton ?? <ListSkeleton />}</>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data as T;
  if (empty && (d == null || (Array.isArray(d) && d.length === 0))) return <>{empty}</>;
  return <>{children(d)}</>;
}
