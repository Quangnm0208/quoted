import Link from "next/link";
import { site } from "@/lib/site";
import { Logo } from "./Logo";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <Logo size={26} />
          <p className="mt-3 max-w-xs text-sm text-ink-muted">
            The AI-readable SEO layer for WordPress.
          </p>
        </div>

        {site.footerSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {section.title}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink-muted hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-muted sm:flex-row sm:px-6 lg:px-8">
          <p>&copy; {year} {site.name}. All rights reserved.</p>
          <p>Billing securely handled by Lemon Squeezy.</p>
        </div>
      </div>
    </footer>
  );
}
