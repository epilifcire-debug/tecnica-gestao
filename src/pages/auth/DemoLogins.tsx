import { DEMO_LOGINS } from "@/data/demoApi";

export default function DemoLogins({ onPick }: { onPick: (email: string) => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-4">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-gold">Pré-visualização — escolha um perfil</p>
      <div className="mt-3 grid gap-2">
        {DEMO_LOGINS.map((d) => (
          <button key={d.email} type="button" onClick={() => onPick(d.email)} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-sm hover:border-gold/50">
            <span>{d.label}</span><span className="text-xs text-muted">{d.email}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">Entre com o usuário ou o e-mail. Qualquer senha funciona na demonstração.</p>
    </div>
  );
}
