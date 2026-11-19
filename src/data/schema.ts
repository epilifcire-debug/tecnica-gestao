/**
 * Relações usadas para "embutir" dados relacionados nas consultas.
 * Supabase: gera `alias:fk(colunas)` (PostgREST). Demo: resolve no cliente.
 */
export interface Rel { table: string; fk: string; cols: string }
export const RELATIONS: Record<string, Record<string, Rel>> = {
  obras: {
    cliente: { table: "clientes", fk: "cliente_id", cols: "id,nome,telefone,email" },
    responsavel: { table: "profiles", fk: "responsavel_id", cols: "id,nome,cargo" },
  },
  tarefas: {
    obra: { table: "obras", fk: "obra_id", cols: "id,nome" },
    responsavel: { table: "profiles", fk: "responsavel_id", cols: "id,nome" },
  },
  rdos: { autor: { table: "profiles", fk: "autor_id", cols: "id,nome" }, obra: { table: "obras", fk: "obra_id", cols: "id,nome" } },
  orcamentos: {
    cliente: { table: "clientes", fk: "cliente_id", cols: "id,nome,telefone,email,documento,endereco" },
    obra: { table: "obras", fk: "obra_id", cols: "id,nome" },
  },
  contratos: {
    cliente: { table: "clientes", fk: "cliente_id", cols: "id,nome" },
    obra: { table: "obras", fk: "obra_id", cols: "id,nome" },
  },
  lancamentos: {
    obra: { table: "obras", fk: "obra_id", cols: "id,nome" },
    cliente: { table: "clientes", fk: "cliente_id", cols: "id,nome" },
    fornecedor: { table: "fornecedores", fk: "fornecedor_id", cols: "id,nome" },
  },
  vistorias: {
    obra: { table: "obras", fk: "obra_id", cols: "id,nome" },
    cliente: { table: "clientes", fk: "cliente_id", cols: "id,nome" },
    responsavel: { table: "profiles", fk: "responsavel_id", cols: "id,nome" },
  },
  laudos: {
    obra: { table: "obras", fk: "obra_id", cols: "id,nome" },
    cliente: { table: "clientes", fk: "cliente_id", cols: "id,nome" },
    responsavel: { table: "profiles", fk: "responsavel_id", cols: "id,nome" },
  },
  compromissos: {
    obra: { table: "obras", fk: "obra_id", cols: "id,nome" },
    cliente: { table: "clientes", fk: "cliente_id", cols: "id,nome" },
    responsavel: { table: "profiles", fk: "responsavel_id", cols: "id,nome" },
  },
  materiais: { fornecedor: { table: "fornecedores", fk: "fornecedor_id", cols: "id,nome" } },
  material_movimentos: {
    material: { table: "materiais", fk: "material_id", cols: "id,nome,unidade" },
    obra: { table: "obras", fk: "obra_id", cols: "id,nome" },
  },
  documentos: { obra: { table: "obras", fk: "obra_id", cols: "id,nome" }, autor: { table: "profiles", fk: "autor_id", cols: "id,nome" } },
  obra_usuarios: { usuario: { table: "profiles", fk: "user_id", cols: "id,nome,cargo,email" } },
  obra_equipe: { funcionario: { table: "funcionarios", fk: "funcionario_id", cols: "id,nome,funcao,telefone" } },
  profiles: { cliente: { table: "clientes", fk: "cliente_id", cols: "id,nome" } },
};

export function selectString(table: string, embed?: string[]) {
  if (!embed?.length) return "*";
  const rels = RELATIONS[table] ?? {};
  return ["*", ...embed.map((a) => {
    const r = rels[a];
    if (!r) throw new Error(`Relação desconhecida: ${table}.${a}`);
    return `${a}:${r.fk}(${r.cols})`;
  })].join(",");
}
