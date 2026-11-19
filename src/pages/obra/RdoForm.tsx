import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { isGestor } from "@/auth/permissions";
import { api } from "@/data/api";
import type { Obra, Row } from "@/data/types";
import { CLIMA } from "@/data/types";
import { useGet, useList } from "@/lib/hooks";
import { date, today } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { resolveDemoUrl } from "@/lib/demoArt";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Form";
import { Card } from "@/components/ui/Layout";
import { Skeleton } from "@/components/ui/Feedback";
import { ErrorState, NoPermission } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/Modal";
import { PhotoUpload } from "./PhotoUpload";
import { Thumb } from "./FotosTab";

const CLIMA_OPTS = Object.entries(CLIMA).map(([value, label]) => ({ value, label }));
const EMPTY = { data: today(), clima_manha: "ensolarado", clima_tarde: "", equipe: "", efetivo_total: "", servicos_executados: "", ocorrencias: "", observacoes: "", visivel_cliente: true };

export default function RdoForm() {
  const { id: obraId, rdoId } = useParams();
  const isNew = rdoId === "novo";
  const nav = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { role, userId } = useAuth();
  const obra = useGet<Obra>("obras", obraId);
  const rdo = useGet<Row>("rdos", isNew ? undefined : rdoId, ["autor"]);
  const fotos = useList<Row>("obra_fotos", { eq: { rdo_id: rdoId } }, !isNew);
  const [v, setV] = useState<Row>(EMPTY);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => { if (rdo.data) setV({ ...EMPTY, ...Object.fromEntries(Object.entries(rdo.data).map(([k, x]) => [k, x ?? ""])) }); }, [rdo.data]);
  const canEdit = isNew || isGestor(role) || rdo.data?.autor_id === userId;
  const set = (k: string, x: unknown) => { setV((s) => ({ ...s, [k]: x })); setErr((e) => ({ ...e, [k]: "" })); };

  if (obra.isLoading || (!isNew && rdo.isLoading)) return <Skeleton className="h-96" />;
  if (obra.isError) return <ErrorState error={obra.error} />;
  if (!obra.data || (!isNew && !rdo.data)) return <NoPermission />;

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const er: Record<string, string> = {};
    if (!v.data) er.data = "Informe a data.";
    if (v.data > today()) er.data = "O RDO não pode ser de data futura.";
    if (!String(v.servicos_executados).trim()) er.servicos_executados = "Descreva os serviços executados.";
    if (v.efetivo_total !== "" && (isNaN(Number(v.efetivo_total)) || Number(v.efetivo_total) < 0)) er.efetivo_total = "Número inválido.";
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const payload = {
      data: v.data, clima_manha: v.clima_manha || null, clima_tarde: v.clima_tarde || null, equipe: String(v.equipe).trim() || null,
      efetivo_total: v.efetivo_total === "" ? null : Number(v.efetivo_total), servicos_executados: String(v.servicos_executados).trim(),
      ocorrencias: String(v.ocorrencias).trim() || null, observacoes: String(v.observacoes).trim() || null, visivel_cliente: !!v.visivel_cliente,
    };
    try {
      const r = isNew ? await api().insert<Row>("rdos", { ...payload, obra_id: obraId }) : await api().update<Row>("rdos", rdoId!, payload);
      qc.invalidateQueries({ queryKey: ["rdos"] });
      toast.success(isNew ? "RDO registrado." : "RDO atualizado.");
      if (isNew) nav(`/obras/${obraId}/rdo/${r.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e?.code === "23505" ? "Já existe um RDO desta obra nesta data." : friendlyError(e));
    } finally { setBusy(false); }
  };

  const gerarPdf = async () => {
    setPdfBusy(true);
    try {
      const [{ pdfRdo, savePdf }, cfg] = await Promise.all([import("@/lib/pdf"), api().list<Row>("empresa_config", { limit: 1 })]);
      const urls = await Promise.all((fotos.data ?? []).slice(0, 6).map(async (f) => ({ url: resolveDemoUrl(await api().fileUrl("obras", f.storage_path)) ?? "", legenda: f.legenda })));
      const doc = await pdfRdo({ ...rdo.data, ...v }, obra.data!, cfg[0] ?? null, urls.filter((u) => u.url));
      savePdf(doc, `RDO ${obra.data!.nome} ${date(v.data)}.pdf`);
    } catch (e) { toast.error(friendlyError(e, "Não foi possível gerar o PDF.")); } finally { setPdfBusy(false); }
  };

  const excluir = async () => {
    if (!(await confirm({ title: "Excluir RDO?", text: "O relatório deste dia será removido. As fotos continuam na galeria da obra.", danger: true, confirm: "Excluir" }))) return;
    try { await api().remove("rdos", rdoId!); qc.invalidateQueries({ queryKey: ["rdos"] }); toast.success("RDO excluído."); nav(`/obras/${obraId}?aba=rdo`, { replace: true }); }
    catch (e) { toast.error(friendlyError(e)); }
  };

  return (
    <form onSubmit={save} noValidate className="mx-auto max-w-3xl animate-fade-up">
      <button type="button" onClick={() => nav(`/obras/${obraId}?aba=rdo`)} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />{obra.data.nome}</button>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div><p className="eyebrow">Diário de obra</p><h1 className="mt-1 text-2xl font-bold">RDO — {date(v.data)}</h1></div>
        {!isNew && isGestor(role) && <Button variant="ghost" size="icon" onClick={excluir} aria-label="Excluir RDO"><Trash2 className="h-5 w-5 text-red-300" /></Button>}
      </div>

      <fieldset disabled={!canEdit || busy} className="space-y-4">
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Data" required error={err.data} htmlFor="data"><Input id="data" type="date" max={today()} value={v.data} onChange={(e) => set("data", e.target.value)} invalid={!!err.data} /></Field>
            <Field label="Clima — manhã" htmlFor="cm"><Select id="cm" value={v.clima_manha} onChange={(e) => set("clima_manha", e.target.value)} options={CLIMA_OPTS} placeholder="—" /></Field>
            <Field label="Clima — tarde" htmlFor="ct"><Select id="ct" value={v.clima_tarde} onChange={(e) => set("clima_tarde", e.target.value)} options={CLIMA_OPTS} placeholder="—" /></Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field label="Equipe" htmlFor="eq" hint="Ex.: 2 Pedreiros, 1 Servente, 1 Eletricista"><Input id="eq" value={v.equipe} onChange={(e) => set("equipe", e.target.value)} /></Field>
            <Field label="Efetivo total" htmlFor="ef" error={err.efetivo_total}><Input id="ef" type="number" inputMode="numeric" min={0} value={v.efetivo_total} onChange={(e) => set("efetivo_total", e.target.value)} invalid={!!err.efetivo_total} /></Field>
          </div>
        </Card>
        <Card>
          <div className="space-y-4">
            <Field label="Serviços executados" required error={err.servicos_executados} htmlFor="sv"><Textarea id="sv" rows={4} value={v.servicos_executados} onChange={(e) => set("servicos_executados", e.target.value)} invalid={!!err.servicos_executados} /></Field>
            <Field label="Ocorrências" htmlFor="oc"><Textarea id="oc" value={v.ocorrencias} onChange={(e) => set("ocorrencias", e.target.value)} placeholder="Atrasos, acidentes, falta de material, chuva…" /></Field>
            <Field label="Observações" htmlFor="ob"><Textarea id="ob" value={v.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></Field>
            <Switch label="Visível para o cliente no Portal" checked={!!v.visivel_cliente} onChange={(x) => set("visivel_cliente", x)} disabled={!canEdit} />
          </div>
        </Card>
      </fieldset>

      <Card title="Fotos do dia" className="mt-4" action={!isNew && canEdit && <PhotoUpload obraId={obraId!} rdoId={rdoId} data={v.data} label="Adicionar" variant="secondary" />}>
        {isNew ? <p className="text-sm text-muted">Salve o RDO para anexar fotos.</p> :
          !fotos.data?.length ? <p className="text-sm text-muted">Nenhuma foto neste RDO.</p> :
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{fotos.data.map((f) => <Thumb key={f.id} f={f} className="aspect-square" />)}</div>}
      </Card>

      <div className="sticky bottom-20 z-10 mt-5 flex flex-col gap-2 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur sm:flex-row sm:justify-end lg:bottom-4">
        {!isNew && <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} loading={pdfBusy} onClick={gerarPdf}>Gerar RDO (PDF)</Button>}
        {canEdit && <Button type="submit" icon={<Save className="h-4 w-4" />} loading={busy}>{isNew ? "Registrar RDO" : "Salvar alterações"}</Button>}
      </div>
    </form>
  );
}
