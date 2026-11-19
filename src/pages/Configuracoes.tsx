import { useEffect, useState } from "react";
import { Lock, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { api } from "@/data/api";
import type { Row } from "@/data/types";
import { useList, useSave } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Layout";
import { Skeleton } from "@/components/ui/Feedback";
import { ErrorState } from "@/components/ui/States";
import { FormGrid, toForm, toPayload, validate, type FieldDef } from "@/components/crud/FormFields";
import { Signature } from "@/components/layout/Signature";

const EMPRESA: FieldDef[] = [
  { name: "razao_social", label: "Razão social", required: true },
  { name: "nome_fantasia", label: "Nome fantasia", required: true },
  { name: "cnpj", label: "CNPJ", type: "doc" },
  { name: "telefone", label: "Telefone", type: "tel" },
  { name: "email", label: "E-mail", type: "email" },
  { name: "endereco", label: "Endereço" },
  { name: "cidade", label: "Cidade" },
  { name: "uf", label: "UF" },
  { name: "rodape_documentos", label: "Rodapé dos PDFs (orçamentos e RDO)", col: 2 },
];
const ASSINATURA: FieldDef[] = [
  { name: "assinatura_visivel", label: "Exibir assinatura EFCsys", type: "switch" },
  { name: "assinatura_texto", label: "Texto da assinatura", required: true, hint: "Padrão: by: efcsys" },
  { name: "assinatura_link", label: "Link", validate: (v) => (v && !/^https:\/\//.test(v) ? "Use um link https://" : null) },
];

export default function Configuracoes() {
  const { role } = useAuth();
  const master = role === "admin_master";
  const qc = useQueryClient();
  const q = useList<Row>("empresa_config", { limit: 1 });
  const row = q.data?.[0];
  const [v, setV] = useState<Row>({});
  const [e, setE] = useState<Record<string, string>>({});
  const [a, setA] = useState<Row>({});
  const [ea, setEa] = useState<Record<string, string>>({});
  useEffect(() => { if (row) { setV(toForm(EMPRESA, row)); setA(toForm(ASSINATURA, row)); } }, [row]);
  const save = useSave((p: Row) => api().update("empresa_config", true as any, p), { invalidate: ["empresa_config"], success: "Configurações salvas.", onDone: () => qc.invalidateQueries({ queryKey: ["empresa_config"] }) });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !row) return <ErrorState error={q.error ?? new Error("Configuração não encontrada.")} onRetry={() => q.refetch()} />;

  return (
    <div className="mx-auto max-w-4xl animate-fade-up space-y-4">
      <PageHeader eyebrow="Administração" title="Configurações" subtitle="Dados da empresa usados nos documentos e no sistema." />
      <Card title="Empresa">
        <form noValidate onSubmit={(ev) => { ev.preventDefault(); const er = validate(EMPRESA, v); setE(er); if (!Object.keys(er).length) save.mutate(toPayload(EMPRESA, v)); }}>
          <FormGrid fields={EMPRESA} values={v} errors={e} onChange={(n, x) => setV((s) => ({ ...s, [n]: x }))} />
          <div className="mt-5 flex justify-end"><Button type="submit" loading={save.isPending} icon={<Save className="h-4 w-4" />}>Salvar</Button></div>
        </form>
      </Card>
      <Card title="Assinatura EFCsys" icon={!master ? <Lock className="h-4 w-4" /> : undefined}>
        {!master ? (
          <p className="text-sm text-muted">A assinatura do sistema é gerenciada exclusivamente pelo Administrador Master. Visualização atual: <Signature className="ml-1 align-middle" /></p>
        ) : (
          <form noValidate onSubmit={(ev) => { ev.preventDefault(); const er = validate(ASSINATURA, a); setEa(er); if (!Object.keys(er).length) save.mutate(toPayload(ASSINATURA, a)); }}>
            <FormGrid fields={ASSINATURA} values={a} errors={ea} onChange={(n, x) => setA((s) => ({ ...s, [n]: x }))} />
            <div className="mt-5 flex items-center justify-between"><span className="text-xs text-muted">Fallback textual: Desenvolvido por EFCsys • Todos os direitos reservados.</span><Button type="submit" loading={save.isPending} icon={<Save className="h-4 w-4" />}>Salvar assinatura</Button></div>
          </form>
        )}
      </Card>
    </div>
  );
}
