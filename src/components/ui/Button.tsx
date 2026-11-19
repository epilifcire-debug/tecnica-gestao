import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline-gold";
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: "sm" | "md" | "lg" | "icon"; loading?: boolean; icon?: ReactNode;
}
const V: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-gold-soft to-gold text-[#1a1406] font-semibold hover:brightness-105 shadow-[0_6px_20px_-8px_rgb(var(--gold)/0.7)]",
  secondary: "bg-surface-2 text-ink border border-line hover:border-gold/50",
  ghost: "text-ink/80 hover:bg-surface-2 hover:text-ink",
  danger: "bg-bad/90 text-white hover:bg-bad",
  "outline-gold": "border border-gold/60 text-gold-soft hover:bg-gold/10",
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
