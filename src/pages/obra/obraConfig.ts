import type { FieldDef } from "@/components/crud/FormFields";
import { OBRA_STATUS, opts } from "@/data/types";

export const STAFF_PROFILES = { table: "profiles", opts: { isNull: ["cliente_id"], eq: { ativo: true } }, placeholder: "Selecione o responsável…" };

export const OBRA_FIELDS: FieldDef[] = [
  { name: "nome", label: "Nome da obra", required: true, col: 2, placeholder: "Ex.: Residência Silva" },
  { name: "cliente_id", label: "Cliente", type: "ref", required: true, ref: { table: "clientes", opts: { eq: { ativo: true } } } },
  { name: "responsavel_id", label: "Engenheiro responsável", type: "ref", ref: STAFF_PROFILES },
  { name: "tipo", label: "Tipo", type: "select", required: true, options: ["Residencial", "Residencial multifamiliar", "Comercial", "Industrial", "Reforma", "Infraestrutura"].map((v) => ({ value: v, label: v })) },
  { name: "status", label: "Status", type: "select", required: true, options: opts(OBRA_STATUS) },
  { name: "endereco", label: "Endereço", col: 2 },
  { name: "cidade", label: "Cidade" },
  { name: "uf", label: "UF", validate: (v) => (v && !/^[A-Za-z]{2}$/.test(v) ? "Use a sigla (ex.: SE)." : null) },
  { name: "data_inicio", label: "Início", type: "date" },
  { name: "previsao_termino", label: "Previsão de término", type: "date", validate: (v, a) => (v && a.data_inicio && v < a.data_inicio ? "Deve ser depois do início." : null) },
  { name: "valor_contratado", label: "Valor contratado (R$)", type: "money" },
  { name: "area_m2", label: "Área (m²)", type: "number", min: 0 },
  { name: "descricao", label: "Descrição", type: "textarea" },
];
export const OBRA_DEFAULTS = { tipo: "Residencial", status: "planejamento", cidade: "Aracaju", uf: "SE" };
