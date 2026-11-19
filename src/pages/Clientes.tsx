import { Building2, MessageCircle } from "lucide-react";
import { CrudPage, MenuItem } from "@/components/crud/CrudPage";
import { Badge } from "@/components/ui/Feedback";
import { maskCpfCnpj, maskPhone, digits } from "@/lib/format";
import { useNavigate } from "react-router-dom";

export default function Clientes() {
  const nav = useNavigate();
  return (
    <CrudPage table="clientes" singular="Cliente" title="Clientes" eyebrow="Cadastros" subtitle="Pessoas e empresas atendidas pela Técnica Engenharia."
      searchCols={["nome", "email", "documento", "telefone"]} order={[{ col: "nome" }]}
      filters={[{ value: "ativos", label: "Ativos", opts: { eq: { ativo: true } } }, { value: "todos", label: "Todos" }, { value: "inativos", label: "Inativos", opts: { eq: { ativo: false } } }]}
      columns={[
        { key: "nome", label: "Nome", mobile: "title", render: (r) => <span className="font-medium">{r.nome}</span> },
        { key: "documento", label: "CPF/CNPJ", mobile: "sub", render: (r) => (r.documento ? maskCpfCnpj(r.documento) : "—") },
        { key: "telefone", label: "Telefone", mobile: "meta", render: (r) => (r.telefone ? maskPhone(r.telefone) : "—") },
        { key: "email", label: "E-mail", mobile: "meta" },
        { key: "cidade", label: "Cidade", mobile: "hide", render: (r) => [r.cidade, r.uf].filter(Boolean).join("/") || "—" },
        { key: "ativo", label: "Status", mobile: "badge", render: (r) => <Badge tone={r.ativo ? "ok" : "muted"}>{r.ativo ? "Ativo" : "Inativo"}</Badge> },
      ]}
      defaults={{ tipo_pessoa: "PF", ativo: true, cidade: "Aracaju", uf: "SE" }}
      fields={[
        { name: "tipo_pessoa", label: "Tipo", type: "select", required: true, options: [{ value: "PF", label: "Pessoa física" }, { value: "PJ", label: "Pessoa jurídica" }] },
        { name: "documento", label: "CPF / CNPJ", type: "doc", validate: (v, a) => { const n = digits(String(v)).length; return a.tipo_pessoa === "PF" && n !== 11 ? "Informe um CPF." : a.tipo_pessoa === "PJ" && n !== 14 ? "Informe um CNPJ." : null; } },
        { name: "nome", label: "Nome / Razão social", required: true, col: 2 },
        { name: "email", label: "E-mail", type: "email" },
        { name: "telefone", label: "Telefone / WhatsApp", type: "tel" },
        { name: "endereco", label: "Endereço", col: 2 },
        { name: "cidade", label: "Cidade" },
        { name: "uf", label: "UF" },
        { name: "observacoes", label: "Observações", type: "textarea" },
        { name: "ativo", label: "Cliente ativo", type: "switch" },
      ]}
      deleteText={(r) => <>Excluir <strong>{r.nome}</strong>? Clientes com obras, orçamentos ou contratos não podem ser excluídos — prefira desativar.</>}
      extraActions={(r) => <>
        {r.telefone && <MenuItem icon={<MessageCircle className="h-4 w-4" />} onClick={() => window.open(`https://wa.me/55${digits(r.telefone)}`, "_blank", "noopener")}>WhatsApp</MenuItem>}
        <MenuItem icon={<Building2 className="h-4 w-4" />} onClick={() => nav(`/obras?cliente=${r.id}`)}>Ver obras</MenuItem>
      </>}
    />
  );
}
