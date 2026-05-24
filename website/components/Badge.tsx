import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "muted";

const tones: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  success: { wrap: "bg-success-bg text-success-fg", dot: "bg-success" },
  warning: { wrap: "bg-warning-bg text-warning-fg", dot: "bg-warning" },
  danger: { wrap: "bg-danger-bg text-danger-fg", dot: "bg-danger" },
  info: { wrap: "bg-brand-50 text-brand-900", dot: "bg-brand-500" },
  muted: { wrap: "bg-transparent text-ink-muted", dot: "bg-slate-400" },
};

type Props = { tone?: Tone; dot?: boolean; children: ReactNode; className?: string };

export function Badge({ tone = "neutral", dot, children, className = "" }: Props) {
  const t = tones[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium leading-5 ${t.wrap} ${className}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
