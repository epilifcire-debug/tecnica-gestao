import clsx from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden>
      <g fill="currentColor"><rect width="120" height="19" rx="2.5" /><rect y="30.5" width="120" height="19" rx="2.5" /><rect y="61" width="120" height="19" rx="2.5" /></g>
    </svg>
  );
}

/** Marca Técnica Engenharia — reproduz a logo oficial (3 barras + lettering). */
export function Logo({ variant = "stack", size = "md", className }: { variant?: "stack" | "inline" | "mark"; size?: "sm" | "md" | "lg"; className?: string }) {
  if (variant === "mark") return <LogoMark className={clsx("text-ink", size === "sm" ? "w-7" : size === "md" ? "w-10" : "w-14", className)} />;
  if (variant === "inline")
    return (
      <div className={clsx("flex items-center gap-3", className)}>
        <LogoMark className="w-8 text-ink" />
        <div className="leading-none">
          <div className="font-display text-[17px] font-bold tracking-[0.08em]">TECNICA</div>
          <div className="mt-1 text-[8.5px] font-medium tracking-[0.42em] text-muted">ENGENHARIA</div>
        </div>
      </div>
    );
  const s = { sm: ["w-12", "text-xl", "text-[9px]", "text-[7px]"], md: ["w-16", "text-[28px]", "text-[11px]", "text-[8px]"], lg: ["w-24", "text-[44px]", "text-[16px]", "text-[10px]"] }[size];
  return (
    <div className={clsx("flex flex-col items-center text-center", className)} aria-label="Técnica Engenharia — Gestão de Obras" role="img">
      <LogoMark className={clsx(s[0], "text-ink")} />
      <div className={clsx("mt-3 font-display font-semibold leading-none tracking-[0.06em]", s[1])}>TECNICA</div>
      <div className={clsx("mt-1.5 font-light tracking-[0.38em] text-ink/90", s[2])}>ENGENHARIA</div>
      <div className={clsx("mt-2 font-medium tracking-[0.42em] text-gold", s[3])}>GESTÃO DE OBRAS</div>
    </div>
  );
}
