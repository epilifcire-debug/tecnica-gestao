export type Role = "admin_master" | "administrador" | "colaborador" | "cliente";
export type Row = Record<string, any>;

export interface Profile {
  id: string; nome: string; username: string; email: string | null; telefone: string | null; cargo: string | null;
  avatar_url: string | null; ativo: boolean; cliente_id: string | null; created_at: string;
}
export interface Obra {
  id: string; codigo: number; nome: string; cliente_id: string | null; responsavel_id: string | null; tipo: string;
  status: ObraStatus; endereco: string | null; cidade: string | null; uf: string | null; area_m2: number | null;
  data_inicio: string | null; previsao_termino: string | null; data_conclusao: string | null;
  valor_contratado: number; progresso: number; capa_path: string | null; descricao: string | null; created_at: string;
  cliente?: { id: string; nome: string } | null; responsavel?: { id: string; nome: string } | null;
}
export type ObraStatus = "orcamento" | "planejamento" | "em_andamento" | "pausada" | "concluida" | "cancelada";

export const ROLE_LABEL: Record<Role, string> = {
  admin_master: "Administrador Master",
  administrador: "Administrador",
  colaborador: "Colaborador",
  cliente: "Cliente",
};

export const OBRA_STATUS: Record<ObraStatus, { label: string; tone: Tone }> = {
  orcamento: { label: "Em orçamento", tone: "violet" },
  planejamento: { label: "Planejamento", tone: "info" },
  em_andamento: { label: "Em andamento", tone: "ok" },
  pausada: { label: "Pausada", tone: "warn" },
  concluida: { label: "Concluída", tone: "pearl" },
  cancelada: { label: "Cancelada", tone: "bad" },
};
export type Tone = "ok" | "bad" | "warn" | "info" | "violet" | "pearl" | "muted";

export const opts = <K extends string>(m: Record<K, { label: string; tone: Tone } | string>) =>
  (Object.keys(m) as K[]).map((k) => ({ value: k, label: typeof m[k] === "string" ? (m[k] as string) : (m[k] as any).label }));

export const ORC_STATUS = {
  rascunho: { label: "Rascunho", tone: "muted" }, enviado: { label: "Enviado", tone: "info" },
  aprovado: { label: "Aprovado", tone: "ok" }, recusado: { label: "Recusado", tone: "bad" }, expirado: { label: "Expirado", tone: "warn" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export const CONTRATO_STATUS = {
  rascunho: { label: "Rascunho", tone: "muted" }, vigente: { label: "Vigente", tone: "ok" },
  concluido: { label: "Concluído", tone: "pearl" }, cancelado: { label: "Cancelado", tone: "bad" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export const LANC_STATUS = {
  pendente: { label: "Pendente", tone: "warn" }, pago: { label: "Pago", tone: "ok" }, cancelado: { label: "Cancelado", tone: "muted" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export const TAREFA_STATUS = {
  pendente: { label: "Pendente", tone: "warn" }, em_andamento: { label: "Em andamento", tone: "info" },
  concluida: { label: "Concluída", tone: "ok" }, cancelada: { label: "Cancelada", tone: "muted" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export const PRIORIDADE = {
  baixa: { label: "Baixa", tone: "muted" }, media: { label: "Média", tone: "info" },
  alta: { label: "Alta", tone: "warn" }, urgente: { label: "Urgente", tone: "bad" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export const VISTORIA_STATUS = {
  agendada: { label: "Agendada", tone: "violet" }, realizada: { label: "Realizada", tone: "ok" }, cancelada: { label: "Cancelada", tone: "muted" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export const LAUDO_STATUS = {
  em_elaboracao: { label: "Em elaboração", tone: "warn" }, em_revisao: { label: "Em revisão", tone: "info" },
  concluido: { label: "Concluído", tone: "ok" }, entregue: { label: "Entregue", tone: "pearl" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export const ETAPA_STATUS = {
  nao_iniciada: { label: "Não iniciada", tone: "muted" }, em_andamento: { label: "Em andamento", tone: "info" },
  concluida: { label: "Concluída", tone: "ok" }, atrasada: { label: "Atrasada", tone: "bad" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export const CLIMA = {
  ensolarado: "Ensolarado", nublado: "Nublado", chuvoso: "Chuvoso", chuva_forte: "Chuva forte", instavel: "Instável",
} as const;
export const COMPROMISSO_TIPO = {
  visita_tecnica: "Visita técnica", reuniao: "Reunião", vistoria: "Vistoria", entrega: "Entrega",
  acompanhamento: "Acompanhamento", apresentacao: "Apresentação", outro: "Outro",
} as const;
