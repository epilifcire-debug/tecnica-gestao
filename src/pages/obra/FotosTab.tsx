import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Images, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import type { Obra, Row } from "@/data/types";
import { useFileUrl, useList, useSave } from "@/lib/hooks";
import { date } from "@/lib/format";
import { Card } from "@/components/ui/Layout";
import { Skeleton } from "@/components/ui/Feedback";
import { EmptyState, QueryView } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/Modal";
import { PhotoUpload } from "./PhotoUpload";

export function Thumb({ f, onClick, className = "aspect-[4/3]" }: { f: Row; onClick?: () => void; className?: string }) {
  const u = useFileUrl("obras", f.storage_path);
  return (
    <button onClick={onClick} className={`group relative w-full overflow-hidden rounded-xl bg-surface-2 ${className}`} aria-label={f.legenda ?? "Foto"}>
      {u.data ? <img src={u.data} alt={f.legenda ?? ""} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <Skeleton className="h-full w-full" />}
    </button>
  );
}

export function FotosTab({ obra, readOnly }: { obra: Obra; readOnly?: boolean }) {
  const q = useList<Row>("obra_fotos", { eq: { obra_id: obra.id }, order: [{ col: "data", asc: false }, { col: "created_at", asc: false }] });
  const [view, setView] = useState<number | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    (q.data ?? []).forEach((f) => m.set(f.data, [...(m.get(f.data) ?? []), f]));
    return [...m.entries()];
  }, [q.data]);
  const flat = q.data ?? [];
  return (
    <Card title="Fotos da obra" icon={<Images className="h-5 w-5" />} action={!readOnly && <PhotoUpload obraId={obra.id} />}>
      <QueryView q={q} empty={<EmptyState title="Nenhuma foto registrada." text={readOnly ? undefined : "Envie fotos pelo celular direto da obra."} />}>
        {() => (
          <div className="space-y-5">
            {groups.map(([d, fotos]) => (
              <section key={d}>
                <h3 className="mb-2 text-sm font-semibold">{date(d)}</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {fotos.map((f) => <Thumb key={f.id} f={f} onClick={() => setView(flat.indexOf(f))} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </QueryView>
      {view !== null && flat[view] && <Lightbox fotos={flat} i={view} setI={setView} readOnly={readOnly} />}
    </Card>
  );
}

function Lightbox({ fotos, i, setI, readOnly }: { fotos: Row[]; i: number; setI: (n: number | null) => void; readOnly?: boolean }) {
  const f = fotos[i];
  const u = useFileUrl("obras", f.storage_path);
  const { role, userId } = useAuth();
  const confirm = useConfirm();
  const del = useSave(async () => { await api().remove("obra_fotos", f.id); await api().removeFile("obras", f.storage_path).catch(() => {}); }, { invalidate: ["obra_fotos"], success: "Foto excluída.", onDone: () => setI(null) });
  const canDel = !readOnly && (isGestor(role) || f.autor_id === userId);
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Visualizar foto" onKeyDown={(e) => { if (e.key === "Escape") setI(null); }}>
      <div className="flex items-center justify-between p-3" style={{ paddingTop: "calc(var(--safe-top) + .75rem)" }}>
        <p className="text-sm text-ink/80">{f.legenda} · {date(f.data)}</p>
        <div className="flex gap-1">
          {canDel && <button className="grid h-10 w-10 place-items-center rounded-lg text-red-300 hover:bg-white/10" aria-label="Excluir foto"
            onClick={async () => (await confirm({ title: "Excluir foto?", danger: true, confirm: "Excluir" })) && del.mutate(undefined)}><Trash2 className="h-5 w-5" /></button>}
          <button autoFocus className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10" onClick={() => setI(null)} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-3">
        {u.data && <img src={u.data} alt={f.legenda ?? ""} className="max-h-full max-w-full rounded-lg object-contain" />}
        {i > 0 && <button className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={() => setI(i - 1)} aria-label="Anterior"><ChevronLeft /></button>}
        {i < fotos.length - 1 && <button className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={() => setI(i + 1)} aria-label="Próxima"><ChevronRight /></button>}
      </div>
    </div>,
    document.body,
  );
}
