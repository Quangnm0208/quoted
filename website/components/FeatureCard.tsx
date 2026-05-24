import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export function FeatureCard({ title, description, icon }: Props) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 transition-colors hover:border-brand-200">
      {icon ? (
        <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
          {icon}
        </div>
      ) : (
        <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 12 10 17 19 7" />
          </svg>
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}
