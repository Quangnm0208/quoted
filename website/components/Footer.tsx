import Link from "next/link";
import { site } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50 mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white text-sm font-bold">
              Q
            </span>
            <span>{site.name}</span>
          </div>
          <p className="mt-3 text-sm text-slate-600 max-w-xs">
            Make your WordPress site readable by ChatGPT, Claude, Perplexity, and Google AI.
          </p>
        </div>

        {site.footerSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-slate-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
          <p>(c) {year} {site.name}. All rights reserved.</p>
          <p>Billing securely handled by Lemon Squeezy.</p>
        </div>
      </div>
    </footer>
  );
}
