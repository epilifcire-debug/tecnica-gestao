import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, type ListOpts } from "@/data/api";
import type { Row } from "@/data/types";
import { useDebounced, useList, useSave } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Modal, useConfirm } from "@/components/ui/Modal";
import { PageHeader, Tabs } from "@/components/ui/Layout";
import { EmptyState, QueryView } from "@/components/ui/States";
import { FormGrid, toForm, toPayload, validate, type FieldDef } from "./FormFields";

export interface Column {
  key: string; label: string; render?: (r: Row) => ReactNode; className?: string;
  /** como aparece no card mobile */
  mobile?: "title" | "sub" | "meta" | "badge" | "hide";
}
export interface FilterTab { value: string; label: string; opts?: ListOpts }

export interface CrudConfig {
  table: string; singular: string; title: string; eyebrow?: string; subtitle?: string;
  embed?: string[]; columns: Column[]; fields: FieldDef[]; defaults?: Row | (() => Row);
  searchCols?: string[]; order?: ListOpts["order"]; filters?: FilterTab[]; baseOpts?: ListOpts;
  canCreate?: boolean; canEdit?: (r: Row) => boolean; canDelete?: (r: Row) => boolean;
  deleteText?: (r: Row) => ReactNode;
  beforeSave?: (payload: Row, isNew: boolean, form: Row) => Row;
  extraActions?: (r: Row) => ReactNode;
  headerActions?: ReactNode;
  onRowClick?: (r: Row) => void;
  emptyText?: string;
  hideHeader?: boolean;
}

export function CrudPage(c: CrudConfig) {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(c.filters?.[0]?.value ?? "");
  const [term, setTerm] = useState("");
  const t = useDebounced(term);
  const [editing, setEditing] = useState<Row | null>(null); // {} = novo
  const confirm = useConfirm();

  const filter = c.filters?.find((f) => f.value === tab)?.opts ?? {};
  const opts: ListOpts = useMemo(() => ({
    ...c.baseOpts, ...filter,
    eq: { ...c.baseOpts?.eq, ...filter.eq }, embed: c.embed, order: c.order,
    search: c.searchCols && t ? { cols: c.searchCols, term: t } : undefined,
  }), [c.baseOpts, filter, c.embed, c.order, c.searchCols, t]);
  const q = useList(c.table, opts);

  // atalhos ?novo=1 e ?ver=<id>
  useEffect(() => {
    if (params.get("novo") && c.canCreate !== false) { setEditing({}); params.delete("novo"); setParams(params, { replace: true }); }
  }, [params, setParams, c.canCreate]);
  useEffect(() => {
    const id = params.get("ver");
    if (id && q.data) {
      const r = q.data.find((x: Row) => x.id === id);
      if (r) { if (c.onRowClick) c.onRowClick(r); else setEditing(r); }
      params.delete("ver"); setParams(params, { replace: true });
    }
  }, [params, setParams, q.data, c]);

  const del = useSave((id: string) => api().remove(c.table, id), { invalidate: [c.table], success: `${c.singular} excluído(a).` });
  const onDelete = async (r: Row) => {
    const ok = await confirm({ title: `Excluir ${c.singular.toLowerCase()}?`, text: c.deleteText?.(r) ?? "Esta ação não pode ser desfeita.", confirm: "Excluir", danger: true });
    if (ok) del.mutate(r.id);
  };

  const edit = (r: Row) => (c.canEdit?.(r) ?? true ? setEditing(r) : c.onRowClick?.(r));
  const rowClick = (r: Row) => (c.onRowClick ? c.onRowClick(r) : edit(r));
  const titleCol = c.columns.find((x) => x.mobile === "title") ?? c.columns[0];

  return (
    <div className="animate-fade-up">
      {!c.hideHeader && (
        <PageHeader eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle}
          actions={<>{c.headerActions}{c.canCreate !== false && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>Novo(a) {c.singular.toLowerCase()}</Button>}</>} />
      )}
      {c.hideHeader && c.canCreate !== false && (
        <div className="mb-3 flex justify-end"><Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>Adicionar</Button></div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {c.filters && <Tabs value={tab} onChange={setTab} items={c.filters} />}
        {c.searchCols && (
          <div className="relative md:ml-auto md:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input h-10 pl-10" placeholder="Buscar…" value={term} onChange={(e) => setTerm(e.target.value)} aria-label={`Buscar ${c.title.toLowerCase()}`} />
          </div>
        )}
      </div>

      <QueryView q={q} empty={<EmptyState title={t ? "Nenhum resultado para a busca." : c.emptyText ?? `Nenhum(a) ${c.singular.toLowerCase()} cadastrado(a).`}
        action={!t && c.canCreate !== false ? <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>Cadastrar</Button> : undefined} />}>
        {(rows: Row[]) => (
          <>
            {/* desktop: tabela */}
            <div className="card hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line/70 bg-surface-2/40">
                    <tr>{c.columns.map((col) => <th key={col.key} className={clsx("table-head px-4 py-3", col.className)}>{col.label}</th>)}<th className="w-24" /></tr>
                  </thead>
                  <tbody className="divide-y divide-line/50">
                    {rows.map((r) => (
                      <tr key={r.id ?? JSON.stringify(r)} className="cursor-pointer transition hover:bg-surface-2/50" onClick={() => rowClick(r)}>
                        {c.columns.map((col) => <td key={col.key} className={clsx("px-4 py-3 align-middle", col.className)}>{col.render ? col.render(r) : r[col.key] ?? "—"}</td>)}
                        <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <RowActions r={r} c={c} onEdit={() => setEditing(r)} onDelete={() => onDelete(r)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* mobile: cards */}
            <ul className="space-y-2.5 md:hidden">
              {rows.map((r) => (
                <li key={r.id ?? JSON.stringify(r)} className="card flex items-start gap-3 p-3.5 active:bg-surface-2" onClick={() => rowClick(r)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{titleCol.render ? titleCol.render(r) : r[titleCol.key]}</p>
                      {c.columns.filter((x) => x.mobile === "badge").map((x) => <span key={x.key} className="shrink-0">{x.render ? x.render(r) : r[x.key]}</span>)}
                    </div>
                    {c.columns.filter((x) => x.mobile === "sub").map((x) => <div key={x.key} className="mt-0.5 truncate text-[13px] text-muted">{x.render ? x.render(r) : r[x.key]}</div>)}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink/75">
                      {c.columns.filter((x) => x.mobile === "meta").map((x) => <span key={x.key}><span className="text-muted">{x.label}: </span>{x.render ? x.render(r) : r[x.key] ?? "—"}</span>)}
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}><RowActions r={r} c={c} onEdit={() => setEditing(r)} onDelete={() => onDelete(r)} /></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </QueryView>

      <CrudForm c={c} row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function RowActions({ r, c, onEdit, onDelete }: { r: Row; c: CrudConfig; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const canE = c.canEdit?.(r) ?? true;
  const canD = c.canDelete?.(r) ?? true;
  if (!canE && !canD && !c.extraActions) return null;
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Ações" aria-haspopup="menu"><MoreVertical className="h-4 w-4" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-surface text-left shadow-2xl" onClick={() => setOpen(false)}>
            {c.extraActions?.(r)}
            {canE && <button role="menuitem" onClick={onEdit} className="flex h-10 w-full items-center gap-2 px-3.5 text-sm hover:bg-surface-2"><Pencil className="h-4 w-4" />Editar</button>}
            {canD && <button role="menuitem" onClick={onDelete} className="flex h-10 w-full items-center gap-2 px-3.5 text-sm text-red-300 hover:bg-surface-2"><Trash2 className="h-4 w-4" />Excluir</button>}
          </div>
        </>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return <button role="menuitem" onClick={onClick} className="flex h-10 w-full items-center gap-2 px-3.5 text-sm hover:bg-surface-2">{icon}{children}</button>;
}

export function CrudForm({ c, row, onClose }: { c: CrudConfig; row: Row | null; onClose: () => void }) {
  const isNew = !!row && !row.id;
  const defaults = typeof c.defaults === "function" ? c.defaults() : c.defaults ?? {};
  const [v, setV] = useState<Row>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (row) { setV(toForm(c.fields, row, isNew ? defaults : {})); setErrors({}); } }, [row]); // eslint-disable-line

  const save = useSave(async (payload: Row) => (isNew ? api().insert(c.table, payload) : api().update(c.table, row!.id, payload)), {
    invalidate: [c.table], success: isNew ? `${c.singular} cadastrado(a) com sucesso.` : "Alterações salvas.", onDone: onClose,
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    const er = validate(c.fields, v);
    setErrors(er);
    if (Object.keys(er).length) return;
    let p = toPayload(c.fields, v);
    if (c.beforeSave) p = c.beforeSave(p, isNew, v);
    save.mutate(p);
  };
  return (
    <Modal open={!!row} onClose={onClose} busy={save.isPending} title={isNew ? `Novo(a) ${c.singular.toLowerCase()}` : `Editar ${c.singular.toLowerCase()}`} size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
        <Button type="submit" form={`f-${c.table}`} loading={save.isPending}>{isNew ? "Cadastrar" : "Salvar"}</Button>
      </>}>
      <form id={`f-${c.table}`} onSubmit={submit} noValidate>
        <FormGrid fields={c.fields} values={v} errors={errors} onChange={(n, x) => { setV((s) => ({ ...s, [n]: x })); setErrors((e) => ({ ...e, [n]: "" })); }} />
      </form>
    </Modal>
  );
}
