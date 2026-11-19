import type { Role } from "@/data/types";

export type Modulo =
  | "dashboard" | "obras" | "clientes" | "orcamentos" | "contratos" | "financeiro" | "tarefas" | "vistorias"
  | "laudos" | "materiais" | "fornecedores" | "equipe" | "agenda" | "documentos" | "relatorios"
  | "configuracoes" | "usuarios" | "perfil" | "portal";

const GESTOR: Role[] = ["admin_master", "administrador"];
const STAFF: Role[] = ["admin_master", "administrador", "colaborador"];

/** Matriz perfil × módulo (o banco aplica a mesma regra via RLS). */
export const ACESSO: Record<Modulo, Role[]> = {
  dashboard: STAFF,
  obras: STAFF,
  clientes: GESTOR,
  orcamentos: GESTOR,
  contratos: GESTOR,
  financeiro: GESTOR,
  tarefas: STAFF,
  vistorias: STAFF,
  laudos: STAFF,
  materiais: STAFF,
  fornecedores: GESTOR,
  equipe: GESTOR,
  agenda: STAFF,
  documentos: STAFF,
  relatorios: GESTOR,
  configuracoes: GESTOR,
  usuarios: GESTOR,
  perfil: ["admin_master", "administrador", "colaborador", "cliente"],
  portal: ["cliente"],
};

export const can = (role: Role | null | undefined, m: Modulo) => !!role && ACESSO[m].includes(role);
export const isGestor = (role?: Role | null) => role === "admin_master" || role === "administrador";
export const homeFor = (role?: Role | null) => (role === "cliente" ? "/portal" : "/");
