import clsx from "clsx";
import type { Tone } from "@/data/types";
import { Logo } from "./Logo";

const TONE: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok border-ok/25", bad: "bg-bad/12 text-red-300 border-bad/30", warn: "bg-warn/12 text-orange-300 border-warn/30",
  info: "bg-info/12 text-blue-300 border-info/30", violet: "bg-violet/12 text-violet-300 border-violet/30",
  pearl: "bg-pearl/12 text-pearl-soft border-pearl/30", muted: "bg-surface-2 text-muted border-line",
};
export function Badge({ tone = "muted", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={clsx("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium", TONE[tone], className)}>{children}</span>;
}
export function StatusBadge<K extends string>({ map, value }: { map: Record<K, { label: string; tone: Tone }>; value: K | null | undefined }) {
  if (!value || !map[value]) return <Badge>—</Badge>;
  return <Badge tone={map[value].tone}>{map[value].label}</Badge>;
}

export function Progress({ value, className, tone = "pearl", label }: { value: number; className?: string; tone?: "pearl" | "ok" | "info" | "bad"; label?: string }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const bar = { pearl: "from-pearl to-pearl-soft", ok: "from-ok/80 to-ok", info: "from-info/80 to-info", bad: "from-bad/80 to-bad" }[tone];
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-line/70", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progresso"}>
      <div className={clsx("h-full rounded-full bg-gradient-to-r transition-[width] duration-700", bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("relative overflow-hidden rounded-lg bg-surface-2", className)}><div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" /></div>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-5 w-5 animate-spin rounded-full border-2 border-pearl/30 border-t-pearl", className)} aria-hidden />;
}

export function FullScreenLoader({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5 animate-fade-up">
        <Logo variant="stack" size="md" />
        <div className="flex items-center gap-3 text-sm text-muted"><Spinner className="h-4 w-4" />{label}</div>
      </div>
    </div>
  );
}

export function Avatar({ nome, url, size = 36 }: { nome?: string | null; url?: string | null; size?: number }) {
  const ini = (nome ?? "?").trim().split(/\s+/).filter((p) => !/^(eng|dr|dra|sr|sra)\.?$/i.test(p)).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return url
    ? <img src={url} alt="" className="shrink-0 rounded-full object-cover ring-1 ring-line" style={{ width: size, height: size }} />
    : <span className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-ink/90 ring-1 ring-line" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>{ini || "?"}</span>;
}
