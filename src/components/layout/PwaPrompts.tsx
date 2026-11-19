import { useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Aviso de nova versão: atualiza só quando o usuário confirmar (sem reload no meio de um formulário). */
export function UpdatePrompt() {
  const [need, setNeed] = useState(false);
  const [update, setUpdate] = useState<null | ((reload?: boolean) => Promise<void>)>(null);
  useEffect(() => {
    if (import.meta.env.MODE === "demo" || !("serviceWorker" in navigator)) return;
    import("virtual:pwa-register").then(({ registerSW }) => {
      const fn = registerSW({
        onNeedRefresh: () => setNeed(true),
        onRegisteredSW: (_u, reg) => { if (reg) setInterval(() => reg.update(), 60 * 60_000); },
      });
      setUpdate(() => fn);
    }).catch(() => { /* PWA indisponível: app segue como site */ });
  }, []);
  if (!need) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-gold/40 bg-surface p-3.5 shadow-2xl lg:bottom-6">
      <RefreshCw className="h-5 w-5 shrink-0 text-gold" />
      <p className="flex-1 text-sm">Nova versão disponível.</p>
      <Button size="sm" onClick={() => update?.(true)}>Atualizar</Button>
      <button onClick={() => setNeed(false)} aria-label="Depois" className="text-muted"><X className="h-4 w-4" /></button>
    </div>
  );
}

/** Convite de instalação discreto, só quando o navegador permite e uma vez por semana no máximo. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<any>(null);
  useEffect(() => {
    let last = 0; try { last = Number(localStorage.getItem("tecnica-install-dismiss") || 0); } catch { /* */ }
    if (Date.now() - last < 7 * 864e5) return;
    const h = (e: Event) => { e.preventDefault(); setEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evt) return null;
  const close = () => { try { localStorage.setItem("tecnica-install-dismiss", String(Date.now())); } catch { /* */ } setEvt(null); };
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-2xl lg:bottom-6">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="h-10 w-10 rounded-full" />
      <div className="flex-1 text-sm"><p className="font-medium">Instalar o app Técnica</p><p className="text-xs text-muted">Acesso rápido pela tela inicial.</p></div>
      <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null); }}>Instalar</Button>
      <button onClick={close} aria-label="Agora não" className="text-muted"><X className="h-4 w-4" /></button>
    </div>
  );
}
