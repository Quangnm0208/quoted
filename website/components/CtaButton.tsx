import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600",
  secondary:
    "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 focus-visible:ring-brand-600",
  ghost: "bg-transparent text-slate-700 hover:text-slate-900",
};

type Props = {
  href?: string | null;
  children: ReactNode;
  variant?: Variant;
  disabled?: boolean;
  external?: boolean;
  className?: string;
  size?: "md" | "lg";
};

export function CtaButton({
  href,
  children,
  variant = "primary",
  disabled = false,
  external = false,
  className = "",
  size = "md",
}: Props) {
  const sizeCls = size === "lg" ? "px-5 py-3 text-base" : "px-4 py-2.5 text-sm";
  const base = `inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sizeCls}`;

  if (disabled || !href) {
    return (
      <span
        className={`${base} bg-slate-100 text-slate-400 cursor-not-allowed ${className}`}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  if (external || href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} ${variants[variant]} ${className}`}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
