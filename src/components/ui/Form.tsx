import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";

export function Field({ label, error, hint, required, children, htmlFor, className }: {
  label?: string; error?: string | null; hint?: string; required?: boolean; children: ReactNode; htmlFor?: string; className?: string;
}) {
  return (
    <div className={className}>
      {label && <label htmlFor={htmlFor} className="label">{label}{required && <span className="ml-0.5 text-gold" aria-hidden>*</span>}</label>}
      {children}
      {error ? <p role="alert" className="mt-1.5 text-[13px] text-bad">{error}</p> : hint ? <p className="mt-1.5 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...p }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={clsx("input", invalid && "input-error", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, rows = 3, ...p }, ref) {
    return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined}
      className={clsx("input h-auto min-h-[88px] py-2.5 leading-relaxed", invalid && "input-error", className)} {...p} />;
  });

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; options: { value: string; label: string }[]; placeholder?: string }>(
  function Select({ className, invalid, options, placeholder, ...p }, ref) {
    return (
      <select ref={ref} aria-invalid={invalid || undefined} className={clsx("input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", invalid && "input-error", className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238A94A3' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  });

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput({ className, ...p }, ref) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className={clsx("pr-12", className)} aria-describedby={id} {...p} />
      <button type="button" onClick={() => setShow((s) => !s)} id={id}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show}
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink">
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
});

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={clsx("flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-bg/40 px-3.5 py-2.5", disabled && "opacity-60")}>
      <span className="text-sm">{label}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={clsx("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-gold" : "bg-line")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}
