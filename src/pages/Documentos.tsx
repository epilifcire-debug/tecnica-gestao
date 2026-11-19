import { PageHeader } from "@/components/ui/Layout";
import { DocsTab } from "./obra/DocsTab";

export default function Documentos() {
  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Arquivos" title="Documentos" subtitle="Documentos gerais da empresa e de todas as obras que você acessa." />
      <DocsTab obra={null} />
    </div>
  );
}
