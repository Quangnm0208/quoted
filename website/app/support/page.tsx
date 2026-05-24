import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { site, supportEmail } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Support",
  description: `Get help with ${site.name}. Email support, documentation, billing questions, and bug reports.`,
  path: "/support",
});

const channels = [
  {
    title: "Read the docs",
    body: "Installation, configuration, FAQ Setup, SEO Content Workflow, and troubleshooting.",
    cta: { label: "View documentation", href: "/docs" },
  },
  {
    title: "Email support",
    body: "Pro and Starter customers get a reply within one business day. Free users get a best-effort reply.",
    cta: { label: `Email ${supportEmail}`, href: `mailto:${supportEmail}` },
  },
  {
    title: "Billing & licenses",
    body: "Manage your subscription, update payment method, or download invoices via Lemon Squeezy.",
    cta: { label: "Lemon Squeezy customer portal", href: "https://app.lemonsqueezy.com/my-orders" },
  },
  {
    title: "Report a bug",
    body: "Found something broken? File an issue on GitHub with steps to reproduce, your WordPress + PHP version, and a screenshot if relevant.",
    cta: { label: "Open GitHub issues", href: `${site.githubUrl}/issues` },
  },
];

export default function SupportPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">
          Support
        </h1>
        <p className="mt-4 text-sm text-ink-muted">
          Four ways to get help. Pick whichever fits the question.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {channels.map((c) => (
          <div key={c.title} className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-base font-semibold text-ink">{c.title}</h2>
            <p className="mt-2 text-sm text-ink-muted">{c.body}</p>
            {c.cta.href.startsWith("http") || c.cta.href.startsWith("mailto:") ? (
              <a
                href={c.cta.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                {c.cta.label} →
              </a>
            ) : (
              <Link
                href={c.cta.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                {c.cta.label} →
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-ink-muted">
        For security reports, please email <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> directly. Do not file public issues for security vulnerabilities.
      </p>
    </section>
  );
}
