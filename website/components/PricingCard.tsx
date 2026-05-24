import { CtaButton } from "./CtaButton";
import { Badge } from "./Badge";
import { resolveCheckoutUrl } from "@/lib/checkout";

export type PricingPlan = {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  ctaLabel: string;
  ctaHref: string | null;
  checkoutEnv: { monthly: string; yearly: string } | null;
  highlight: boolean;
  badge?: string;
  features: string[];
  limits: string;
};

type Props = {
  plan: PricingPlan;
  cycle: "monthly" | "yearly";
};

export function PricingCard({ plan, cycle }: Props) {
  const price = cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  const period = cycle === "monthly" ? "/ month" : "/ year";

  const resolved = plan.ctaHref ?? resolveCheckoutUrl(plan.checkoutEnv, cycle);
  const disabled = !resolved;
  const label =
    disabled && plan.checkoutEnv ? "Checkout link not configured" : plan.ctaLabel;

  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-white p-6 ${
        plan.highlight
          ? "border-brand-500 shadow-card ring-1 ring-brand-500/15"
          : "border-line"
      }`}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-6">
          <Badge tone="info" dot>{plan.badge}</Badge>
        </span>
      ) : null}

      <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
      <p className="mt-1 text-sm text-ink-muted">{plan.tagline}</p>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight text-ink">
          ${price}
        </span>
        <span className="text-xs text-ink-muted">{period}</span>
      </div>

      <div className="mt-5">
        <CtaButton
          href={resolved}
          variant={plan.highlight ? "primary" : "secondary"}
          disabled={disabled}
          external
          className="w-full"
        >
          {label}
        </CtaButton>
      </div>

      <ul className="mt-6 flex-1 space-y-2 text-sm text-ink">
        {plan.features.map((feat) => (
          <li key={feat} className="flex gap-2">
            <span className="mt-[3px] flex-shrink-0 text-brand-500" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 12 10 17 19 7" />
              </svg>
            </span>
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 border-t border-line-soft pt-4 text-xs text-ink-muted">
        {plan.limits}
      </p>
    </div>
  );
}
