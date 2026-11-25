import { useRef, useState } from "react";
import { Download, Eye, EyeOff, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import type { Row } from "@/data/types";
import { useList, useSave } from "@/lib/hooks";
import { date } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Layout";
import { Badge } from "@/components/ui/Feedback";
import { Select } from "@/components/ui/Form";
import { EmptyState, QueryView } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/Modal";

const CATS = ["Projeto", "Contrato", "ART", "Alvará", "Nota fiscal", "Memorial", "Outros"];
const size = (b?: number) => (!b ? "" : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export async function openFile(bucket: string, path: string) {
  try {
    const u = await api().fileUrl(bucket, path);
    if (u.startsWith("demo://")) { toast.info("Arquivo de exemplo da demonstração."); return; }
    window.open(u, "_blank", "noopener");
  } catch (e) { toast.error(friendlyError(e, "Não foi possível abrir o arquivo.")); }
}

/** Documentos de uma obra (obraId) ou gerais da empresa (obraId null). */
export function DocsTab({ obra, readOnly }: { obra?: { id: string } | null; readOnly?: boolean }) {
  const { role, userId } = useAuth();
  const gestor = isGestor(role);
  const obraId = obra?.id ?? null;
  const q = useList<Row>("documentos", { ...(obraId ? { eq: { obra_id: obraId } } : {}), embed: ["obra"], order: [{ col: "created_at", asc: false }] });
  const ref = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState("Projeto");
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const canUpload = !readOnly && (obraId ? role !== "cliente" : gestor);

  const upload = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("Arquivo acima de 25 MB."); return; }
    setBusy(true);
    const bucket = obraId ? "obras" : "documentos";
    const path = obraId ? `${obraId}/docs/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, "_")}` : `geral/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
    try {
      await api().upload(bucket, path, f);
      try { await api().insert("documentos", { obra_id: obraId, nome: f.name, categoria: cat, storage_path: path, mime_type: f.type, tamanho_bytes: f.size, visivel_cliente: false }); }
      catch (e) { await api().removeFile(bucket, path).catch(() => {}); throw e; }
      toast.success("Documento enviado.");
      q.refetch();
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  const toggle = useSave((d: Row) => api().update("documentos", d.id, { visivel_cliente: !d.visivel_cliente }), { invalidate: ["documentos"], success: "Visibilidade atualizada." });
  const del = useSave(async (d: Row) => { await api().remove("documentos", d.id); await api().removeFile(d.obra_id ? "obras" : "documentos", d.storage_path).catch(() => {}); }, { invalidate: ["documentos"], success: "Documento excluído." });

  return (
    <Card title={obraId ? "Documentos da obra" : "Documentos"} icon={<FileText className="h-5 w-5" />}
      action={canUpload && (
        <div className="flex items-center gap-2">
          <Select className="h-9 w-36" value={cat} onChange={(e) => setCat(e.target.value)} options={CATS.map((c) => ({ value: c, label: c }))} aria-label="Categoria" />
          <input ref={ref} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.dwg" onChange={(e) => upload(e.target.files)} />
          <Button size="sm" loading={busy} icon={<Upload className="h-4 w-4" />} onClick={() => ref.current?.click()}>Enviar</Button>
        </div>
      )}>
      <QueryView q={q} empty={<EmptyState title="Nenhum documento." />}>
        {(rows) => (
          <ul className="divide-y divide-line/50">
            {rows.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-pearl"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.nome}</p>
                  <p className="truncate text-xs text-muted">{d.categoria} · {date(d.created_at)} {size(d.tamanho_bytes)}{!obraId && d.obra ? ` · ${d.obra.nome}` : ""}</p>
                </div>
                {d.obra_id && role !== "cliente" && <Badge tone={d.visivel_cliente ? "ok" : "muted"} className="hidden sm:inline-flex">{d.visivel_cliente ? "Cliente vê" : "Interno"}</Badge>}
                <div className="flex">
                  {gestor && d.obra_id && !readOnly && <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink" aria-label={d.visivel_cliente ? "Ocultar do cliente" : "Mostrar ao cliente"} onClick={() => toggle.mutate(d)}>{d.visivel_cliente ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
                  <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Abrir" onClick={() => openFile(d.obra_id ? "obras" : "documentos", d.storage_path)}><Download className="h-4 w-4" /></button>
                  {!readOnly && (gestor || d.autor_id === userId) && <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-red-300" aria-label="Excluir"
                    onClick={async () => (await confirm({ title: "Excluir documento?", text: d.nome, danger: true, confirm: "Excluir" })) && del.mutate(d)}><Trash2 className="h-4 w-4" /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </Card>
  );
}
