"use client";

import { useState } from "react";
import { PricingCard, type PricingPlan } from "./PricingCard";

export function PricingGrid({ plans }: { plans: PricingPlan[] }) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <>
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Billing cycle"
          className="inline-flex gap-0.5 rounded-md bg-slate-100 p-0.5 text-xs"
        >
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cycle === c}
              onClick={() => setCycle(c)}
              className={`rounded px-3.5 py-1.5 font-medium transition-colors ${
                cycle === c
                  ? "bg-white text-ink shadow-soft"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard key={plan.id} plan={plan} cycle={cycle} />
        ))}
      </div>
    </>
  );
}
