import { PricingGrid } from "@/components/PricingGrid";
import { FaqItem } from "@/components/FaqItem";
import { buildMetadata } from "@/lib/seo";
import pricingData from "@/content/pricing.json";
import faqData from "@/content/faq.json";
import { site, siteUrl } from "@/lib/site";
import type { PricingPlan } from "@/components/PricingCard";

export const metadata = buildMetadata({
  title: "Pricing — Free, Starter, and Pro",
  description:
    "Simple pricing for Quoted. Start free with /llms.txt and 14 AI bot detection. Upgrade to Starter ($19/mo) or Pro ($29/mo) for citation tracking and Live AI Test.",
  path: "/pricing",
});

const billingFaqs = (faqData.items as { question: string; answer: string }[]).filter((f) =>
  ["billing", "cancel", "free plan", "agencies", "license"].some((kw) =>
    f.question.toLowerCase().includes(kw)
  )
);

export default function PricingPage() {
  const plans = pricingData.plans as PricingPlan[];

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.name} WordPress Plugin`,
    description: site.description,
    brand: { "@type": "Brand", name: site.name },
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.monthlyPrice,
      priceCurrency: pricingData.currency,
      url: `${siteUrl}/pricing`,
      availability: "https://schema.org/InStock",
    })),
  };

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">
            Pricing
          </h1>
          <p className="mt-4 text-sm text-ink-muted md:text-base">
            Free forever for the core features. Pro adds citation tracking and Live AI Test for a fraction of the price of enterprise tools.
          </p>
          <p className="mt-2 text-xs text-ink-muted">{pricingData.yearlyDiscountNote}</p>
        </div>

        <div className="mt-10">
          <PricingGrid plans={plans} />
        </div>

        <p className="mt-8 text-center text-sm text-ink-muted">
          {pricingData.compareNote}
        </p>
        <p className="mt-2 text-center text-xs text-ink-muted">
          Billing is securely handled by Lemon Squeezy. VAT/sales tax is calculated automatically for your region.
        </p>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center text-xl font-bold tracking-tight text-ink md:text-2xl">
            Billing questions
          </h2>
          <div className="mt-6 space-y-3">
            {billingFaqs.map((f) => (
              <FaqItem key={f.question} question={f.question} answer={f.answer} />
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
    </>
  );
}
