import { MessageCircle } from "lucide-react";
import { CrudPage, MenuItem } from "@/components/crud/CrudPage";
import { Badge } from "@/components/ui/Feedback";
import { digits, maskCpfCnpj, maskPhone } from "@/lib/format";

export default function Fornecedores() {
  return (
    <CrudPage table="fornecedores" singular="Fornecedor" title="Fornecedores" eyebrow="Cadastros" subtitle="Lojas, prestadores e locadoras."
      searchCols={["nome", "categoria", "contato", "documento"]} order={[{ col: "nome" }]}
      columns={[
        { key: "nome", label: "Fornecedor", mobile: "title", render: (r) => <span className="font-medium">{r.nome}</span> },
        { key: "categoria", label: "Categoria", mobile: "sub" },
        { key: "contato", label: "Contato", mobile: "meta" },
        { key: "telefone", label: "Telefone", mobile: "meta", render: (r) => (r.telefone ? maskPhone(r.telefone) : "—") },
        { key: "documento", label: "CNPJ/CPF", mobile: "hide", render: (r) => (r.documento ? maskCpfCnpj(r.documento) : "—") },
        { key: "ativo", label: "Status", mobile: "badge", render: (r) => <Badge tone={r.ativo ? "ok" : "muted"}>{r.ativo ? "Ativo" : "Inativo"}</Badge> },
      ]}
      defaults={{ ativo: true }}
      fields={[
        { name: "nome", label: "Nome", required: true, col: 2 },
        { name: "documento", label: "CNPJ / CPF", type: "doc" },
        { name: "categoria", label: "Categoria", placeholder: "Cimento, Elétrica, Locação…" },
        { name: "contato", label: "Pessoa de contato" },
        { name: "telefone", label: "Telefone", type: "tel" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "endereco", label: "Endereço" },
        { name: "observacoes", label: "Observações", type: "textarea" },
        { name: "ativo", label: "Fornecedor ativo", type: "switch" },
      ]}
      extraActions={(r) => r.telefone ? <MenuItem icon={<MessageCircle className="h-4 w-4" />} onClick={() => window.open(`https://wa.me/55${digits(r.telefone)}`, "_blank", "noopener")}>WhatsApp</MenuItem> : null}
    />
  );
}
