import Link from "next/link";
import { CtaButton } from "@/components/CtaButton";
import { FeatureCard } from "@/components/FeatureCard";
import { FaqItem } from "@/components/FaqItem";
import { PricingCard, type PricingPlan } from "@/components/PricingCard";
import { Badge } from "@/components/Badge";
import { LogoMark } from "@/components/Logo";
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
    icon: "file",
    title: "AI-friendly site index",
    description:
      "Auto-generates /llms.txt from your published posts and pages — the AI-bot equivalent of sitemap.xml.",
  },
  {
    icon: "code",
    title: "Clean Markdown per post",
    description:
      "Every post is served as clean Markdown. AI parses 10× faster than HTML — no ads, no popups, no scripts.",
  },
  {
    icon: "shield",
    title: "AI crawler control",
    description:
      "Allow or block any of 14+ AI bots with HTTP 403 and robots.txt sync. Block scrapers, keep citers.",
  },
  {
    icon: "sparkle",
    title: "FAQ & Article schema",
    description:
      "JSON-LD output that auto-detects Yoast, Rank Math, AIOSEO, SEOPress — never duplicates schema.",
  },
  {
    icon: "book",
    title: "Documentation publishing",
    description:
      "Publish docs and changelog pages that AI engines and LLM tools can crawl and reference easily.",
  },
  {
    icon: "activity",
    title: "Lightweight integration",
    description:
      "Under 2 ms overhead per pageview. PHP 7.4 / WordPress 6.0 minimum. Works on shared hosting.",
  },
];

const audiences = [
  { title: "Small business owners", description: "Get cited by AI without learning SEO theory." },
  { title: "WordPress agencies", description: "One license covers up to 5 client sites." },
  { title: "SEO freelancers", description: "Ship AI-readiness as a productized service." },
  { title: "Content marketers", description: "See which posts AI bots actually visit." },
  { title: "AI / SEO consultants", description: "Add citation tracking to your audit deliverables." },
];

const workflow = [
  { step: "01", title: "Install the plugin", body: "Search Quoted on WordPress.org. Activate. That's it." },
  { step: "02", title: "It just works", body: "Niche auto-detected, /llms.txt live in 30 seconds, schema enabled." },
  { step: "03", title: "Watch AI bots arrive", body: "Dashboard shows ClaudeBot, GPTBot, PerplexityBot visits within 24h." },
  { step: "04", title: "Upgrade when ready", body: "Add citation tracking and Live AI Test for $19/month." },
];

// Lucide-style stroke icons matching the brand kit
function FeatureIcon({ name }: { name: string }) {
  const p = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "file":
      return <svg {...p}><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></svg>;
    case "code":
      return <svg {...p}><polyline points="9 8 5 12 9 16" /><polyline points="15 8 19 12 15 16" /></svg>;
    case "shield":
      return <svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /></svg>;
    case "sparkle":
      return <svg {...p}><path d="M12 3l1.5 5L18 9.5 13.5 11 12 16l-1.5-5L6 9.5 10.5 8z" /></svg>;
    case "book":
      return <svg {...p}><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5zm2 15h12" /></svg>;
    case "activity":
      return <svg {...p}><polyline points="3 12 7 12 10 5 14 19 17 12 21 12" /></svg>;
    default:
      return null;
  }
}

export default function HomePage() {
  const previewFaqs = (faqData.items as { question: string; answer: string }[]).slice(0, 5);
  const plans = pricingData.plans as PricingPlan[];

  return (
    <>
      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_30rem_at_50%_-10%,rgba(59,63,191,0.10),transparent)]"
        />
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8">
          <Badge tone="info" dot className="mx-auto">
            v0.2.0 live on WordPress.org · Free forever tier
          </Badge>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-ink md:text-5xl lg:text-6xl">
            AI-ready WordPress in <span className="text-brand-500">30 seconds</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">
            Get your content discovered, parsed, and cited by ChatGPT, Claude, Perplexity, and Google AI.
            Auto-generates <code>/llms.txt</code>, serves clean Markdown, controls AI crawlers. No code. Zero-click setup.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <CtaButton href={site.wordpressPluginUrl} variant="primary" size="lg" external>
              Install Free Plugin
            </CtaButton>
            <CtaButton href="/docs" variant="secondary" size="lg">
              View Documentation
            </CtaButton>
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            No account required for the Free tier. No data leaves your server.
          </p>

          {/* Trust strip / proof tiles */}
          <div className="mx-auto mt-14 max-w-4xl">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "30s", v: "Time to first /llms.txt" },
                { k: "14+", v: "AI bots detected" },
                { k: "15", v: "SEO plugins coexist" },
                { k: "0", v: "Required clicks" },
              ].map((s) => (
                <div key={s.v} className="rounded-lg border border-line bg-white px-4 py-3 text-left">
                  <div className="text-2xl font-semibold tracking-tight text-ink">{s.k}</div>
                  <div className="text-xs text-ink-muted">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <Badge tone="muted" className="!px-0">Problem</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink md:text-3xl">
              AI search is here. Your WordPress site is not ready.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              ChatGPT, Claude, Perplexity, and Google AI Overviews already crawl your site —
              but they bounce off ads, popups, JavaScript, and navigation chrome, losing about
              90% of your content in the process.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              SEO plugins were built for Google. AI bots read differently. They need a clean,
              structured signal: <code>/llms.txt</code>, clean Markdown per post, predictable schema, and respect for robots.txt.
              Sites that ship those signals get cited. Sites that don&apos;t, disappear.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-white p-6 shadow-soft">
            <div className="flex items-center gap-2 text-2xs uppercase tracking-wide text-ink-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-danger" />
              Without Quoted
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              <li className="flex gap-2"><span className="text-danger">✗</span><span>AI crawlers parse ads, popups, and nav chrome as content</span></li>
              <li className="flex gap-2"><span className="text-danger">✗</span><span>No /llms.txt — AI tools have no map of your site</span></li>
              <li className="flex gap-2"><span className="text-danger">✗</span><span>Schema conflicts with Yoast / Rank Math break Rich Results</span></li>
              <li className="flex gap-2"><span className="text-danger">✗</span><span>No record of which AI bots visit you, or how often</span></li>
            </ul>

            <div className="my-5 h-px bg-line-soft" />

            <div className="flex items-center gap-2 text-2xs uppercase tracking-wide text-brand-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              With Quoted
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              <li className="flex gap-2"><span className="text-success">✓</span><span>/llms.txt live in 30 seconds, zero config</span></li>
              <li className="flex gap-2"><span className="text-success">✓</span><span>Clean Markdown per post — AI parses 10× faster</span></li>
              <li className="flex gap-2"><span className="text-success">✓</span><span>Schema auto-defers to your existing SEO plugin</span></li>
              <li className="flex gap-2"><span className="text-success">✓</span><span>Dashboard shows real AI bot visits within 24 hours</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <Badge tone="muted" className="!px-0">Features</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Everything an AI-ready WordPress site needs
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              Lightweight, opinionated, and built to coexist with your existing SEO stack.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard
                key={f.title}
                title={f.title}
                description={f.description}
                icon={<FeatureIcon name={f.icon} />}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── AUDIENCE ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <Badge tone="muted" className="!px-0">Who it&apos;s for</Badge>
        <h2 className="mt-3 max-w-xl text-2xl font-bold tracking-tight text-ink md:text-3xl">
          Built for the people running WordPress sites today
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map((a) => (
            <div key={a.title} className="rounded-lg border border-line bg-white p-5">
              <h3 className="text-sm font-semibold text-ink">{a.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{a.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WORKFLOW ────────────────────────────────────────── */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Badge tone="muted" className="!px-0">Workflow</Badge>
          <h2 className="mt-3 max-w-xl text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Four steps. Most are automatic.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {workflow.map((w, i) => (
              <div key={w.step} className="relative rounded-lg border border-line bg-white p-5">
                <div className="text-2xs font-semibold tracking-wider text-brand-500">
                  STEP {w.step}
                </div>
                <h3 className="mt-1 text-base font-semibold text-ink">{w.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{w.body}</p>
                {i < workflow.length - 1 ? (
                  <div className="absolute right-0 top-1/2 hidden h-px w-4 -translate-y-1/2 translate-x-2 bg-line md:block" aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ─────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="muted" className="!px-0">Pricing</Badge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink md:text-3xl">Simple pricing</h2>
          <p className="mt-3 text-sm text-ink-muted">
            Start free. Upgrade when you want citation tracking and Live AI Test.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} cycle="monthly" />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
            Compare plans in detail
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <polyline points="13 6 19 12 13 18" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── FAQ PREVIEW ─────────────────────────────────────── */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge tone="muted" className="!px-0">FAQ</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink md:text-3xl">Common questions</h2>
          </div>
          <div className="mt-8 space-y-3">
            {previewFaqs.map((f) => (
              <FaqItem key={f.question} question={f.question} answer={f.answer} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/faq" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
              See all questions
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl bg-brand-900 p-10 text-center text-white md:p-14">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <LogoMark size={28} onDark />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight md:text-4xl">
            Make your WordPress site AI-readable today
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">
            Free forever for the core features. Pro starts at $19/month — under 1/20 the price of enterprise alternatives.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
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
