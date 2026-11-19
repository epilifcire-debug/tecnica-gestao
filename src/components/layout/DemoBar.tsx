import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

/** Faixa fixa do modo demonstração — deixa claro que não é produção. */
export function DemoBar() {
  const reset = async () => {
    const { resetDemo } = await import("@/data/demoApi");
    resetDemo();
    toast.success("Dados de demonstração restaurados.");
    setTimeout(() => window.location.reload(), 400);
  };
  return (
    <div className="flex items-center justify-center gap-3 bg-gradient-to-r from-gold/25 via-gold/15 to-gold/25 px-3 py-1.5 text-center text-[12px] text-gold-soft">
      <span><strong>Pré-visualização</strong> — dados fictícios de demonstração, salvos só neste navegador.</span>
      <button onClick={reset} className="inline-flex items-center gap-1 rounded-md border border-gold/40 px-2 py-0.5 hover:bg-gold/10"><RotateCcw className="h-3 w-3" />Restaurar</button>
    </div>
  );
}
