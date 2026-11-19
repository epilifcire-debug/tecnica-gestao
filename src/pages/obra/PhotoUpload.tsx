import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/data/api";
import { compressImage } from "@/lib/pdf";
import { friendlyError } from "@/lib/errors";
import { today } from "@/lib/format";
import { Button } from "@/components/ui/Button";

const MAX = 20 * 1024 * 1024;

/** Envia fotos para {obra_id}/fotos/... e registra em obra_fotos (sequencial, sem duplicar). */
export function PhotoUpload({ obraId, rdoId, data, label = "Adicionar fotos", variant = "primary" }: { obraId: string; rdoId?: string | null; data?: string; label?: string; variant?: "primary" | "secondary" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) { toast.error("Selecione arquivos de imagem."); return; }
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      setBusy(`${i + 1}/${list.length}`);
      try {
        const blob = await compressImage(list[i]);
        if (blob.size > MAX) throw new Error("Foto acima de 20 MB.");
        const path = `${obraId}/fotos/${data ?? today()}-${crypto.randomUUID()}.jpg`;
        await api().upload("obras", path, blob);
        try {
          await api().insert("obra_fotos", { obra_id: obraId, rdo_id: rdoId ?? null, storage_path: path, data: data ?? today(), legenda: list[i].name.replace(/\.[^.]+$/, "").slice(0, 80) });
        } catch (e) { await api().removeFile("obras", path).catch(() => {}); throw e; } // não deixa arquivo órfão
        ok++;
      } catch (e) { toast.error(`${list[i].name}: ${friendlyError(e)}`); }
    }
    setBusy(null);
    if (ok) { toast.success(ok === 1 ? "Foto enviada." : `${ok} fotos enviadas.`); qc.invalidateQueries({ queryKey: ["obra_fotos"] }); }
    if (ref.current) ref.current.value = "";
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} aria-label="Selecionar fotos" />
      <Button size="sm" variant={variant} loading={!!busy} icon={<Camera className="h-4 w-4" />} onClick={() => ref.current?.click()}>{busy ? `Enviando ${busy}` : label}</Button>
    </>
  );
}
