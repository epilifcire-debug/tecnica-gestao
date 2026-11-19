import {
  LayoutDashboard, Building2, Users, Calculator, FileSignature, CircleDollarSign, ListChecks, ClipboardCheck, FileBadge2,
  Package, Truck, HardHat, CalendarDays, FolderOpen, BarChart3, Settings, UserCog, type LucideIcon,
} from "lucide-react";
import type { Modulo } from "@/auth/permissions";

export interface NavItem { to: string; label: string; icon: LucideIcon; modulo: Modulo }
export const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, modulo: "dashboard" },
  { to: "/obras", label: "Obras", icon: Building2, modulo: "obras" },
  { to: "/clientes", label: "Clientes", icon: Users, modulo: "clientes" },
  { to: "/orcamentos", label: "Orçamentos", icon: Calculator, modulo: "orcamentos" },
  { to: "/contratos", label: "Contratos", icon: FileSignature, modulo: "contratos" },
  { to: "/financeiro", label: "Financeiro", icon: CircleDollarSign, modulo: "financeiro" },
  { to: "/tarefas", label: "Tarefas", icon: ListChecks, modulo: "tarefas" },
  { to: "/vistorias", label: "Vistorias", icon: ClipboardCheck, modulo: "vistorias" },
  { to: "/laudos", label: "Laudos", icon: FileBadge2, modulo: "laudos" },
  { to: "/materiais", label: "Materiais", icon: Package, modulo: "materiais" },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck, modulo: "fornecedores" },
  { to: "/equipe", label: "Equipe", icon: HardHat, modulo: "equipe" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, modulo: "agenda" },
  { to: "/documentos", label: "Documentos", icon: FolderOpen, modulo: "documentos" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, modulo: "relatorios" },
];
export const NAV_FOOTER: NavItem[] = [
  { to: "/usuarios", label: "Usuários", icon: UserCog, modulo: "usuarios" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, modulo: "configuracoes" },
];
