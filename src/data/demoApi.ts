/**
 * API de DEMONSTRAÇÃO (somente build "demo"). Reproduz no navegador as regras
 * principais do banco (gatilhos, totais, visibilidade por papel) para o preview.
 * Os dados ficam no localStorage deste navegador e podem ser restaurados.
 */
import type { Api, AuthSnapshot, ListOpts } from "./api";
import type { Role, Row } from "./types";
import { RELATIONS } from "./schema";
import { buildSeed, DEMO_USERS } from "./demoSeed";
import { addDays, isoDate, today } from "@/lib/format";

const KEY = "tecnica-demo-db-v5";
const SESSION_KEY = "tecnica-demo-session";
type DB = Record<string, Row[]>;

const mem: Record<string, string> = {};
const store = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set: (k: string, v: string) => { mem[k] = v; try { sessionStorage.setItem(k, v); } catch { /* sem storage */ } },
  del: (k: string) => { delete mem[k]; try { sessionStorage.removeItem(k); } catch { /* */ } },
};
let db: DB = load();
function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const s = buildSeed();
  recalcAll(s);
  return s;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* cota cheia: segue em memória */ }
}
export function resetDemo() {
  try { localStorage.removeItem(KEY); } catch { /* */ }
  db = load();
  save();
}

const files = new Map<string, string>();
const listeners = new Set<(s: AuthSnapshot, e: string) => void>();
const wait = (ms = 160) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();
const perm = (msg = "Você não possui permissão para esta ação.") => Object.assign(new Error(msg), { code: "42501" });

function sessionUser(): string | null { return store.get(SESSION_KEY); }
function me() {
  const id = sessionUser();
  const p = db.profiles.find((x) => x.id === id);
  const r = db.user_roles.find((x) => x.user_id === id)?.role as Role | undefined;
  return { id, role: p?.ativo ? r ?? null : null, cliente_id: p?.cliente_id ?? null };
}
const isGestor = () => ["admin_master", "administrador"].includes(me().role ?? "");
function canAccessObra(obraId: string | null | undefined) {
  if (!obraId) return false;
  const u = me();
  const o = db.obras.find((x) => x.id === obraId);
  if (!o || !u.role) return false;
  if (u.role === "admin_master" || u.role === "administrador") return true;
  if (u.role === "colaborador") return o.responsavel_id === u.id || db.obra_usuarios.some((m) => m.obra_id === obraId && m.user_id === u.id);
  return !!o.cliente_id && o.cliente_id === u.cliente_id;
}

/** Visibilidade equivalente às policies de SELECT */
function visible(table: string, r: Row): boolean {
  const u = me();
  if (!u.role) return false;
  if (isGestor()) return true;
  const staff = u.role === "colaborador";
  switch (table) {
    case "profiles": return r.id === u.id || (staff && db.user_roles.find((x) => x.user_id === r.id)?.role !== "cliente");
    case "user_roles": return r.user_id === u.id;
    case "empresa_config": return true;
    case "clientes": return staff ? db.obras.some((o) => o.cliente_id === r.id && canAccessObra(o.id)) : r.id === u.cliente_id;
    case "obras": return canAccessObra(r.id);
    case "obra_etapas": return canAccessObra(r.obra_id);
    case "rdos": case "obra_fotos": return canAccessObra(r.obra_id) && (staff || r.visivel_cliente);
    case "documentos": return r.obra_id ? canAccessObra(r.obra_id) && (staff || r.visivel_cliente) : staff;
    case "obra_usuarios": case "obra_equipe": return staff && canAccessObra(r.obra_id);
    case "fornecedores": case "funcionarios": case "materiais": case "material_movimentos": return staff;
    case "tarefas": return staff && (r.responsavel_id === u.id || r.created_by === u.id || canAccessObra(r.obra_id));
    case "orcamentos": case "contratos": return r.cliente_id === u.cliente_id && r.status !== "rascunho";
    case "orcamento_itens": return visible("orcamentos", db.orcamentos.find((o) => o.id === r.orcamento_id) ?? {});
    case "lancamentos": return r.tipo === "receita" && r.status !== "cancelado" && !!r.cliente_id && r.cliente_id === u.cliente_id;
    case "vistorias": return staff ? r.responsavel_id === u.id || canAccessObra(r.obra_id) : r.cliente_id === u.cliente_id || canAccessObra(r.obra_id);
    case "laudos": return staff ? r.responsavel_id === u.id || canAccessObra(r.obra_id)
      : r.visivel_cliente && ["concluido", "entregue"].includes(r.status) && (r.cliente_id === u.cliente_id || canAccessObra(r.obra_id));
    case "compromissos": return staff ? r.responsavel_id === u.id || r.created_by === u.id || canAccessObra(r.obra_id) : r.cliente_id === u.cliente_id;
    case "audit_log": return false;
    default: return false;
  }
}
/** Escrita: simplificação das policies de INSERT/UPDATE/DELETE */
function canWrite(table: string, r: Row, op: "insert" | "update" | "delete"): boolean {
  const u = me();
  if (!u.role) return false;
  if (isGestor()) return true;
  if (u.role !== "colaborador") return table === "profiles" && op === "update" && r.id === u.id;
  switch (table) {
    case "profiles": return op === "update" && r.id === u.id;
    case "rdos": case "obra_fotos": return op !== "delete" ? canAccessObra(r.obra_id) : r.autor_id === u.id;
    case "obra_etapas": return op !== "delete" && canAccessObra(r.obra_id);
    case "documentos": return op === "insert" ? !!r.obra_id && canAccessObra(r.obra_id) : op === "delete" && r.autor_id === u.id;
    case "tarefas": return op === "insert" ? !r.obra_id || canAccessObra(r.obra_id) : r.responsavel_id === u.id || r.created_by === u.id;
    case "material_movimentos": return op === "insert" && r.tipo === "saida" && canAccessObra(r.obra_id);
    case "compromissos": return r.responsavel_id === u.id || r.created_by === u.id;
    case "vistorias": case "laudos": return op === "update" && r.responsavel_id === u.id;
    default: return false;
  }
}

// --------------------------------------------------------------------- gatilhos
function recalcAll(s: DB) {
  for (const o of s.obras) o.progresso = progresso(s, o.id);
  for (const o of s.orcamentos) totalOrc(s, o);
}
function progresso(s: DB, obraId: string) {
  const et = s.obra_etapas.filter((e) => e.obra_id === obraId);
  const peso = et.reduce((a, e) => a + Number(e.peso), 0);
  return peso ? Math.round((et.reduce((a, e) => a + Number(e.percentual) * Number(e.peso), 0) / peso) * 100) / 100 : 0;
}
function totalOrc(s: DB, o: Row) {
  o.subtotal = s.orcamento_itens.filter((i) => i.orcamento_id === o.id).reduce((a, i) => a + Number(i.subtotal), 0);
  o.total = Math.max(o.subtotal - Number(o.desconto || 0), 0);
}
function before(table: string, r: Row, old?: Row) {
  const t = today();
  if (table === "orcamento_itens") {
    const orc = db.orcamentos.find((o) => o.id === (r.orcamento_id ?? old?.orcamento_id));
    if (orc && ["aprovado", "recusado"].includes(orc.status)) throw perm(`Orçamento ${orc.status} não pode mais ser alterado.`);
    r.subtotal = Math.round(Number(r.quantidade) * Number(r.valor_unitario) * 100) / 100;
  }
  if (table === "obra_etapas") {
    const p = Number(r.percentual);
    r.status = p >= 100 ? "concluida" : p > 0 ? (r.fim_previsto && r.fim_previsto < t ? "atrasada" : "em_andamento") : "nao_iniciada";
  }
  if (table === "lancamentos") {
    if (r.status === "pago" && !r.pago_em) r.pago_em = t;
    if (r.status !== "pago") r.pago_em = null;
  }
  if (table === "tarefas") r.concluida_em = r.status === "concluida" ? (old?.status === "concluida" ? old.concluida_em : new Date().toISOString()) : null;
  if (table === "user_roles" && old && r.user_id === me().id && r.role !== old.role) throw perm("Você não pode alterar o seu próprio perfil de acesso.");
  if (table === "profiles" && old && old.id === me().id && r.ativo === false) throw perm("Você não pode desativar a sua própria conta.");
  if (table === "empresa_config" && old && me().role !== "admin_master" &&
    ["assinatura_visivel", "assinatura_texto", "assinatura_link"].some((k) => r[k] !== old[k]))
    throw perm("Somente o Administrador Master altera a assinatura EFCsys.");
  if (table === "material_movimentos") {
    const m = db.materiais.find((x) => x.id === r.material_id)!;
    const delta = r.tipo === "entrada" ? Number(r.quantidade) : r.tipo === "saida" ? -Number(r.quantidade) : Number(r.quantidade);
    if (Number(m.estoque_atual) + delta < 0) throw Object.assign(new Error("Estoque insuficiente para esta saída."), { code: "23514" });
    m.estoque_atual = Number(m.estoque_atual) + delta;
  }
}
function after(table: string, r: Row) {
  if (table === "obra_etapas") { const o = db.obras.find((x) => x.id === r.obra_id); if (o) o.progresso = progresso(db, o.id); }
  if (table === "orcamento_itens") { const o = db.orcamentos.find((x) => x.id === r.orcamento_id); if (o) totalOrc(db, o); }
  if (table === "orcamentos") totalOrc(db, r);
}

function embed(table: string, r: Row, aliases?: string[]) {
  if (!aliases?.length) return { ...r };
  const out: Row = { ...r };
  for (const a of aliases) {
    const rel = RELATIONS[table]?.[a];
    if (!rel) continue;
    const target = (db[rel.table] ?? []).find((x) => x.id === r[rel.fk]);
    out[a] = target && visible(rel.table, target) ? Object.fromEntries(rel.cols.split(",").map((c) => [c, target[c]])) : null;
  }
  return out;
}

function matches(r: Row, o: ListOpts = {}) {
  for (const [k, v] of Object.entries(o.eq ?? {})) if (r[k] !== v) return false;
  for (const [k, v] of Object.entries(o.neq ?? {})) if (r[k] === v) return false;
  for (const [k, v] of Object.entries(o.in ?? {})) if (!v.includes(r[k])) return false;
  for (const [k, v] of Object.entries(o.gte ?? {})) if (r[k] == null || r[k] < (v as any)) return false;
  for (const [k, v] of Object.entries(o.lte ?? {})) if (r[k] == null || r[k] > (v as any)) return false;
  for (const [k, v] of Object.entries(o.lt ?? {})) if (r[k] == null || r[k] >= (v as any)) return false;
  for (const k of o.isNull ?? []) if (r[k] != null) return false;
  if (o.search?.term.trim()) {
    const t = o.search.term.trim().toLowerCase();
    if (!o.search.cols.some((c) => String(r[c] ?? "").toLowerCase().includes(t))) return false;
  }
  return true;
}

const keyOf = (table: string) => (table === "user_roles" ? "user_id" : "id");
const nextNum = (table: string, col: string) => Math.max(0, ...db[table].map((x) => Number(x[col]) || 0)) + 1;

export const demoApi: Api = {
  async list(table, o) {
    await wait(120);
    let rows = (db[table] ?? []).filter((r) => visible(table, r) && matches(r, o));
    for (const ord of [...(o?.order ?? [])].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = a[ord.col], y = b[ord.col];
        if (x == null) return 1;
        if (y == null) return -1;
        return (x > y ? 1 : x < y ? -1 : 0) * (ord.asc === false ? -1 : 1);
      });
    }
    if (o?.limit) rows = rows.slice(0, o.limit);
    return rows.map((r) => embed(table, r, o?.embed)) as any;
  },
  async get(table, id, emb, key) {
    await wait(80);
    const r = (db[table] ?? []).find((x) => x[key ?? keyOf(table)] === id);
    return r && visible(table, r) ? (embed(table, r, emb) as any) : null;
  },
  async insert(table, row) {
    await wait();
    const r: Row = { id: uuid(), created_at: new Date().toISOString(), ...row };
    if (["obras"].includes(table)) { r.codigo = nextNum(table, "codigo"); r.progresso = 0; }
    if (["orcamentos", "contratos", "laudos"].includes(table)) r.numero = nextNum(table, "numero");
    if (table === "orcamentos") { r.subtotal = 0; r.total = 0; }
    for (const c of ["created_by", "autor_id"]) if (c in r === false && ["rdos", "obra_fotos", "documentos", "material_movimentos", "tarefas", "compromissos"].includes(table)) r[c] = me().id;
    if (!canWrite(table, r, "insert")) throw perm();
    before(table, r);
    db[table] = [...(db[table] ?? []), r];
    after(table, r);
    save();
    return { ...r } as any;
  },
  async update(table, id, patch, key) {
    await wait();
    const k = key ?? keyOf(table);
    const idx = (db[table] ?? []).findIndex((x) => x[k] === id);
    if (idx < 0) throw perm();
    const old = db[table][idx];
    if (!visible(table, old) || !canWrite(table, old, "update")) throw perm();
    const r = { ...old, ...patch, updated_at: new Date().toISOString() };
    before(table, r, old);
    db[table][idx] = r;
    after(table, r);
    save();
    return { ...r } as any;
  },
  async remove(table, id, key) {
    await wait();
    const k = key ?? keyOf(table);
    const r = (db[table] ?? []).find((x) => x[k] === id);
    if (!r || !canWrite(table, r, "delete")) throw perm();
    if (table === "orcamento_itens") before(table, r, r);
    if (table === "clientes" && db.obras.some((o) => o.cliente_id === id))
      throw Object.assign(new Error("fk"), { code: "23503" });
    db[table] = db[table].filter((x) => x !== r);
    after(table, r);
    save();
  },
  async removeWhere(table, eq) {
    await wait();
    if (!isGestor()) throw perm();
    db[table] = db[table].filter((r) => !Object.entries(eq).every(([k, v]) => r[k] === v));
    save();
  },
  async rpc(fn, a: Row = {}) {
    await wait(180);
    const L = db.lancamentos.filter((r) => visible("lancamentos", r));
    const sum = (rows: Row[]) => rows.reduce((s, r) => s + Number(r.valor), 0);
    const t = today();
    if (fn === "dashboard_resumo") {
      const ini = a.p_inicio as string, fim = a.p_fim as string;
      const dias = Math.round((new Date(fim).getTime() - new Date(ini).getTime()) / 864e5) + 1;
      const antFim = isoDate(addDays(new Date(ini + "T12:00"), -1)), antIni = isoDate(addDays(new Date(ini + "T12:00"), -dias));
      const pago = (tipo: string, i: string, f: string) => sum(L.filter((l) => l.tipo === tipo && l.status === "pago" && l.pago_em >= i && l.pago_em <= f));
      const obras = db.obras.filter((o) => visible("obras", o));
      const recebido = pago("receita", ini, fim), gastos = pago("despesa", ini, fim);
      const vis = (tb: string) => db[tb].filter((r) => visible(tb, r));
      return {
        periodo: { inicio: ini, fim, anterior_inicio: antIni, anterior_fim: antFim },
        obras_andamento: obras.filter((o) => o.status === "em_andamento").length,
        obras_andamento_ant: obras.filter((o) => o.status === "em_andamento" && o.created_at.slice(0, 10) <= antFim).length,
        obras_orcamento: obras.filter((o) => ["orcamento", "planejamento"].includes(o.status)).length,
        obras_atrasadas: obras.filter((o) => o.status === "em_andamento" && o.previsao_termino && o.previsao_termino < t && o.progresso < 100).length,
        recebido, recebido_ant: pago("receita", antIni, antFim), gastos, gastos_ant: pago("despesa", antIni, antFim), saldo: recebido - gastos,
        a_receber: sum(L.filter((l) => l.tipo === "receita" && l.status === "pendente")),
        a_receber_ant: sum(L.filter((l) => l.tipo === "receita" && l.status === "pendente" && l.created_at.slice(0, 10) <= antFim)),
        a_pagar: sum(L.filter((l) => l.tipo === "despesa" && l.status === "pendente")),
        receber_vencido: sum(L.filter((l) => l.tipo === "receita" && l.status === "pendente" && l.vencimento < t)),
        clientes: vis("clientes").filter((c) => c.ativo).length,
        clientes_ant: vis("clientes").filter((c) => c.ativo && c.created_at.slice(0, 10) <= antFim).length,
        tarefas_vencidas: vis("tarefas").filter((x) => ["pendente", "em_andamento"].includes(x.status) && x.prazo && x.prazo < t).length,
        orcamentos_pendentes: vis("orcamentos").filter((x) => x.status === "enviado").length,
        vistorias_pendentes: vis("vistorias").filter((x) => x.status === "agendada").length,
        laudos_pendentes: vis("laudos").filter((x) => ["em_elaboracao", "em_revisao"].includes(x.status)).length,
      } as any;
    }
    if (fn === "receitas_gastos_mensal") {
      const y = String(a.p_ano);
      return Array.from({ length: 12 }, (_, m) => {
        const mm = `${y}-${String(m + 1).padStart(2, "0")}`;
        const rows = L.filter((l) => l.status === "pago" && l.pago_em?.startsWith(mm));
        return { mes: m + 1, recebido: sum(rows.filter((r) => r.tipo === "receita")), gastos: sum(rows.filter((r) => r.tipo === "despesa")) };
      }) as any;
    }
    if (fn === "saldo_diario") {
      const out: Row[] = [];
      let acc = 0;
      for (let d = new Date(a.p_inicio + "T12:00"); isoDate(d) <= a.p_fim; d = addDays(d, 1)) {
        const k = isoDate(d);
        acc += L.filter((l) => l.status === "pago" && l.pago_em === k).reduce((s, l) => s + (l.tipo === "receita" ? 1 : -1) * Number(l.valor), 0);
        out.push({ dia: k, saldo: acc });
      }
      return out as any;
    }
    if (fn === "obra_financeiro") {
      const o = db.obras.find((x) => x.id === a.p_obra)!;
      const ob = L.filter((l) => l.obra_id === o.id);
      const recebido = sum(ob.filter((l) => l.tipo === "receita" && l.status === "pago"));
      const despesas = sum(ob.filter((l) => l.tipo === "despesa" && l.status === "pago"));
      return {
        valor_contratado: o.valor_contratado, recebido, despesas,
        a_receber: sum(ob.filter((l) => l.tipo === "receita" && l.status === "pendente")),
        a_pagar: sum(ob.filter((l) => l.tipo === "despesa" && l.status === "pendente")),
        saldo_previsto: o.valor_contratado - despesas,
        percentual_recebido: o.valor_contratado > 0 ? Math.round((1000 * recebido) / o.valor_contratado) / 10 : 0,
      } as any;
    }
    if (fn === "aprovar_orcamento") {
      if (!isGestor()) throw perm("Sem permissão para aprovar orçamentos.");
      const o = db.orcamentos.find((x) => x.id === a.p_orcamento)!;
      if (o.status === "aprovado") return { orcamento_id: o.id, obra_id: o.obra_id, ja_aprovado: true } as any;
      if (o.total <= 0) throw Object.assign(new Error("Orçamento sem itens ou com total zerado."), { code: "22023" });
      let obra = o.obra_id;
      if (!obra && a.p_criar_obra) {
        obra = uuid();
        db.obras.push({ id: obra, codigo: nextNum("obras", "codigo"), nome: o.titulo, cliente_id: o.cliente_id, status: "planejamento", valor_contratado: o.total, progresso: 0, tipo: "Residencial", responsavel_id: null, created_at: new Date().toISOString() });
      }
      Object.assign(o, { status: "aprovado", aprovado_em: new Date().toISOString(), aprovado_por: me().id, obra_id: obra });
      const c = { id: uuid(), numero: nextNum("contratos", "numero"), cliente_id: o.cliente_id, obra_id: obra, orcamento_id: o.id, objeto: o.titulo, valor: o.total, status: "rascunho", created_at: new Date().toISOString() };
      db.contratos.push(c);
      save();
      return { orcamento_id: o.id, obra_id: obra, contrato_id: c.id, ja_aprovado: false } as any;
    }
    if (fn === "duplicar_orcamento") {
      const o = db.orcamentos.find((x) => x.id === a.p_orcamento)!;
      const n = { ...o, id: uuid(), numero: nextNum("orcamentos", "numero"), titulo: `${o.titulo} (cópia)`, status: "rascunho", aprovado_em: null, created_at: new Date().toISOString(), data_emissao: t, validade: isoDate(addDays(new Date(), 15)) };
      db.orcamentos.push(n);
      db.orcamento_itens.filter((i) => i.orcamento_id === o.id).forEach((i) => db.orcamento_itens.push({ ...i, id: uuid(), orcamento_id: n.id }));
      totalOrc(db, n);
      save();
      return n.id as any;
    }
    if (fn === "gerar_parcelas") {
      if (!isGestor()) throw perm();
      const n = Number(a.p_parcelas), total = Number(a.p_valor_total);
      const base = Math.floor((total / n) * 100) / 100;
      for (let i = 1; i <= n; i++) {
        const v = new Date(a.p_primeiro_vencimento + "T12:00"); v.setMonth(v.getMonth() + i - 1);
        db.lancamentos.push({ id: uuid(), tipo: "receita", status: "pendente", descricao: `${a.p_descricao} (${i}/${n})`, categoria: a.p_categoria ?? "Medição", valor: i === n ? Math.round((total - base * (n - 1)) * 100) / 100 : base, vencimento: isoDate(v), pago_em: null, obra_id: a.p_obra ?? null, cliente_id: a.p_cliente ?? null, contrato_id: a.p_contrato ?? null, parcela: i, total_parcelas: n, created_at: new Date().toISOString() });
      }
      save();
      return n as any;
    }
    if (fn === "busca_global") {
      const q = String(a.p_termo ?? "").toLowerCase();
      const f = (tb: string, cols: string[]) => db[tb].filter((r) => visible(tb, r) && cols.some((c) => String(r[c] ?? "").toLowerCase().includes(q))).slice(0, 6);
      return [
        ...f("obras", ["nome", "endereco"]).map((r) => ({ tipo: "obra", id: r.id, titulo: r.nome, subtitulo: r.endereco ?? "" })),
        ...f("clientes", ["nome", "documento"]).map((r) => ({ tipo: "cliente", id: r.id, titulo: r.nome, subtitulo: r.email ?? "" })),
        ...f("tarefas", ["titulo"]).map((r) => ({ tipo: "tarefa", id: r.id, titulo: r.titulo, subtitulo: r.prazo ?? "" })),
        ...f("orcamentos", ["titulo"]).map((r) => ({ tipo: "orcamento", id: r.id, titulo: `Orçamento Nº ${String(r.numero).padStart(5, "0")}`, subtitulo: r.titulo })),
      ] as any;
    }
    throw new Error(`RPC ${fn} indisponível na demonstração.`);
  },
  async invoke(fn, body) {
    await wait(300);
    if (fn !== "admin-users") throw new Error("Função indisponível.");
    if (!isGestor()) throw perm("Você não possui permissão para gerenciar usuários.");
    const master = me().role === "admin_master";
    const adminRoles = ["admin_master", "administrador"];
    if (body.action === "create") {
      if (db.profiles.some((p) => p.email.toLowerCase() === String(body.email).toLowerCase())) throw new Error("Já existe um usuário com este e-mail.");
      if (adminRoles.includes(body.role) && !master) throw perm("Somente o Administrador Master pode criar perfis administrativos.");
      const id = uuid();
      db.profiles.push({ id, nome: body.nome, email: String(body.email).toLowerCase(), telefone: String(body.telefone ?? "").replace(/\D/g, "") || null, cargo: body.cargo || null, ativo: body.ativo !== false, cliente_id: body.role === "cliente" ? body.cliente_id : null, avatar_url: null, created_at: new Date().toISOString() });
      db.user_roles.push({ user_id: id, role: body.role });
      save();
      return { ok: true, user_id: id, convite_enviado: !body.senha_provisoria } as any;
    }
    const targetRole = db.user_roles.find((r) => r.user_id === body.user_id)?.role;
    if (adminRoles.includes(targetRole) && !master) throw perm("Você não pode alterar este usuário.");
    if (body.action === "update") {
      if (body.role && body.role !== targetRole) {
        if (body.user_id === me().id) throw perm("Você não pode alterar o seu próprio perfil de acesso.");
        if (adminRoles.includes(body.role) && !master) throw perm("Somente o Administrador Master pode conceder perfis administrativos.");
        if (targetRole === "admin_master" && db.user_roles.filter((r) => r.role === "admin_master").length < 2)
          throw perm("O sistema precisa manter ao menos um Administrador Master ativo.");
        db.user_roles.find((r) => r.user_id === body.user_id)!.role = body.role;
      }
      const p = db.profiles.find((x) => x.id === body.user_id)!;
      Object.assign(p, { nome: body.nome ?? p.nome, telefone: body.telefone !== undefined ? String(body.telefone).replace(/\D/g, "") || null : p.telefone, cargo: body.cargo ?? p.cargo, cliente_id: (body.role ?? targetRole) === "cliente" ? body.cliente_id ?? p.cliente_id : null });
      save();
      return { ok: true } as any;
    }
    if (body.action === "set_active") {
      if (body.user_id === me().id) throw perm("Você não pode desativar a sua própria conta.");
      db.profiles.find((x) => x.id === body.user_id)!.ativo = !!body.ativo;
      save();
      return { ok: true } as any;
    }
    if (body.action === "reset_password") return { ok: true } as any;
    throw new Error("Ação inválida.");
  },

  async upload(_b, path, file) {
    await wait(250);
    files.set(path, URL.createObjectURL(file));
    return path;
  },
  async fileUrl(_b, path) {
    if (files.has(path)) return files.get(path)!;
    if (path.startsWith("demo://")) return path;
    const foto = db.obra_fotos.find((f) => f.storage_path === path);
    if (foto) return `demo://foto/${foto.demo_art ?? 0}`;
    return "demo://arquivo";
  },
  async removeFile(_b, path) { files.delete(path); },

  async getSession() {
    const id = sessionUser();
    const p = db.profiles.find((x) => x.id === id);
    return { user: p ? { id: p.id, email: p.email } : null };
  },
  onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  async signIn(email) {
    await wait(500);
    const p = db.profiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!p) throw new Error("Invalid login credentials");
    if (!p.ativo) throw new Error("User is banned");
    store.set(SESSION_KEY, p.id);
    listeners.forEach((l) => l({ user: { id: p.id, email: p.email } }, "SIGNED_IN"));
  },
  async signOut() {
    store.del(SESSION_KEY);
    listeners.forEach((l) => l({ user: null }, "SIGNED_OUT"));
  },
  async requestPasswordReset() { await wait(600); },
  async updatePassword() { await wait(500); },
  async loadAccess(userId) {
    const p = db.profiles.find((x) => x.id === userId) ?? null;
    return { profile: p ? { ...p } : null, role: (db.user_roles.find((r) => r.user_id === userId)?.role as Role) ?? null };
  },
  watchAccess(_userId, cb) {
    const t = window.setInterval(cb, 15000);
    return () => window.clearInterval(t);
  },
};

export const DEMO_LOGINS = [
  { label: "Administrador Master", email: "eric@tecnica.eng.br", id: DEMO_USERS.master },
  { label: "Colaborador (engenheiro)", email: "carlos@tecnica.eng.br", id: DEMO_USERS.colaborador },
  { label: "Cliente (Portal)", email: "joao.silva@email.com", id: DEMO_USERS.cliente },
];
