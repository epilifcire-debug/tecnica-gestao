import { useMemo } from "react";
import type { ListOpts } from "@/data/api";
import type { Row } from "@/data/types";
import { useList } from "@/lib/hooks";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Form";
import { digits, maskCpfCnpj, maskMoneyInput, maskPhone, maskCep, parseMoney, validCnpj, validCpf, validEmail } from "@/lib/format";

export type FieldType = "text" | "email" | "tel" | "doc" | "cep" | "money" | "number" | "date" | "datetime" | "select" | "ref" | "textarea" | "switch";
export interface FieldDef {
  name: string; label: string; type?: FieldType; required?: boolean; placeholder?: string; hint?: string;
  options?: { value: string; label: string }[];
  ref?: { table: string; label?: string; opts?: ListOpts; placeholder?: string };
  col?: 1 | 2; // ocupa 1 ou 2 colunas no grid
  hidden?: (v: Row) => boolean;
  disabled?: (v: Row) => boolean;
  validate?: (value: any, all: Row) => string | null;
  min?: number; max?: number; step?: string;
}

/** Converte valor do banco → valor do formulário */
export function toForm(fields: FieldDef[], row: Row | null | undefined, defaults: Row = {}): Row {
  const out: Row = { ...defaults };
  for (const f of fields) {
    let v = row?.[f.name] ?? defaults[f.name] ?? (f.type === "switch" ? false : "");
    if (f.type === "money" && v !== "" && v != null) v = Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (f.type === "tel" && v) v = maskPhone(String(v));
    if (f.type === "doc" && v) v = maskCpfCnpj(String(v));
    if (f.type === "cep" && v) v = maskCep(String(v));
    if (f.type === "datetime" && v) { const d = new Date(v); v = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    out[f.name] = v;
  }
  return out;
}

/** Converte valor do formulário → payload do banco */
export function toPayload(fields: FieldDef[], v: Row): Row {
  const out: Row = {};
  for (const f of fields) {
    if (f.hidden?.(v)) continue;
    let x = v[f.name];
    if (typeof x === "string") x = x.trim();
    switch (f.type) {
      case "money": x = x === "" ? null : parseMoney(String(x)); break;
      case "number": x = x === "" ? null : Number(String(x).replace(",", ".")); break;
      case "tel": case "doc": case "cep": x = digits(String(x ?? "")) || null; break;
      case "datetime": x = x ? new Date(x).toISOString() : null; break;
      case "switch": x = !!x; break;
      default: if (x === "") x = null;
    }
    out[f.name] = x;
  }
  return out;
}

export function validate(fields: FieldDef[], v: Row): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of fields) {
    if (f.hidden?.(v)) continue;
    const x = v[f.name];
    const empty = x === "" || x == null || (typeof x === "string" && !x.trim());
    if (f.required && empty && f.type !== "switch") { e[f.name] = "Campo obrigatório."; continue; }
    if (empty) continue;
    if (f.type === "email" && !validEmail(String(x))) e[f.name] = "E-mail inválido.";
    if (f.type === "tel" && ![10, 11].includes(digits(String(x)).length)) e[f.name] = "Telefone inválido. Use (99) 99999-9999.";
    if (f.type === "doc") {
      const d = digits(String(x));
      if (d.length === 11 ? !validCpf(d) : d.length === 14 ? !validCnpj(d) : true) e[f.name] = "CPF/CNPJ inválido.";
    }
    if (f.type === "number" || f.type === "money") {
      const n = f.type === "money" ? parseMoney(String(x)) : Number(String(x).replace(",", "."));
      if (isNaN(n)) e[f.name] = "Número inválido.";
      else if (f.min !== undefined && n < f.min) e[f.name] = `Mínimo: ${f.min}.`;
      else if (f.max !== undefined && n > f.max) e[f.name] = `Máximo: ${f.max}.`;
    }
    const c = f.validate?.(x, v);
    if (c) e[f.name] = c;
  }
  return e;
}

function RefSelect({ f, value, onChange, invalid, disabled }: { f: FieldDef; value: string; onChange: (v: string) => void; invalid: boolean; disabled?: boolean }) {
  const r = f.ref!;
  const q = useList(r.table, { order: [{ col: r.label ?? "nome" }], ...r.opts });
  const options = useMemo(() => (q.data ?? []).map((x: Row) => ({ value: x.id, label: x[r.label ?? "nome"] ?? x.id })), [q.data, r.label]);
  return <Select id={f.name} value={value ?? ""} onChange={(e) => onChange(e.target.value)} invalid={invalid} disabled={disabled || q.isLoading}
    options={options} placeholder={q.isLoading ? "Carregando…" : r.placeholder ?? "Selecione…"} />;
}

export function FormGrid({ fields, values, errors, onChange }: { fields: FieldDef[]; values: Row; errors: Record<string, string>; onChange: (name: string, v: any) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.filter((f) => !f.hidden?.(values)).map((f) => {
        const v = values[f.name] ?? "";
        const err = errors[f.name];
        const dis = f.disabled?.(values);
        const common = { id: f.name, invalid: !!err, disabled: dis, placeholder: f.placeholder };
        let input: React.ReactNode;
        switch (f.type) {
          case "textarea": input = <Textarea {...common} value={v} onChange={(e) => onChange(f.name, e.target.value)} />; break;
          case "select": input = <Select {...common} value={v} onChange={(e) => onChange(f.name, e.target.value)} options={f.options ?? []} placeholder={f.required ? undefined : "—"} />; break;
          case "ref": input = <RefSelect f={f} value={v} onChange={(x) => onChange(f.name, x)} invalid={!!err} disabled={dis} />; break;
          case "switch": input = <Switch label={f.label} checked={!!v} onChange={(x) => onChange(f.name, x)} disabled={dis} />; break;
          case "money": input = <Input {...common} inputMode="numeric" value={v} onChange={(e) => onChange(f.name, maskMoneyInput(e.target.value))} placeholder="0,00" />; break;
          case "tel": input = <Input {...common} type="tel" inputMode="tel" autoComplete="tel" value={v} onChange={(e) => onChange(f.name, maskPhone(e.target.value))} placeholder="(99) 99999-9999" />; break;
          case "doc": input = <Input {...common} inputMode="numeric" value={v} onChange={(e) => onChange(f.name, maskCpfCnpj(e.target.value))} placeholder="CPF ou CNPJ" />; break;
          case "cep": input = <Input {...common} inputMode="numeric" value={v} onChange={(e) => onChange(f.name, maskCep(e.target.value))} placeholder="00000-000" />; break;
          case "number": input = <Input {...common} inputMode="decimal" type="number" step={f.step ?? "any"} min={f.min} max={f.max} value={v} onChange={(e) => onChange(f.name, e.target.value)} />; break;
          case "date": input = <Input {...common} type="date" value={v} onChange={(e) => onChange(f.name, e.target.value)} />; break;
          case "datetime": input = <Input {...common} type="datetime-local" value={v} onChange={(e) => onChange(f.name, e.target.value)} />; break;
          case "email": input = <Input {...common} type="email" inputMode="email" autoComplete="email" value={v} onChange={(e) => onChange(f.name, e.target.value)} />; break;
          default: input = <Input {...common} value={v} onChange={(e) => onChange(f.name, e.target.value)} />;
        }
        return (
          <Field key={f.name} label={f.type === "switch" ? undefined : f.label} required={f.required} error={err} hint={f.hint} htmlFor={f.name}
            className={f.col === 2 || f.type === "textarea" || f.type === "switch" ? "sm:col-span-2" : ""}>
            {input}
          </Field>
        );
      })}
    </div>
  );
}
