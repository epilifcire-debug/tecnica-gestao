import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline-pearl";
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: "sm" | "md" | "lg" | "icon"; loading?: boolean; icon?: ReactNode;
}
const V: Record<Variant, string> = {
  primary: "bg-[linear-gradient(135deg,#FFFFFF_0%,#EEEAE3_45%,#DCD7CE_70%,#F6F3EE_100%)] text-[#0B0B0D] font-semibold hover:brightness-[1.03] shadow-[0_6px_20px_-10px_rgb(var(--pearl)/0.55)] ring-1 ring-white/40",
  secondary: "bg-surface-2 text-ink border border-line hover:border-pearl/50",
  ghost: "text-ink/80 hover:bg-surface-2 hover:text-ink",
  danger: "bg-bad/90 text-white hover:bg-bad",
  "outline-pearl": "border border-pearl/60 text-pearl-soft hover:bg-pearl/10",
};
const S = { sm: "h-9 px-3 text-sm rounded-lg gap-1.5", md: "h-11 px-4 text-[15px] rounded-xl gap-2", lg: "h-12 px-5 text-base rounded-xl gap-2", icon: "h-10 w-10 rounded-xl" };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={clsx("inline-flex select-none items-center justify-center whitespace-nowrap transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-55", V[variant], S[size], className)}
      {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
