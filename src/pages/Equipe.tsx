import { CrudPage } from "@/components/crud/CrudPage";
import { Badge } from "@/components/ui/Feedback";
import { maskPhone, money, date } from "@/lib/format";

export default function Equipe() {
  return (
    <CrudPage table="funcionarios" singular="Funcionário" title="Equipe" eyebrow="Pessoas" subtitle="Profissionais próprios e terceirizados alocados nas obras."
      searchCols={["nome", "funcao", "telefone"]} order={[{ col: "nome" }]}
      filters={[{ value: "ativos", label: "Ativos", opts: { eq: { ativo: true } } }, { value: "todos", label: "Todos" }]}
      columns={[
        { key: "nome", label: "Nome", mobile: "title", render: (r) => <span className="font-medium">{r.nome}</span> },
        { key: "funcao", label: "Função", mobile: "sub" },
        { key: "telefone", label: "Telefone", mobile: "meta", render: (r) => (r.telefone ? maskPhone(r.telefone) : "—") },
        { key: "diaria", label: "Diária", mobile: "meta", render: (r) => (r.diaria ? money(r.diaria) : "—") },
        { key: "data_admissao", label: "Admissão", mobile: "hide", render: (r) => date(r.data_admissao) },
        { key: "ativo", label: "Status", mobile: "badge", render: (r) => <Badge tone={r.ativo ? "ok" : "muted"}>{r.ativo ? "Ativo" : "Inativo"}</Badge> },
      ]}
      defaults={{ ativo: true, funcao: "Pedreiro" }}
      fields={[
        { name: "nome", label: "Nome completo", required: true, col: 2 },
        { name: "funcao", label: "Função", type: "select", required: true, options: ["Engenheiro Civil", "Arquiteto", "Mestre de obras", "Encarregado", "Pedreiro", "Servente", "Eletricista", "Encanador", "Pintor", "Carpinteiro", "Armador", "Técnico de segurança", "Outro"].map((v) => ({ value: v, label: v })) },
        { name: "cpf", label: "CPF", type: "doc", validate: (v) => (v && String(v).replace(/\D/g, "").length !== 11 ? "Informe um CPF." : null) },
        { name: "telefone", label: "Telefone", type: "tel" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "diaria", label: "Valor da diária (R$)", type: "money" },
        { name: "data_admissao", label: "Admissão", type: "date" },
        { name: "observacoes", label: "Observações", type: "textarea" },
        { name: "ativo", label: "Ativo", type: "switch" },
      ]}
    />
  );
}
