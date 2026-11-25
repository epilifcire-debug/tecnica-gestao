import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { useAuth } from "@/auth/AuthProvider";

/** Assinatura EFCsys — visibilidade/texto/link controlados só pelo Admin Master (empresa_config). */
export function Signature({ className = "" }: { className?: string }) {
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["empresa_config", "get"], queryFn: () => api().get<any>("empresa_config", true as any), enabled: status === "ready", staleTime: 10 * 60_000 });
  const cfg = q.data;
  if (cfg && cfg.assinatura_visivel === false) return null;
  const texto = cfg?.assinatura_texto || "by: efcsys";
  const link = cfg?.assinatura_link || "https://efcsys.com";
  return (
    <a href={link} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[11px] tracking-wide text-muted/80 transition hover:text-pearl ${className}`}
      title="Desenvolvido por EFCsys • Todos os direitos reservados.">
      {texto.startsWith("by:") ? <><span className="opacity-70">by:</span><span className="font-semibold">{texto.replace(/^by:\s*/, "")}</span></> : texto}
    </a>
  );
}
