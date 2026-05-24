import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "soft";
type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 border border-brand-500 hover:border-brand-600",
  secondary:
    "bg-white text-ink border border-line hover:bg-surface-bg",
  ghost:
    "bg-transparent text-ink-muted hover:text-ink hover:bg-black/[0.04] border border-transparent",
  soft:
    "bg-brand-50 text-brand-900 hover:bg-brand-100 border border-transparent",
};

type Props = {
  href?: string | null;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  external?: boolean;
  className?: string;
  icon?: ReactNode;
};

export function CtaButton({
  href,
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  external = false,
  className = "",
  icon,
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium leading-none rounded-md transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

  const inner = (
    <>
      {icon}
      {children}
    </>
  );

  if (disabled || !href) {
    return (
      <span
        aria-disabled="true"
        className={`${base} ${sizes[size]} bg-slate-100 text-slate-400 border border-line cursor-not-allowed ${className}`}
      >
        {inner}
      </span>
    );
  }

  if (external || href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {inner}
    </Link>
  );
}
