import Link from "next/link";
import { site } from "@/lib/site";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white text-sm font-bold">
            Q
          </span>
          <span>{site.name}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
          {site.nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-slate-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={site.wordpressPluginUrl}
            className="hidden sm:inline-flex text-sm text-slate-600 hover:text-slate-900"
          >
            Install Free
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            View pricing
          </Link>
        </div>
      </div>

      <details className="md:hidden border-t border-slate-200">
        <summary className="px-4 py-3 text-sm text-slate-700 cursor-pointer select-none">
          Menu
        </summary>
        <nav className="px-4 pb-4 flex flex-col gap-3 text-sm">
          {site.nav.map((link) => (
            <Link key={link.href} href={link.href} className="text-slate-700">
              {link.label}
            </Link>
          ))}
          <Link href={site.wordpressPluginUrl} className="text-slate-700">
            Install Free
          </Link>
        </nav>
      </details>
    </header>
  );
}
