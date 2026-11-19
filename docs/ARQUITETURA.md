# Arquitetura e regras

## Perfis
| Perfil | O que faz |
|---|---|
| Administrador Master | Tudo. Único que concede/retira perfis administrativos e altera a assinatura EFCsys. Protegido: o banco impede ficar sem nenhum Master ativo. |
| Administrador | Opera todos os módulos; gerencia apenas Colaboradores e Clientes. |
| Colaborador | Vê só as obras em que é responsável ou foi liberado (aba Equipe). Lança RDO, fotos, tarefas, cronograma e saídas de material nessas obras. Sem financeiro, orçamentos, contratos ou usuários. |
| Cliente | Portal do Cliente: suas obras, RDOs e fotos marcados como visíveis, documentos liberados, orçamentos enviados, parcelas e laudos concluídos liberados. Somente leitura. |

Usuário **inativo** perde acesso no banco na hora (todas as policies negam), é banido no Auth pela Edge Function e é deslogado no app (Realtime + revalidação periódica).

## Matriz módulo × perfil (frontend = `src/auth/permissions.ts`; banco = RLS)
| Módulo | Master | Admin | Colab. | Cliente |
|---|---|---|---|---|
| Dashboard | ✔ | ✔ | ✔ (sem financeiro) | → Portal |
| Obras / RDO / Fotos / Cronograma / Tarefas | ✔ | ✔ | só obras dele | leitura no Portal |
| Clientes, Orçamentos, Contratos, Financeiro, Fornecedores, Equipe, Relatórios, Configurações, Usuários | ✔ | ✔ | ✖ | ✖ |
| Vistorias / Laudos | ✔ | ✔ | as dele / das obras dele | laudos liberados |
| Materiais | ✔ | ✔ | leitura + saída para obra | ✖ |
| Agenda / Documentos | ✔ | ✔ | os dele / das obras dele | ✖ |

## Banco (supabase/migrations)
- **0001** perfis, `user_roles` (papel separado do perfil), funções `current_app_role/is_master/is_gestor/is_staff/my_cliente_id`, trigger de novo usuário (1º = Master; papel vem de `app_metadata`, que o cliente não forja), proteção do Master, `empresa_config` com assinatura EFCsys.
- **0002** fornecedores, funcionários, materiais, obras, acesso/equipe por obra, `can_access_obra/can_edit_obra`, etapas (progresso ponderado automático), RDO (1 por obra/dia), fotos, documentos, tarefas.
- **0003** orçamentos + itens (totais calculados no banco, travados após aprovação), contratos, lançamentos (coerência pago/data), movimentos de estoque (saldo automático, sem estoque negativo), vistorias, laudos, compromissos.
- **0004** RLS em todas as tabelas, sem `true` em operação sensível; anônimo sem acesso.
- **0005** RPCs: `dashboard_resumo`, `receitas_gastos_mensal`, `saldo_diario`, `obra_financeiro`, `aprovar_orcamento` (atômico e idempotente: cria contrato e, opcionalmente, a obra), `duplicar_orcamento`, `gerar_parcelas`, `busca_global`.
- **0006** buckets (`obras` e `documentos` privados com URL assinada; `avatars` e `empresa` públicos) com policies por obra/papel; `audit_log` com trilha de alterações; Realtime só em `profiles`/`user_roles`.

## Fórmulas do Dashboard
- Recebido = receitas **pagas** com `pago_em` no período · Gastos = despesas pagas no período · Saldo = Recebido − Gastos
- A receber = receitas pendentes · Obras atrasadas = em andamento, previsão < hoje e progresso < 100%
- Variação % = período atual × período anterior de mesma duração
- Financeiro da obra: saldo previsto = valor contratado − despesas pagas; % recebido = recebido ÷ contratado

## PWA
Manifest próprio, ícone circular + maskable, service worker só para assets versionados (dados nunca em cache), aviso de nova versão sem reload forçado, convite de instalação discreto (no máximo 1×/semana).
