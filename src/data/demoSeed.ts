/**
 * DADOS DE DEMONSTRAÇÃO — usados SOMENTE no build "demo" (preview navegável).
 * Nunca são carregados em produção (build padrão usa o Supabase).
 */
import type { Row } from "./types";
import { addDays, isoDate } from "@/lib/format";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = new Date();
const d = (offset: number) => isoDate(addDays(now, offset));
const ts = (offset: number, h = 9, m = 0) => {
  const x = addDays(now, offset);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};

export const DEMO_USERS = {
  master: uid(1),
  colaborador: uid(2),
  cliente: uid(3),
  administrador: uid(4),
};

export function buildSeed(): Record<string, Row[]> {
  const clientes = [
    { id: uid(101), tipo_pessoa: "PF", nome: "João da Silva", documento: "52998224725", email: "joao.silva@email.com", telefone: "79999887766", endereco: "Rua das Flores, 123 — Centro", cidade: "Aracaju", uf: "SE", ativo: true },
    { id: uid(102), tipo_pessoa: "PF", nome: "Maria Souza", documento: "11144477735", email: "maria.souza@email.com", telefone: "79988112233", endereco: "Av. Beira Mar, 1000", cidade: "Aracaju", uf: "SE", ativo: true },
    { id: uid(103), tipo_pessoa: "PJ", nome: "Construtora Vista Mar Ltda", documento: "11222333000181", email: "contato@vistamar.com.br", telefone: "7932114455", endereco: "Av. Central, 500", cidade: "Aracaju", uf: "SE", ativo: true },
    { id: uid(104), tipo_pessoa: "PJ", nome: "Grupo Monte Verde", documento: "45723174000110", email: "obras@monteverde.com.br", telefone: "7930001122", endereco: "Rua do Comércio, 88", cidade: "Aracaju", uf: "SE", ativo: true },
    { id: uid(105), tipo_pessoa: "PF", nome: "João Oliveira", documento: "39053344705", email: "joao.oliveira@email.com", telefone: "79991234567", endereco: "Rua das Palmeiras, 302", cidade: "Aracaju", uf: "SE", ativo: true },
    { id: uid(106), tipo_pessoa: "PJ", nome: "Centro Empresarial Jardins S/A", documento: "04252011000110", email: "adm@cejardins.com.br", telefone: "7933445566", endereco: "Av. Jorge Amado, 1500", cidade: "Aracaju", uf: "SE", ativo: true },
  ].map((c, i) => ({ ...c, created_at: ts(-200 + i * 20) }));

  const profiles = [
    { id: DEMO_USERS.master, username: "eric", nome: "Eric Filipe", email: "eric@tecnica.eng.br", telefone: "79999990000", cargo: "Diretor", ativo: true, cliente_id: null },
    { id: DEMO_USERS.colaborador, username: "carlos", nome: "Eng. Carlos Mendes", email: "carlos@tecnica.eng.br", telefone: "79999991111", cargo: "Engenheiro Civil", ativo: true, cliente_id: null },
    { id: DEMO_USERS.cliente, username: "joao.silva", nome: "João da Silva", email: "joao.silva@email.com", telefone: "79999887766", cargo: null, ativo: true, cliente_id: uid(101) },
    { id: DEMO_USERS.administrador, username: "ana", nome: "Ana Paula Rocha", email: "ana@tecnica.eng.br", telefone: "79999992222", cargo: "Administrativo", ativo: true, cliente_id: null },
    { id: uid(5), username: "ricardo", nome: "Ricardo Lima", email: null, telefone: "79999993333", cargo: "Mestre de obras", ativo: false, cliente_id: null },
  ].map((p, i) => ({ ...p, avatar_url: null, created_at: ts(-300 + i * 30) }));

  const user_roles = [
    { user_id: DEMO_USERS.master, role: "admin_master" },
    { user_id: DEMO_USERS.colaborador, role: "colaborador" },
    { user_id: DEMO_USERS.cliente, role: "cliente" },
    { user_id: DEMO_USERS.administrador, role: "administrador" },
    { user_id: uid(5), role: "colaborador" },
  ];

  const O = { silva: uid(201), jardins: uid(202), monte: uid(203), vista: uid(204), centro: uid(205), loja: uid(206), apt: uid(207), horizon: uid(208) };
  const obras = [
    { id: O.jardins, nome: "Residencial Jardins", cliente_id: uid(103), tipo: "Residencial multifamiliar", status: "em_andamento", endereco: "Av. Central, 500", data_inicio: d(-240), previsao_termino: d(120), valor_contratado: 1850000, capa: 1 },
    { id: O.monte, nome: "Edifício Monte Verde", cliente_id: uid(104), tipo: "Comercial", status: "em_andamento", endereco: "Rua do Comércio, 88", data_inicio: d(-150), previsao_termino: d(210), valor_contratado: 2400000, capa: 2 },
    { id: O.vista, nome: "Condomínio Vista Mar", cliente_id: uid(103), tipo: "Residencial multifamiliar", status: "em_andamento", endereco: "Av. Beira Mar, 2200", data_inicio: d(-320), previsao_termino: d(40), valor_contratado: 3100000, capa: 3 },
    { id: O.centro, nome: "Centro Empresarial", cliente_id: uid(106), tipo: "Comercial", status: "em_andamento", endereco: "Av. Jorge Amado, 1500", data_inicio: d(-90), previsao_termino: d(300), valor_contratado: 4200000, capa: 4 },
    { id: O.silva, nome: "Residência Silva", cliente_id: uid(101), tipo: "Residencial", status: "em_andamento", endereco: "Rua das Flores, 123 — Centro", data_inicio: d(-60), previsao_termino: d(45), valor_contratado: 80000, capa: 0 },
    { id: O.loja, nome: "Loja Centro", cliente_id: uid(104), tipo: "Comercial", status: "em_andamento", endereco: "Rua do Comércio, 88", data_inicio: d(-120), previsao_termino: d(-6), valor_contratado: 145000, capa: 2 },
    { id: O.apt, nome: "Reforma Apt. 302", cliente_id: uid(105), tipo: "Reforma", status: "em_andamento", endereco: "Rua das Palmeiras, 302", data_inicio: d(-30), previsao_termino: d(-2), valor_contratado: 62000, capa: 3 },
    { id: O.horizon, nome: "Edifício Horizon", cliente_id: uid(102), tipo: "Residencial", status: "planejamento", endereco: "Av. Beira Mar, 1000", data_inicio: d(20), previsao_termino: d(400), valor_contratado: 0, capa: 1 },
  ].map((o, i) => ({
    ...o, codigo: i + 1, responsavel_id: i % 2 === 0 ? DEMO_USERS.colaborador : DEMO_USERS.master, cidade: "Aracaju", uf: "SE",
    area_m2: [3200, 5400, 7800, 9600, 180, 220, 95, 4100][i], data_conclusao: null, progresso: 0,
    capa_path: `demo://capa/${o.capa}`, descricao: null, created_at: ts(-260 + i * 25),
  }));

  const obra_usuarios = [
    { obra_id: O.silva, user_id: DEMO_USERS.colaborador, papel: "encarregado" },
    { obra_id: O.vista, user_id: DEMO_USERS.colaborador, papel: "membro" },
  ];

  const etapasBase = [
    ["Demolição / Serviços preliminares", 1], ["Fundação", 2], ["Estrutura", 3], ["Alvenaria", 2],
    ["Elétrica", 1.5], ["Hidráulica", 1.5], ["Revestimento", 2], ["Pintura", 1], ["Acabamentos", 1.5],
  ] as const;
  const progressoAlvo: Record<string, number> = {
    [O.jardins]: 70, [O.monte]: 45, [O.vista]: 82, [O.centro]: 38, [O.silva]: 72, [O.loja]: 85, [O.apt]: 31, [O.horizon]: 0,
  };
  const obra_etapas: Row[] = [];
  let eid = 300;
  for (const o of obras) {
    const alvo = progressoAlvo[o.id];
    const totalPeso = etapasBase.reduce((a, [, p]) => a + p, 0);
    let acumulado = 0;
    etapasBase.forEach(([nome, peso], i) => {
      const fatia = (peso / totalPeso) * 100;
      let perc = 0;
      if (acumulado + fatia <= alvo) perc = 100;
      else if (acumulado < alvo) perc = Math.round(((alvo - acumulado) / fatia) * 100);
      acumulado += fatia;
      const ini0 = new Date(o.data_inicio!), fim0 = new Date(o.previsao_termino!);
      const passo = Math.max(5, Math.round((fim0.getTime() - ini0.getTime()) / 864e5 / 9));
      const ini = addDays(ini0, i * passo);
      const fim = addDays(ini, Math.round(passo * 1.3));
      obra_etapas.push({
        id: uid(eid++), obra_id: o.id, nome, ordem: i, peso, percentual: perc,
        inicio_previsto: isoDate(ini), fim_previsto: isoDate(fim), inicio_real: perc > 0 ? isoDate(ini) : null,
        fim_real: perc >= 100 ? isoDate(fim) : null,
        status: perc >= 100 ? "concluida" : perc > 0 ? (fim < now ? "atrasada" : "em_andamento") : "nao_iniciada",
        observacoes: null, created_at: ts(-100),
      });
    });
  }

  const rdos = [
    { id: uid(401), obra_id: O.silva, data: d(-1), clima_manha: "ensolarado", clima_tarde: "nublado", equipe: "2 Pedreiros, 1 Servente, 1 Eletricista", efetivo_total: 4, servicos_executados: "Execução de alvenaria externa e instalação dos pontos elétricos.", ocorrencias: "Atraso na entrega do material elétrico.", observacoes: "Sem observações adicionais.", visivel_cliente: true, autor_id: DEMO_USERS.colaborador },
    { id: uid(402), obra_id: O.silva, data: d(-2), clima_manha: "ensolarado", clima_tarde: "ensolarado", equipe: "2 Pedreiros, 2 Serventes", efetivo_total: 4, servicos_executados: "Instalação elétrica — passagem de eletrodutos no pavimento térreo.", ocorrencias: null, observacoes: null, visivel_cliente: true, autor_id: DEMO_USERS.colaborador },
    { id: uid(403), obra_id: O.silva, data: d(-3), clima_manha: "chuvoso", clima_tarde: "nublado", equipe: "2 Pedreiros, 1 Servente", efetivo_total: 3, servicos_executados: "Alvenaria — elevação das paredes da área de serviço.", ocorrencias: "Chuva interrompeu os serviços externos pela manhã.", observacoes: null, visivel_cliente: true, autor_id: DEMO_USERS.colaborador },
    { id: uid(404), obra_id: O.vista, data: d(-1), clima_manha: "nublado", clima_tarde: "nublado", equipe: "6 Pedreiros, 4 Serventes, 2 Armadores", efetivo_total: 12, servicos_executados: "Concretagem da laje do 9º pavimento.", ocorrencias: null, observacoes: null, visivel_cliente: true, autor_id: DEMO_USERS.colaborador },
  ].map((r) => ({ ...r, created_at: ts(-1) }));

  const obra_fotos: Row[] = [];
  let fid = 500;
  [[-1, 3], [-3, 3], [-4, 2]].forEach(([off, n]) => {
    for (let i = 0; i < n; i++) obra_fotos.push({
      id: uid(fid++), obra_id: O.silva, rdo_id: null, storage_path: `${O.silva}/fotos/demo-${fid}.jpg`, demo_art: (fid % 5),
      legenda: ["Fachada", "Alvenaria externa", "Pontos elétricos", "Área de serviço", "Vista lateral"][fid % 5],
      data: d(off), visivel_cliente: true, autor_id: DEMO_USERS.colaborador, created_at: ts(off),
    });
  });

  const documentos = [
    { id: uid(601), obra_id: O.silva, nome: "Contrato de empreitada.pdf", categoria: "Contrato", storage_path: `${O.silva}/docs/contrato.pdf`, mime_type: "application/pdf", tamanho_bytes: 248000, visivel_cliente: true },
    { id: uid(602), obra_id: O.silva, nome: "Projeto arquitetônico.pdf", categoria: "Projeto", storage_path: `${O.silva}/docs/projeto.pdf`, mime_type: "application/pdf", tamanho_bytes: 3480000, visivel_cliente: true },
    { id: uid(603), obra_id: O.silva, nome: "ART — Execução.pdf", categoria: "ART", storage_path: `${O.silva}/docs/art.pdf`, mime_type: "application/pdf", tamanho_bytes: 120000, visivel_cliente: false },
    { id: uid(604), obra_id: null, nome: "Alvará de funcionamento 2026.pdf", categoria: "Alvará", storage_path: "geral/alvara.pdf", mime_type: "application/pdf", tamanho_bytes: 180000, visivel_cliente: false },
  ].map((x) => ({ ...x, autor_id: DEMO_USERS.master, created_at: ts(-15) }));

  const tarefas = [
    { titulo: "Comprar material elétrico (lote 2)", obra_id: O.silva, responsavel_id: DEMO_USERS.colaborador, prazo: d(-2), status: "pendente", prioridade: "alta" },
    { titulo: "Revisar cronograma da Loja Centro", obra_id: O.loja, responsavel_id: DEMO_USERS.master, prazo: d(-4), status: "em_andamento", prioridade: "urgente" },
    { titulo: "Enviar medição de setembro", obra_id: O.vista, responsavel_id: DEMO_USERS.administrador, prazo: d(-1), status: "pendente", prioridade: "media" },
    { titulo: "Solicitar ligação definitiva de energia", obra_id: O.jardins, responsavel_id: DEMO_USERS.colaborador, prazo: d(-7), status: "pendente", prioridade: "alta" },
    { titulo: "Contratar equipe de pintura", obra_id: O.apt, responsavel_id: DEMO_USERS.master, prazo: d(-3), status: "pendente", prioridade: "media" },
    { titulo: "Checklist de segurança (NR-18)", obra_id: O.centro, responsavel_id: DEMO_USERS.colaborador, prazo: d(3), status: "pendente", prioridade: "alta" },
    { titulo: "Aprovar amostras de revestimento", obra_id: O.monte, responsavel_id: DEMO_USERS.master, prazo: d(6), status: "em_andamento", prioridade: "media" },
    { titulo: "Atualizar fotos da fachada", obra_id: O.silva, responsavel_id: DEMO_USERS.colaborador, prazo: d(-10), status: "concluida", prioridade: "baixa" },
  ].map((t, i) => ({ ...t, id: uid(700 + i), descricao: null, concluida_em: t.status === "concluida" ? ts(-9) : null, created_by: DEMO_USERS.master, created_at: ts(-20 + i) }));

  const fornecedores = [
    { nome: "Cimentos Nordeste", categoria: "Cimento e argamassa", contato: "Paulo", telefone: "7932220000", email: "vendas@cimentosne.com.br", documento: "33000167000101" },
    { nome: "Elétrica Sergipe", categoria: "Elétrica", contato: "Fernanda", telefone: "7932221111", email: "orcamento@eletricase.com.br", documento: "60746948000112" },
    { nome: "Hidro Center", categoria: "Hidráulica", contato: "Marcos", telefone: "7932222222", email: "contato@hidrocenter.com", documento: "07526557000100" },
    { nome: "Locaçon Equipamentos", categoria: "Locação", contato: "Bruno", telefone: "7932223333", email: "locacao@locacon.com.br", documento: "18236120000158" },
    { nome: "Tintas Aracaju", categoria: "Pintura", contato: "Luana", telefone: "7932224444", email: "vendas@tintasaju.com.br", documento: "27865757000102" },
  ].map((f, i) => ({ ...f, id: uid(800 + i), endereco: "Aracaju/SE", observacoes: null, ativo: true, created_at: ts(-200 + i) }));

  const funcionarios = [
    { nome: "José Santos", funcao: "Pedreiro", diaria: 180 }, { nome: "Antônio Pereira", funcao: "Pedreiro", diaria: 180 },
    { nome: "Lucas Almeida", funcao: "Servente", diaria: 110 }, { nome: "Rafael Costa", funcao: "Eletricista", diaria: 220 },
    { nome: "Marcos Vinícius", funcao: "Encanador", diaria: 200 }, { nome: "Eng. Carlos Mendes", funcao: "Engenheiro Civil", diaria: null, user_id: DEMO_USERS.colaborador },
  ].map((f, i) => ({ ...f, id: uid(900 + i), cpf: null, telefone: `7998800${String(i).padStart(4, "0")}`, email: null, data_admissao: d(-400 + i * 30), user_id: (f as Row).user_id ?? null, ativo: true, observacoes: null, created_at: ts(-300) }));
  const obra_equipe = [0, 1, 2, 3].map((i) => ({ obra_id: O.silva, funcionario_id: uid(900 + i), funcao_na_obra: null, inicio: d(-60), fim: null }));

  const materiais = [
    { nome: "Cimento CP-II 50kg", unidade: "saco", categoria: "Cimento", estoque_atual: 180, estoque_minimo: 50, custo_unitario: 38.9, fornecedor_id: uid(800) },
    { nome: "Areia média", unidade: "m³", categoria: "Agregados", estoque_atual: 22, estoque_minimo: 10, custo_unitario: 120, fornecedor_id: uid(800) },
    { nome: "Bloco cerâmico 9x19x29", unidade: "un", categoria: "Alvenaria", estoque_atual: 2400, estoque_minimo: 3000, custo_unitario: 1.35, fornecedor_id: uid(800) },
    { nome: "Fio flexível 2,5mm", unidade: "rolo", categoria: "Elétrica", estoque_atual: 6, estoque_minimo: 10, custo_unitario: 189, fornecedor_id: uid(801) },
    { nome: "Tubo PVC 100mm", unidade: "barra", categoria: "Hidráulica", estoque_atual: 40, estoque_minimo: 15, custo_unitario: 64.5, fornecedor_id: uid(802) },
    { nome: "Tinta acrílica 18L", unidade: "lata", categoria: "Pintura", estoque_atual: 14, estoque_minimo: 8, custo_unitario: 329, fornecedor_id: uid(804) },
  ].map((m, i) => ({ ...m, id: uid(1000 + i), ativo: true, created_at: ts(-150) }));

  // ---- financeiro: 12 meses de movimentação realista
  const lancamentos: Row[] = [];
  let lid = 2000;
  const year = now.getFullYear();
  const receitasMes = [62, 285, 98, 118, 128, 96, 210, 182, 330, 205, 296, 260];
  const despesasMes = [28, 148, 92, 82, 88, 72, 150, 152, 108, 125, 166, 230];
  for (let m = 0; m <= now.getMonth(); m++) {
    const dia = m === now.getMonth() ? Math.max(1, now.getDate() - 3) : 20;
    const pagoEm = isoDate(new Date(year, m, dia));
    const obrasCic = [O.jardins, O.monte, O.vista, O.centro];
    const ob = obrasCic[m % 4];
    lancamentos.push({ id: uid(lid++), tipo: "receita", status: "pago", descricao: `Medição ${m + 1}/${year}`, categoria: "Medição", valor: receitasMes[m] * 1000, vencimento: pagoEm, pago_em: pagoEm, forma_pagamento: "Transferência", obra_id: ob, cliente_id: obras.find((o) => o.id === ob)!.cliente_id });
    lancamentos.push({ id: uid(lid++), tipo: "despesa", status: "pago", descricao: `Material e mão de obra ${m + 1}/${year}`, categoria: "Material", valor: despesasMes[m] * 1000, vencimento: pagoEm, pago_em: pagoEm, forma_pagamento: "PIX", obra_id: ob, fornecedor_id: uid(800 + (m % 5)) });
  }
  // obra Residência Silva — bate com a tela do mockup (80k / 50k / 31,5k)
  lancamentos.push(
    { id: uid(lid++), tipo: "receita", status: "pago", descricao: "Sinal — Residência Silva", categoria: "Sinal", valor: 30000, vencimento: d(-55), pago_em: d(-55), forma_pagamento: "PIX", obra_id: O.silva, cliente_id: uid(101), parcela: 1, total_parcelas: 4 },
    { id: uid(lid++), tipo: "receita", status: "pago", descricao: "Parcela 2/4 — Residência Silva", categoria: "Medição", valor: 20000, vencimento: d(-25), pago_em: d(-24), forma_pagamento: "PIX", obra_id: O.silva, cliente_id: uid(101), parcela: 2, total_parcelas: 4 },
    { id: uid(lid++), tipo: "receita", status: "pendente", descricao: "Parcela 3/4 — Residência Silva", categoria: "Medição", valor: 15000, vencimento: d(5), pago_em: null, obra_id: O.silva, cliente_id: uid(101), parcela: 3, total_parcelas: 4 },
    { id: uid(lid++), tipo: "receita", status: "pendente", descricao: "Parcela 4/4 — Residência Silva", categoria: "Medição", valor: 15000, vencimento: d(35), pago_em: null, obra_id: O.silva, cliente_id: uid(101), parcela: 4, total_parcelas: 4 },
    { id: uid(lid++), tipo: "despesa", status: "pago", descricao: "Cimento e blocos", categoria: "Material", valor: 12500, vencimento: d(-40), pago_em: d(-40), forma_pagamento: "Boleto", obra_id: O.silva, fornecedor_id: uid(800) },
    { id: uid(lid++), tipo: "despesa", status: "pago", descricao: "Mão de obra — quinzena", categoria: "Mão de obra", valor: 14000, vencimento: d(-20), pago_em: d(-20), forma_pagamento: "PIX", obra_id: O.silva },
    { id: uid(lid++), tipo: "despesa", status: "pago", descricao: "Material elétrico", categoria: "Material", valor: 5000, vencimento: d(-8), pago_em: d(-8), forma_pagamento: "Cartão", obra_id: O.silva, fornecedor_id: uid(801) },
    { id: uid(lid++), tipo: "despesa", status: "pendente", descricao: "Locação de andaimes", categoria: "Locação", valor: 2800, vencimento: d(4), pago_em: null, obra_id: O.jardins, fornecedor_id: uid(803) },
  );
  // contas a receber das obras grandes
  [[O.jardins, 120000, 8], [O.monte, 96750, 15], [O.vista, 85000, -3], [O.centro, 40000, 25]].forEach(([ob, v, off]) => {
    lancamentos.push({ id: uid(lid++), tipo: "receita", status: "pendente", descricao: `Medição prevista — ${obras.find((o) => o.id === ob)!.nome}`, categoria: "Medição", valor: v, vencimento: d(off as number), pago_em: null, obra_id: ob, cliente_id: obras.find((o) => o.id === ob)!.cliente_id });
  });
  lancamentos.forEach((l) => { l.created_at ??= ts(-90); l.observacoes ??= null; l.forma_pagamento ??= null; l.fornecedor_id ??= null; l.cliente_id ??= null; l.contrato_id ??= null; });

  const orcamentos = [
    { id: uid(1101), numero: 34, cliente_id: uid(101), obra_id: O.silva, titulo: "Residência Silva — ampliação", status: "enviado", data_emissao: d(-5), validade: d(10), desconto: 0 },
    { id: uid(1102), numero: 33, cliente_id: uid(105), obra_id: null, titulo: "Reforma de cozinha", status: "enviado", data_emissao: d(-8), validade: d(7), desconto: 500 },
    { id: uid(1103), numero: 32, cliente_id: uid(102), obra_id: O.horizon, titulo: "Edifício Horizon — fundação", status: "enviado", data_emissao: d(-12), validade: d(3), desconto: 0 },
    { id: uid(1104), numero: 31, cliente_id: uid(106), obra_id: null, titulo: "Adequação de acessibilidade", status: "rascunho", data_emissao: d(-1), validade: d(14), desconto: 0 },
    { id: uid(1105), numero: 30, cliente_id: uid(104), obra_id: O.loja, titulo: "Loja Centro — fachada", status: "aprovado", data_emissao: d(-130), validade: d(-115), desconto: 0, aprovado_em: ts(-125) },
    { id: uid(1106), numero: 29, cliente_id: uid(105), obra_id: null, titulo: "Impermeabilização de laje", status: "recusado", data_emissao: d(-60), validade: d(-45), desconto: 0 },
  ].map((o) => ({ ...o, subtotal: 0, total: 0, condicoes: "50% de entrada e saldo em 2 parcelas mensais. Prazo de execução: 45 dias.", observacoes: null, created_at: ts(-30) }));
  const itens: [string, string, string, number, number][] = [
    [uid(1101), "Demolição", "m²", 20, 100], [uid(1101), "Alvenaria", "m²", 35, 100], [uid(1101), "Elétrica", "vb", 1, 4000], [uid(1101), "Pintura", "m²", 100, 30],
    [uid(1102), "Demolição de revestimento", "m²", 18, 45], [uid(1102), "Revestimento porcelanato", "m²", 18, 180], [uid(1102), "Bancada em granito", "un", 1, 2600],
    [uid(1103), "Sondagem SPT", "furo", 6, 1400], [uid(1103), "Estacas hélice contínua", "m", 420, 165],
    [uid(1104), "Rampa de acesso", "un", 2, 3800], [uid(1104), "Barras de apoio", "un", 8, 260],
    [uid(1105), "Fachada ACM", "m²", 60, 980], [uid(1105), "Iluminação de fachada", "vb", 1, 12000],
    [uid(1106), "Manta asfáltica", "m²", 120, 72],
  ];
  const orcamento_itens = itens.map(([orc, descricao, unidade, quantidade, valor_unitario], i) => ({
    id: uid(1200 + i), orcamento_id: orc, ordem: i, descricao, unidade, quantidade, valor_unitario,
    subtotal: Math.round(quantidade * valor_unitario * 100) / 100, created_at: ts(-30),
  }));

  const contratos = [
    { id: uid(1301), numero: 18, cliente_id: uid(104), obra_id: O.loja, orcamento_id: uid(1105), objeto: "Execução da fachada e iluminação — Loja Centro", valor: 70800, data_assinatura: d(-122), inicio_vigencia: d(-120), fim_vigencia: d(-6), status: "vigente" },
    { id: uid(1302), numero: 17, cliente_id: uid(101), obra_id: O.silva, orcamento_id: null, objeto: "Construção — Residência Silva", valor: 80000, data_assinatura: d(-62), inicio_vigencia: d(-60), fim_vigencia: d(45), status: "vigente" },
    { id: uid(1303), numero: 16, cliente_id: uid(103), obra_id: O.vista, orcamento_id: null, objeto: "Empreitada global — Condomínio Vista Mar", valor: 3100000, data_assinatura: d(-325), inicio_vigencia: d(-320), fim_vigencia: d(40), status: "vigente" },
  ].map((c) => ({ ...c, storage_path: null, observacoes: null, created_at: ts(-120) }));

  const vistorias = [
    { tipo: "Vistoria técnica", obra_id: O.jardins, cliente_id: uid(103), data_agendada: ts(1, 9), status: "agendada" },
    { tipo: "Vistoria de recebimento", obra_id: O.loja, cliente_id: uid(104), data_agendada: ts(4, 14), status: "agendada" },
    { tipo: "Vistoria cautelar de vizinhança", obra_id: O.centro, cliente_id: uid(106), data_agendada: ts(9, 10), status: "agendada" },
    { tipo: "Vistoria técnica", obra_id: O.silva, cliente_id: uid(101), data_agendada: ts(-12, 10), status: "realizada", realizada_em: ts(-12, 11), relatorio: "Sem não conformidades relevantes." },
  ].map((v, i) => ({ ...v, id: uid(1400 + i), endereco: null, responsavel_id: DEMO_USERS.colaborador, checklist: [], realizada_em: (v as Row).realizada_em ?? null, relatorio: (v as Row).relatorio ?? null, created_by: DEMO_USERS.master, created_at: ts(-10) }));

  const laudos = [
    { numero: 12, tipo: "Laudo de inspeção predial", titulo: "Laudo de Inspeção Predial — Residência Silva", obra_id: O.silva, cliente_id: uid(101), status: "concluido", data_emissao: d(-30), visivel_cliente: true },
    { numero: 13, tipo: "Laudo elétrico", titulo: "Laudo Elétrico — Loja Centro", obra_id: O.loja, cliente_id: uid(104), status: "concluido", data_emissao: d(-40), visivel_cliente: true },
    { numero: 14, tipo: "Parecer técnico", titulo: "Parecer Técnico — Edifício Horizon", obra_id: O.horizon, cliente_id: uid(102), status: "em_elaboracao", data_emissao: null, prazo_entrega: d(6), visivel_cliente: false },
    { numero: 15, tipo: "Laudo de estabilidade", titulo: "Laudo de Estabilidade — Vista Mar", obra_id: O.vista, cliente_id: uid(103), status: "em_revisao", data_emissao: null, prazo_entrega: d(2), visivel_cliente: false },
  ].map((l, i) => ({ ...l, id: uid(1500 + i), vistoria_id: null, responsavel_id: DEMO_USERS.colaborador, art_numero: null, prazo_entrega: (l as Row).prazo_entrega ?? null, conteudo: null, conclusao: null, storage_path: null, created_by: DEMO_USERS.master, created_at: ts(-20) }));

  const compromissos = [
    { titulo: "Vistoria técnica", tipo: "vistoria", inicio: ts(1, 9), obra_id: O.jardins, cliente_id: null, responsavel_id: DEMO_USERS.colaborador },
    { titulo: "Reunião com cliente", tipo: "reuniao", inicio: ts(2, 14), obra_id: null, cliente_id: uid(105), responsavel_id: DEMO_USERS.master },
    { titulo: "Entrega de laudo", tipo: "entrega", inicio: ts(3, 10, 30), obra_id: O.monte, cliente_id: null, responsavel_id: DEMO_USERS.colaborador },
    { titulo: "Acompanhamento de obra", tipo: "acompanhamento", inicio: ts(5, 15), obra_id: O.vista, cliente_id: null, responsavel_id: DEMO_USERS.colaborador },
    { titulo: "Apresentação de orçamento", tipo: "apresentacao", inicio: ts(8, 11), obra_id: null, cliente_id: uid(102), responsavel_id: DEMO_USERS.master },
    { titulo: "Visita técnica — Residência Silva", tipo: "visita_tecnica", inicio: ts(0, 16), obra_id: O.silva, cliente_id: uid(101), responsavel_id: DEMO_USERS.colaborador },
  ].map((c, i) => ({ ...c, id: uid(1600 + i), fim: null, dia_inteiro: false, local: null, observacoes: null, concluido: false, created_by: DEMO_USERS.master, created_at: ts(-3) }));

  const empresa_config = [{
    id: true, razao_social: "Técnica Engenharia Ltda", nome_fantasia: "Técnica Engenharia", cnpj: "12345678000195",
    email: "contato@tecnica.eng.br", telefone: "7930000000", endereco: "Av. Ivo do Prado, 1000", cidade: "Aracaju", uf: "SE",
    logo_url: null, slogan: "Gestão de Obras", rodape_documentos: "Técnica Engenharia — Planejamento • Execução • Resultados",
    assinatura_visivel: true, assinatura_texto: "by: efcsys", assinatura_link: "https://efcsys.com", assinatura_logo_url: null,
  }];

  const material_movimentos = [
    { id: uid(1700), material_id: uid(1000), obra_id: O.silva, tipo: "saida", quantidade: 20, custo_unitario: null, observacao: "Alvenaria", autor_id: DEMO_USERS.colaborador, created_at: ts(-2) },
    { id: uid(1701), material_id: uid(1000), obra_id: null, tipo: "entrada", quantidade: 100, custo_unitario: 38.9, observacao: "NF 1234", autor_id: DEMO_USERS.master, created_at: ts(-6) },
  ];

  return {
    clientes, profiles, user_roles, obras, obra_usuarios, obra_equipe, obra_etapas, rdos, obra_fotos, documentos, tarefas,
    fornecedores, funcionarios, materiais, material_movimentos, lancamentos, orcamentos, orcamento_itens, contratos,
    vistorias, laudos, compromissos, empresa_config, audit_log: [],
  };
}
