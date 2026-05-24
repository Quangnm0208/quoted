import Link from "next/link";
import { CtaButton } from "@/components/CtaButton";
import { FeatureCard } from "@/components/FeatureCard";
import { FaqItem } from "@/components/FaqItem";
import { PricingCard, type PricingPlan } from "@/components/PricingCard";
import faqData from "@/content/faq.json";
import pricingData from "@/content/pricing.json";
import { site } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
  path: "/",
});

const features = [
  {
    title: "AI-friendly site index",
    description:
      "Auto-generates `/llms.txt` from your published posts and pages, the AI-bot equivalent of sitemap.xml.",
  },
  {
    title: "Clean Markdown per post",
    description:
      "Every post is served as clean Markdown at `/wp-json/quoted/v1/llm/{slug}`. AI parses 10× faster than HTML.",
  },
  {
    title: "AI crawler control",
    description:
      "Allow or block any of 14+ AI bots (ClaudeBot, GPTBot, PerplexityBot, ...) with HTTP 403 and robots.txt sync.",
  },
  {
    title: "FAQ and Article schema",
    description:
      "JSON-LD output that auto-detects Yoast, Rank Math, AIOSEO, SEOPress — never duplicates schema.",
  },
  {
    title: "Documentation publishing",
    description:
      "Publish docs and changelog pages that AI engines and LLM tools can crawl and reference easily.",
  },
  {
    title: "Lightweight WordPress integration",
    description:
      "Under 2 ms overhead per pageview. Works on shared hosting. PHP 7.4 / WordPress 6.0 minimum.",
  },
];

const audiences = [
  {
    title: "Small business owners",
    description: "Get cited by AI without learning SEO theory.",
  },
  {
    title: "WordPress agencies",
    description: "One license covers up to 5 client sites.",
  },
  {
    title: "SEO freelancers",
    description: "Ship AI-readiness as a productized service.",
  },
  {
    title: "Content marketers",
    description: "See which posts AI bots actually visit.",
  },
  {
    title: "AI / SEO consultants",
    description: "Add citation tracking to your audit deliverables.",
  },
];

const workflow = [
  { step: "1", title: "Install the plugin", body: "Search 'Quoted' on WordPress.org. Activate." },
  { step: "2", title: "Done — it just works", body: "Niche auto-detected, /llms.txt live in 30 seconds, schema enabled." },
  { step: "3", title: "Watch AI bots arrive", body: "Dashboard shows ClaudeBot, GPTBot, PerplexityBot visits within 24h." },
  { step: "4", title: "Upgrade when ready", body: "Add citation tracking and Live AI Test for $19 / month." },
];

export default function HomePage() {
  const previewFaqs = (faqData.items as { question: string; answer: string }[]).slice(0, 5);
  const plans = pricingData.plans as PricingPlan[];

  return (
    <>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
            Now serving WordPress 6.0+ — Free forever tier
          </span>
          <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight text-slate-900">
            AI-ready WordPress in <span className="text-brand-600">30 seconds</span>
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg text-slate-600">
            Get your content discovered, parsed, and cited by ChatGPT, Claude, Perplexity, and Google AI.
            Auto-generates <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">/llms.txt</code>,
            serves clean Markdown, controls AI crawlers. No code. Zero-click setup.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <CtaButton href={site.wordpressPluginUrl} variant="primary" size="lg" external>
              Install Free Plugin
            </CtaButton>
            <CtaButton href="/docs" variant="secondary" size="lg">
              View Documentation
            </CtaButton>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            No account required for the Free tier. No data leaves your server.
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              AI search is here. Your WordPress site is not ready.
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              ChatGPT, Claude, Perplexity, and Google AI Overviews already crawl your site —
              but they bounce off ads, popups, JavaScript, and navigation chrome, losing about
              90% of your content in the process.
            </p>
            <p className="mt-4 text-slate-600 leading-relaxed">
              SEO plugins were built for Google. AI bots read differently. They need a clean,
              structured signal: <code className="bg-slate-100 px-1 rounded text-sm">/llms.txt</code>,
              clean Markdown per post, predictable schema, and respect for robots.txt.
              Sites that ship those signals get cited. Sites that don&apos;t, disappear.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Without Quoted</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>✗ AI crawlers parse ads, popups, and nav chrome as content</li>
              <li>✗ No /llms.txt — AI tools have no map of your site</li>
              <li>✗ Schema conflicts with Yoast / Rank Math break Rich Results</li>
              <li>✗ No record of which AI bots visit you, or how often</li>
              <li>✗ Bytespider scrapes you for training without permission</li>
            </ul>
            <p className="mt-6 text-xs uppercase tracking-wide text-brand-700">With Quoted</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>✓ /llms.txt live in 30 seconds, zero config</li>
              <li>✓ Clean Markdown per post — AI parses 10× faster</li>
              <li>✓ Schema auto-defers to your existing SEO plugin</li>
              <li>✓ Per-bot allowlist — block scrapers, allow citers</li>
              <li>✓ Dashboard shows real AI bot visits within 24 hours</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Everything an AI-ready WordPress site needs
            </h2>
            <p className="mt-3 text-slate-600">
              Lightweight, opinionated, and built to coexist with your existing SEO stack.
            </p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <FeatureCard key={f.title} title={f.title} description={f.description} />
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 max-w-xl">
          Built for the people running WordPress sites today
        </h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {audiences.map((a) => (
            <div key={a.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">{a.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{a.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 max-w-xl">
            Four steps. Most are automatic.
          </h2>
          <div className="mt-10 grid md:grid-cols-4 gap-4">
            {workflow.map((w) => (
              <div key={w.step} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-semibold">
                  {w.step}
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{w.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Simple pricing</h2>
          <p className="mt-3 text-slate-600">
            Start free. Upgrade when you want citation tracking and Live AI Test.
          </p>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} cycle="monthly" />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/pricing" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Compare plans in detail →
          </Link>
        </div>
      </section>

      {/* FAQ preview */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 text-center">
            Common questions
          </h2>
          <div className="mt-8 space-y-3">
            {previewFaqs.map((f) => (
              <FaqItem key={f.question} question={f.question} answer={f.answer} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/faq" className="text-sm font-medium text-brand-700 hover:text-brand-800">
              See all questions →
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="rounded-2xl bg-slate-900 text-white p-10 md:p-14 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Make your WordPress site AI-readable today
          </h2>
          <p className="mt-4 text-slate-300 max-w-xl mx-auto">
            Free forever for the core features. Pro starts at $19/month — under 1/20 the price of enterprise alternatives.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
            <CtaButton href={site.wordpressPluginUrl} variant="primary" size="lg" external>
              Install Free Plugin
            </CtaButton>
            <CtaButton href="/pricing" variant="secondary" size="lg">
              See Pricing
            </CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
