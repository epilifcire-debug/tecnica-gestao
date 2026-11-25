import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileDown, Mail, MessageCircle, Plus, Save, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/data/api";
import type { Row } from "@/data/types";
import { ORC_STATUS } from "@/data/types";
import { useGet, useList } from "@/lib/hooks";
import { addDays, digits, isoDate, maskMoneyInput, money, pad, parseMoney, today } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Form";
import { Card } from "@/components/ui/Layout";
import { Skeleton, StatusBadge } from "@/components/ui/Feedback";
import { ErrorState, NoPermission } from "@/components/ui/States";
import { Modal, useConfirm } from "@/components/ui/Modal";

interface Item { id?: string; descricao: string; unidade: string; quantidade: string; valor_unitario: string }
const UNIDADES = ["un", "m", "m²", "m³", "kg", "vb", "h", "dia", "furo", "ponto"].map((v) => ({ value: v, label: v }));

export default function OrcamentoEditor() {
  const { id } = useParams();
  const isNew = id === "novo";
  const nav = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const orc = useGet<Row>("orcamentos", isNew ? undefined : id, ["cliente", "obra"]);
  const itensQ = useList<Row>("orcamento_itens", { eq: { orcamento_id: id }, order: [{ col: "ordem" }] }, !isNew);
  const clientes = useList<Row>("clientes", { eq: { ativo: true }, order: [{ col: "nome" }] });
  const [head, setHead] = useState<Row>({ titulo: "", cliente_id: "", obra_id: "", validade: isoDate(addDays(new Date(), 15)), desconto: "", condicoes: "50% de entrada e saldo conforme medições.", observacoes: "" });
  const obras = useList<Row>("obras", { eq: head.cliente_id ? { cliente_id: head.cliente_id } : {}, order: [{ col: "nome" }] }, !!head.cliente_id);
  const [itens, setItens] = useState<Item[]>([{ descricao: "", unidade: "m²", quantidade: "1", valor_unitario: "" }]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [aprovar, setAprovar] = useState(false);
  const [criarObra, setCriarObra] = useState(true);

  useEffect(() => {
    if (orc.data) setHead({ ...orc.data, desconto: Number(orc.data.desconto) ? Number(orc.data.desconto).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "", obra_id: orc.data.obra_id ?? "", validade: orc.data.validade ?? "", condicoes: orc.data.condicoes ?? "", observacoes: orc.data.observacoes ?? "" });
  }, [orc.data]);
  useEffect(() => {
    if (itensQ.data) setItens(itensQ.data.map((i) => ({ id: i.id, descricao: i.descricao, unidade: i.unidade, quantidade: String(i.quantidade), valor_unitario: Number(i.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) })));
  }, [itensQ.data]);

  const locked = !isNew && ["aprovado", "recusado"].includes(orc.data?.status);
  const subtotal = useMemo(() => itens.reduce((a, i) => a + Math.round(Number(i.quantidade.replace(",", ".") || 0) * parseMoney(i.valor_unitario) * 100) / 100, 0), [itens]);
  const desconto = parseMoney(String(head.desconto || "0"));
  const total = Math.max(subtotal - desconto, 0);

  if (!isNew && orc.isLoading) return <Skeleton className="h-96" />;
  if (orc.isError) return <ErrorState error={orc.error} />;
  if (!isNew && !orc.data) return <NoPermission />;

  const setI = (n: number, k: keyof Item, v: string) => setItens((s) => s.map((x, i) => (i === n ? { ...x, [k]: v } : x)));
  const valida = () => {
    const e: Record<string, string> = {};
    if (!String(head.titulo).trim()) e.titulo = "Informe o título.";
    if (!head.cliente_id) e.cliente_id = "Selecione o cliente.";
    if (head.validade && head.validade < (orc.data?.data_emissao ?? today())) e.validade = "Validade anterior à emissão.";
    if (desconto > subtotal) e.desconto = "Desconto maior que o subtotal.";
    itens.forEach((i, n) => {
      if (!i.descricao.trim()) e[`d${n}`] = "Descreva o serviço.";
      if (!(Number(i.quantidade.replace(",", ".")) > 0)) e[`q${n}`] = "Qtd. > 0";
    });
    if (!itens.length) e.itens = "Adicione ao menos um item.";
    setErr(e);
    return !Object.keys(e).length;
  };

  const salvar = async (novoStatus?: string) => {
    if (busy || locked || !valida()) { if (!busy && !locked) toast.error("Revise os campos destacados."); return null; }
    setBusy(novoStatus ?? "save");
    try {
      const payload = { titulo: String(head.titulo).trim(), cliente_id: head.cliente_id, obra_id: head.obra_id || null, validade: head.validade || null, desconto, condicoes: head.condicoes || null, observacoes: head.observacoes || null, ...(novoStatus ? { status: novoStatus } : {}) };
      const o = isNew ? await api().insert<Row>("orcamentos", payload) : await api().update<Row>("orcamentos", id!, payload);
      for (const rid of removed) await api().remove("orcamento_itens", rid);
      for (let n = 0; n < itens.length; n++) {
        const i = itens[n];
        const p = { ordem: n, descricao: i.descricao.trim(), unidade: i.unidade, quantidade: Number(i.quantidade.replace(",", ".")), valor_unitario: parseMoney(i.valor_unitario) };
        if (i.id) await api().update("orcamento_itens", i.id, p); else await api().insert("orcamento_itens", { ...p, orcamento_id: o.id });
      }
      setRemoved([]);
      qc.invalidateQueries({ queryKey: ["orcamentos"] }); qc.invalidateQueries({ queryKey: ["orcamento_itens"] }); qc.invalidateQueries({ queryKey: ["rpc"] });
      toast.success(novoStatus === "enviado" ? "Orçamento marcado como enviado." : "Orçamento salvo.");
      if (isNew) nav(`/orcamentos/${o.id}`, { replace: true });
      return o;
    } catch (e) { toast.error(friendlyError(e)); return null; } finally { setBusy(null); }
  };

  const pdf = async () => {
    setBusy("pdf");
    try {
      const [{ pdfOrcamento, savePdf }, cfg, fresh, its] = await Promise.all([
        import("@/lib/pdf"), api().list<Row>("empresa_config", { limit: 1 }), api().get<Row>("orcamentos", id!, ["cliente", "obra"]),
        api().list<Row>("orcamento_itens", { eq: { orcamento_id: id }, order: [{ col: "ordem" }] }),
      ]);
      savePdf(await pdfOrcamento(fresh!, its, cfg[0] ?? null), `Orcamento ${pad(fresh!.numero)} - ${fresh!.cliente?.nome ?? ""}.pdf`);
    } catch (e) { toast.error(friendlyError(e, "Não foi possível gerar o PDF.")); } finally { setBusy(null); }
  };
  const texto = () => `Olá, ${orc.data?.cliente?.nome?.split(" ")[0] ?? ""}! Segue o Orçamento Nº ${pad(orc.data?.numero)} — ${orc.data?.titulo}, no valor de ${money(orc.data?.total)}${orc.data?.validade ? `, válido até ${new Date(orc.data.validade + "T12:00").toLocaleDateString("pt-BR")}` : ""}. O PDF segue em anexo. Técnica Engenharia.`;
  const whatsapp = () => {
    const tel = digits(orc.data?.cliente?.telefone ?? "");
    if (!tel) { toast.error("Cliente sem telefone cadastrado."); return; }
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto())}`, "_blank", "noopener");
  };
  const email = () => {
    const to = orc.data?.cliente?.email;
    if (!to) { toast.error("Cliente sem e-mail cadastrado."); return; }
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(`Orçamento Nº ${pad(orc.data?.numero)} — Técnica Engenharia`)}&body=${encodeURIComponent(texto())}`;
  };
  const doAprovar = async () => {
    setBusy("aprovar");
    try {
      const r = await api().rpc<Row>("aprovar_orcamento", { p_orcamento: id, p_criar_obra: criarObra });
      qc.invalidateQueries();
      toast.success(r.ja_aprovado ? "Este orçamento já estava aprovado." : "Orçamento aprovado. Contrato criado como rascunho.");
      setAprovar(false);
      if (r.obra_id && !r.ja_aprovado) nav(`/obras/${r.obra_id}`);
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(null); }
  };
  const recusar = async () => {
    if (!(await confirm({ title: "Marcar como recusado?", text: "O orçamento ficará bloqueado para edição.", confirm: "Recusar", danger: true }))) return;
    try { await api().update("orcamentos", id!, { status: "recusado" }); qc.invalidateQueries({ queryKey: ["orcamentos"] }); toast.success("Orçamento marcado como recusado."); }
    catch (e) { toast.error(friendlyError(e)); }
  };

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <button onClick={() => nav("/orcamentos")} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Orçamentos</button>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Comercial</p>
          <h1 className="mt-1 text-2xl font-bold">{isNew ? "Novo orçamento" : `Orçamento Nº ${pad(orc.data!.numero)}`}</h1>
        </div>
        {!isNew && <StatusBadge map={ORC_STATUS} value={orc.data!.status} />}
      </div>

      <fieldset disabled={locked || !!busy} className="space-y-4">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título / objeto" required error={err.titulo} className="sm:col-span-2" htmlFor="t"><Input id="t" value={head.titulo} invalid={!!err.titulo} onChange={(e) => setHead({ ...head, titulo: e.target.value })} placeholder="Ex.: Reforma de cozinha" /></Field>
            <Field label="Cliente" required error={err.cliente_id} htmlFor="c"><Select id="c" value={head.cliente_id} invalid={!!err.cliente_id} onChange={(e) => setHead({ ...head, cliente_id: e.target.value, obra_id: "" })} options={(clientes.data ?? []).map((c) => ({ value: c.id, label: c.nome }))} placeholder="Selecione…" /></Field>
            <Field label="Obra (opcional)" htmlFor="o"><Select id="o" value={head.obra_id} disabled={!head.cliente_id} onChange={(e) => setHead({ ...head, obra_id: e.target.value })} options={(obras.data ?? []).map((c) => ({ value: c.id, label: c.nome }))} placeholder="Sem obra vinculada" /></Field>
            <Field label="Validade" error={err.validade} htmlFor="v"><Input id="v" type="date" value={head.validade} invalid={!!err.validade} onChange={(e) => setHead({ ...head, validade: e.target.value })} /></Field>
          </div>
        </Card>

        <Card title="Serviços" action={!locked && <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setItens((s) => [...s, { descricao: "", unidade: "un", quantidade: "1", valor_unitario: "" }])}>Item</Button>}>
          {err.itens && <p className="mb-2 text-sm text-red-300">{err.itens}</p>}
          <div className="hidden grid-cols-[1fr_80px_90px_130px_120px_40px] gap-2 pb-2 text-[12px] uppercase tracking-wider text-muted md:grid"><span>Serviço</span><span>Un.</span><span>Qtd.</span><span>Valor unit.</span><span className="text-right">Subtotal</span><span /></div>
          <ul className="space-y-3 md:space-y-2">
            {itens.map((i, n) => {
              const st = Math.round(Number(i.quantidade.replace(",", ".") || 0) * parseMoney(i.valor_unitario) * 100) / 100;
              return (
                <li key={i.id ?? `n${n}`} className="grid grid-cols-2 gap-2 rounded-xl border border-line/60 p-3 md:grid-cols-[1fr_80px_90px_130px_120px_40px] md:items-start md:border-0 md:p-0">
                  <div className="col-span-2 md:col-span-1"><Input aria-label="Serviço" placeholder="Descrição do serviço" value={i.descricao} invalid={!!err[`d${n}`]} onChange={(e) => setI(n, "descricao", e.target.value)} />{err[`d${n}`] && <p className="mt-1 text-xs text-red-300">{err[`d${n}`]}</p>}</div>
                  <Select aria-label="Unidade" value={i.unidade} onChange={(e) => setI(n, "unidade", e.target.value)} options={UNIDADES} />
                  <Input aria-label="Quantidade" inputMode="decimal" value={i.quantidade} invalid={!!err[`q${n}`]} onChange={(e) => setI(n, "quantidade", e.target.value.replace(/[^\d,.]/g, ""))} />
                  <Input aria-label="Valor unitário" inputMode="numeric" placeholder="0,00" value={i.valor_unitario} onChange={(e) => setI(n, "valor_unitario", maskMoneyInput(e.target.value))} />
                  <p className="flex h-11 items-center justify-end font-semibold tabular-nums">{money(st)}</p>
                  {!locked && <button type="button" aria-label="Remover item" className="col-start-2 row-start-1 grid h-11 w-10 place-items-center justify-self-end rounded-lg text-muted hover:text-red-300 md:col-start-auto md:row-start-auto"
                    onClick={() => { if (i.id) setRemoved((r) => [...r, i.id!]); setItens((s) => s.filter((_, k) => k !== n)); }}><Trash2 className="h-4 w-4" /></button>}
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-col items-end gap-2 border-t border-line/60 pt-4 text-sm">
            <div className="flex w-full max-w-xs justify-between"><span className="text-muted">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
            <div className="flex w-full max-w-xs items-center justify-between gap-3"><label htmlFor="desc" className="text-muted">Desconto</label>
              <Input id="desc" className="h-9 w-36 text-right" inputMode="numeric" placeholder="0,00" value={head.desconto} invalid={!!err.desconto} onChange={(e) => setHead({ ...head, desconto: maskMoneyInput(e.target.value) })} /></div>
            {err.desconto && <p className="text-xs text-red-300">{err.desconto}</p>}
            <div className="flex w-full max-w-xs justify-between border-t border-pearl/40 pt-2 text-lg font-bold"><span>Total</span><span className="tabular-nums text-pearl-soft">{money(total)}</span></div>
          </div>
        </Card>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Condições de pagamento e prazo" htmlFor="cd"><Textarea id="cd" value={head.condicoes} onChange={(e) => setHead({ ...head, condicoes: e.target.value })} /></Field>
            <Field label="Observações" htmlFor="ob"><Textarea id="ob" value={head.observacoes} onChange={(e) => setHead({ ...head, observacoes: e.target.value })} /></Field>
          </div>
        </Card>
      </fieldset>

      <div className="sticky bottom-20 z-10 mt-5 flex flex-wrap justify-end gap-2 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur lg:bottom-4">
        {!isNew && <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} loading={busy === "pdf"} onClick={pdf}>Gerar PDF</Button>}
        {!isNew && <Button variant="secondary" icon={<MessageCircle className="h-4 w-4" />} onClick={whatsapp}>WhatsApp</Button>}
        {!isNew && <Button variant="secondary" icon={<Mail className="h-4 w-4" />} onClick={email}>E-mail</Button>}
        {!locked && <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={busy === "save"} onClick={() => salvar()}>Salvar</Button>}
        {!locked && orc.data?.status !== "enviado" && <Button variant="outline-pearl" icon={<Send className="h-4 w-4" />} loading={busy === "enviado"} onClick={() => salvar("enviado")}>Marcar como enviado</Button>}
        {!isNew && !locked && <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={recusar}>Recusar</Button>}
        {!isNew && !locked && <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={async () => { const ok = await salvar(); if (ok) setAprovar(true); }}>Aprovar orçamento</Button>}
      </div>

      <Modal open={aprovar} onClose={() => setAprovar(false)} busy={busy === "aprovar"} title="Aprovar orçamento" size="sm"
        footer={<><Button variant="secondary" onClick={() => setAprovar(false)}>Cancelar</Button><Button loading={busy === "aprovar"} onClick={doAprovar}>Aprovar</Button></>}>
        <p className="text-sm text-ink/85">Total de <strong>{money(total)}</strong>. Após aprovado, o orçamento fica bloqueado e um contrato é criado como rascunho.</p>
        {!head.obra_id && <div className="mt-4"><Switch label="Criar a obra automaticamente" checked={criarObra} onChange={setCriarObra} /></div>}
      </Modal>
    </div>
  );
}
