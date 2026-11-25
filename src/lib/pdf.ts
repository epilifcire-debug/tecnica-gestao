import type { Row } from "@/data/types";
import { CLIMA } from "@/data/types";
import { date, maskCpfCnpj, maskPhone, money, number, pad } from "./format";

/** PDFs com identidade Técnica Engenharia (gerados no navegador, sem servidor). */
async function lib() {
  const [{ jsPDF }, auto] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable: auto.default };
}

const PEARL: [number, number, number] = [176, 170, 160]; // pérola escurecida p/ contraste no papel
const DARK: [number, number, number] = [12, 15, 20];

function header(doc: any, titulo: string, sub: string, empresa: Row | null) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...DARK); doc.rect(0, 0, w, 30, "F");
  doc.setFillColor(245, 245, 245);
  [0, 1, 2].forEach((i) => doc.roundedRect(14, 8 + i * 5.2, 14, 3.4, 0.4, 0.4, "F"));
  doc.setTextColor(245, 245, 245); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("TECNICA", 32, 13.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setCharSpace(1.6); doc.text("ENGENHARIA", 32, 17.5);
  doc.setTextColor(...PEARL); doc.setFontSize(5.5); doc.text("GESTÃO DE OBRAS", 32, 21.5); doc.setCharSpace(0);
  doc.setTextColor(245, 245, 245); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(titulo, w - 14, 14, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(190, 196, 205); doc.text(sub, w - 14, 20, { align: "right" });
  if (empresa) {
    const linha = [empresa.razao_social, empresa.cnpj && `CNPJ ${maskCpfCnpj(empresa.cnpj)}`, empresa.telefone && maskPhone(empresa.telefone), empresa.email].filter(Boolean).join("  •  ");
    doc.setFontSize(7); doc.text(linha, w - 14, 25, { align: "right" });
  }
  doc.setTextColor(30, 30, 30);
}

function footer(doc: any, empresa: Row | null) {
  const n = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PEARL); doc.setLineWidth(0.4); doc.line(14, h - 14, w - 14, h - 14);
    doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
    doc.text(empresa?.rodape_documentos || "Técnica Engenharia — Planejamento • Execução • Resultados", 14, h - 9);
    const assinatura = empresa?.assinatura_visivel === false ? "" : "Desenvolvido por EFCsys • Todos os direitos reservados.";
    doc.text(`${assinatura}${assinatura ? "   " : ""}Página ${i} de ${n}`, w - 14, h - 9, { align: "right" });
  }
}

function label(doc: any, k: string, v: string, x: number, y: number, maxW = 80) {
  doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.text(k.toUpperCase(), x, y);
  doc.setFontSize(10); doc.setTextColor(25, 25, 25);
  const lines = doc.splitTextToSize(v || "—", maxW);
  doc.text(lines, x, y + 4.6);
  return y + 4.6 + lines.length * 4.4;
}

export async function pdfOrcamento(orc: Row, itens: Row[], empresa: Row | null) {
  const { jsPDF, autoTable } = await lib();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, `ORÇAMENTO Nº ${pad(orc.numero)}`, `Emissão ${date(orc.data_emissao)}${orc.validade ? `  •  Válido até ${date(orc.validade)}` : ""}`, empresa);
  let y = 40;
  const c = orc.cliente ?? {};
  y = Math.max(
    label(doc, "Cliente", c.nome ?? "", 14, y, 90),
    label(doc, "Documento", c.documento ? maskCpfCnpj(c.documento) : "", 110, y, 40),
    label(doc, "Contato", [c.telefone && maskPhone(c.telefone), c.email].filter(Boolean).join(" • "), 150, y, 46),
  ) + 3;
  y = Math.max(label(doc, "Obra / Objeto", orc.obra?.nome ? `${orc.obra.nome} — ${orc.titulo}` : orc.titulo, 14, y, 120), label(doc, "Endereço", c.endereco ?? "", 140, y, 56)) + 4;

  autoTable(doc, {
    startY: y,
    head: [["#", "Serviço", "Un.", "Qtd.", "Valor unit.", "Subtotal"]],
    body: itens.map((i, n) => [n + 1, i.descricao, i.unidade, number(i.quantidade), money(i.valor_unitario), money(i.subtotal)]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.4, lineColor: [225, 225, 225] },
    headStyles: { fillColor: DARK, textColor: [245, 245, 245], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 9, halign: "center" }, 2: { cellWidth: 14, halign: "center" }, 3: { cellWidth: 18, halign: "right" }, 4: { cellWidth: 28, halign: "right" }, 5: { cellWidth: 30, halign: "right" } },
    alternateRowStyles: { fillColor: [248, 247, 244] },
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  const w = doc.internal.pageSize.getWidth();
  const linha = (k: string, v: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 12 : 9.5);
    doc.text(k, w - 70, y); doc.text(v, w - 14, y, { align: "right" }); y += bold ? 7 : 5.5;
  };
  linha("Subtotal", money(orc.subtotal));
  if (Number(orc.desconto) > 0) linha("Desconto", `− ${money(orc.desconto)}`);
  doc.setDrawColor(...PEARL); doc.line(w - 70, y - 3, w - 14, y - 3); y += 2;
  linha("TOTAL", money(orc.total), true);
  doc.setFont("helvetica", "normal");
  if (orc.condicoes) { y += 4; y = label(doc, "Condições", orc.condicoes, 14, y, 180); }
  if (orc.observacoes) { y += 2; y = label(doc, "Observações", orc.observacoes, 14, y, 180); }
  y = Math.max(y + 22, 250);
  if (y < 270) {
    doc.setDrawColor(150, 150, 150); doc.line(20, y, 90, y); doc.line(120, y, 190, y);
    doc.setFontSize(8); doc.setTextColor(110, 110, 110);
    doc.text(empresa?.nome_fantasia ?? "Técnica Engenharia", 55, y + 4.5, { align: "center" });
    doc.text(c.nome ? `De acordo — ${c.nome}` : "De acordo — Cliente", 155, y + 4.5, { align: "center" });
  }
  footer(doc, empresa);
  return doc;
}

export async function pdfRdo(rdo: Row, obra: Row, empresa: Row | null, fotos: { url: string; legenda?: string }[] = []) {
  const { jsPDF, autoTable } = await lib();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "RELATÓRIO DIÁRIO DE OBRA", `RDO — ${date(rdo.data)}`, empresa);
  let y = 40;
  y = Math.max(label(doc, "Obra", obra.nome, 14, y, 90), label(doc, "Endereço", obra.endereco ?? "", 110, y, 86)) + 3;
  y = Math.max(
    label(doc, "Clima (manhã)", CLIMA[rdo.clima_manha as keyof typeof CLIMA] ?? "—", 14, y, 40),
    label(doc, "Clima (tarde)", CLIMA[rdo.clima_tarde as keyof typeof CLIMA] ?? "—", 60, y, 40),
    label(doc, "Efetivo", rdo.efetivo_total != null ? `${rdo.efetivo_total} pessoas` : "—", 110, y, 40),
    label(doc, "Responsável", rdo.autor?.nome ?? "", 150, y, 46),
  ) + 3;
  autoTable(doc, {
    startY: y,
    body: [
      ["Equipe", rdo.equipe || "—"],
      ["Serviços executados", rdo.servicos_executados || "—"],
      ["Ocorrências", rdo.ocorrencias || "Nenhuma ocorrência registrada."],
      ["Observações", rdo.observacoes || "Sem observações adicionais."],
    ],
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 3, lineColor: [225, 225, 225], valign: "top" },
    columnStyles: { 0: { cellWidth: 42, fontStyle: "bold", fillColor: [246, 244, 238] } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  const imgs = fotos.slice(0, 6);
  if (imgs.length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Registro fotográfico", 14, y); doc.setFont("helvetica", "normal"); y += 4;
    const cw = 58, ch = 42;
    for (let i = 0; i < imgs.length; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      if (y + row * (ch + 9) + ch > 275) break;
      try {
        const data = await toDataUrl(imgs[i].url);
        doc.addImage(data, "JPEG", 14 + col * (cw + 4), y + row * (ch + 9), cw, ch, undefined, "FAST");
        if (imgs[i].legenda) { doc.setFontSize(7.5); doc.text(imgs[i].legenda!, 14 + col * (cw + 4), y + row * (ch + 9) + ch + 4); }
      } catch { /* foto indisponível: segue sem ela */ }
    }
  }
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(150, 150, 150); doc.line(20, h - 32, 90, h - 32); doc.line(120, h - 32, 190, h - 32);
  doc.setFontSize(8); doc.setTextColor(110, 110, 110);
  doc.text("Responsável técnico", 55, h - 27.5, { align: "center" }); doc.text("Fiscalização / Cliente", 155, h - 27.5, { align: "center" });
  footer(doc, empresa);
  return doc;
}

async function toDataUrl(url: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
  const c = document.createElement("canvas");
  const s = Math.min(1, 900 / img.width);
  c.width = img.width * s; c.height = img.height * s;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

/** Redimensiona fotos antes do upload (economia de dados no celular) */
export async function compressImage(file: File, max = 1920, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    if (s === 1 && file.size < 1.2 * 1024 * 1024) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b ?? file), "image/jpeg", quality));
  } finally { URL.revokeObjectURL(url); }
}

export function savePdf(doc: any, name: string) {
  doc.save(name.replace(/[^\w\-. ]+/g, "_"));
}
