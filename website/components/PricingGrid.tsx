"use client";

import { useState } from "react";
import { PricingCard, type PricingPlan } from "./PricingCard";

export function PricingGrid({ plans }: { plans: PricingPlan[] }) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <>
      <div className="flex justify-center">
        <div role="tablist" aria-label="Billing cycle" className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              role="tab"
              type="button"
              aria-selected={cycle === c}
              onClick={() => setCycle(c)}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                cycle === c
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid md:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <PricingCard key={plan.id} plan={plan} cycle={cycle} />
        ))}
      </div>
    </>
  );
}
