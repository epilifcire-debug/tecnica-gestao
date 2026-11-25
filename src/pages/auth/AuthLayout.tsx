import type { ReactNode } from "react";
import { ColorBends, PRESET_PEROLA } from "@/components/ui/ColorBends";
import { Logo } from "@/components/ui/Logo";
import { Signature } from "@/components/layout/Signature";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line/50 lg:block">
        <div className="absolute inset-0 opacity-90"><ColorBends {...PRESET_PEROLA} /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo variant="stack" size="md" className="items-start text-left [&>*]:self-start" />
          <div>
            <p className="font-display text-[40px] font-semibold leading-[1.1]">Obras bem geridas,<br />resultados reais.</p>
            <div className="mt-5 h-1 w-16 rounded-full bg-pearl" />
            <p className="mt-10 space-y-1 text-[12px] font-medium tracking-[0.5em] text-ink/70">
              <span className="block">PLANEJAMENTO</span><span className="block">EXECUÇÃO</span><span className="block">RESULTADOS</span>
            </p>
          </div>
        </div>
      </aside>
      <main className="relative flex flex-col items-center justify-center px-5 py-10" style={{ paddingTop: "calc(var(--safe-top) + 2.5rem)" }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-50 lg:hidden"><ColorBends {...PRESET_PEROLA} iterations={1} intensity={0.9} /></div>
        <div className="relative w-full max-w-[400px] animate-fade-up">
          <div className="mb-8 flex justify-center lg:hidden"><Logo variant="stack" size="md" /></div>
          {children}
        </div>
        <div className="relative mt-10 flex flex-col items-center gap-1 text-center text-[11px] text-muted"><Signature /><span className="tabular-nums opacity-70">v{__APP_VERSION__}</span></div>
      </main>
    </div>
  );
}
