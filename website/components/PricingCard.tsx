import { CtaButton } from "./CtaButton";
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
  const period = cycle === "monthly" ? "/month" : "/year";

  const resolved = plan.ctaHref ?? resolveCheckoutUrl(plan.checkoutEnv, cycle);
  const disabled = !resolved;
  const label = disabled && plan.checkoutEnv ? "Checkout link not configured" : plan.ctaLabel;

  return (
    <div
      className={`relative rounded-xl border bg-white p-6 flex flex-col ${
        plan.highlight
          ? "border-brand-600 ring-2 ring-brand-600/20 shadow-sm"
          : "border-slate-200"
      }`}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white">
          {plan.badge}
        </span>
      ) : null}

      <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-slate-900">
          ${price}
        </span>
        <span className="text-sm text-slate-500">{period}</span>
      </div>

      <div className="mt-6">
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

      <ul className="mt-6 space-y-2.5 text-sm text-slate-700 flex-1">
        {plan.features.map((feat) => (
          <li key={feat} className="flex gap-2">
            <span className="mt-0.5 text-brand-600" aria-hidden="true">
              ✓
            </span>
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
        {plan.limits}
      </p>
    </div>
  );
}
