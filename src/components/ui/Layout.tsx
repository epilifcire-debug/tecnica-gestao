import type { ReactNode } from "react";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function PageHeader({ eyebrow, title, subtitle, actions, back }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="truncate text-2xl font-bold sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted sm:text-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, icon, action, children, className, pad = true }: { title?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold">{icon && <span className="text-gold">{icon}</span>}{title}</h2>
          {action}
        </header>
      )}
      <div className={clsx(pad && "card-pad", title && pad && "pt-3")}>{children}</div>
    </section>
  );
}

export function SeeAll({ to, label = "Ver todos" }: { to: string; label?: string }) {
  return <Link to={to} className="inline-flex h-8 items-center gap-1 rounded-lg border border-gold/40 px-2.5 text-[12.5px] text-gold-soft hover:bg-gold/10">{label}<ChevronRight className="h-3.5 w-3.5" /></Link>;
}

const ICON_TONE = {
  gold: "from-gold/30 to-gold/10 text-gold-soft ring-gold/30", ok: "from-ok/30 to-ok/10 text-ok ring-ok/30",
  bad: "from-bad/30 to-bad/10 text-red-300 ring-bad/30", info: "from-info/30 to-info/10 text-blue-300 ring-info/30",
  violet: "from-violet/30 to-violet/10 text-violet-300 ring-violet/30", warn: "from-warn/30 to-warn/10 text-orange-300 ring-warn/30",
} as const;
export type IconTone = keyof typeof ICON_TONE;
export function IconTile({ tone, children, size = 48 }: { tone: IconTone; children: ReactNode; size?: number }) {
  return <span className={clsx("grid shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1", ICON_TONE[tone])} style={{ width: size, height: size }}>{children}</span>;
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={clsx("-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}>
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)}
          className={clsx("h-9 shrink-0 rounded-lg px-3.5 text-sm transition", value === it.value ? "bg-gold/15 text-gold-soft ring-1 ring-gold/50" : "text-muted hover:bg-surface-2 hover:text-ink")}>
          {it.label}{it.count !== undefined && <span className="ml-1.5 text-[11px] opacity-70">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
