import { FaqItem } from "@/components/FaqItem";
import faqData from "@/content/faq.json";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers about Quoted: how it works with Yoast and Rank Math, billing, free plan, multi-site licenses, GDPR, and more.",
  path: "/faq",
});

export default function FaqPage() {
  const items = faqData.items as { question: string; answer: string }[];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
      <header className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
          Frequently asked questions
        </h1>
        <p className="mt-4 text-slate-600">
          Can&apos;t find what you&apos;re looking for?{" "}
          <a href="/support" className="text-brand-700 hover:text-brand-800">
            Get in touch
          </a>
          .
        </p>
      </header>

      <div className="mt-10 space-y-3">
        {items.map((f) => (
          <FaqItem key={f.question} question={f.question} answer={f.answer} />
        ))}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </section>
  );
}
