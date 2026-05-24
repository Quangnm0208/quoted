import Link from "next/link";
import { site } from "@/lib/site";
import { Logo } from "./Logo";
import { CtaButton } from "./CtaButton";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label={`${site.name} home`}>
          <Logo size={26} />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-ink-muted md:flex">
          {site.nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={site.wordpressPluginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Install Free
          </Link>
          <CtaButton href="/pricing" variant="primary" size="md">
            View pricing
          </CtaButton>
        </div>
      </div>

      <details className="border-t border-line md:hidden">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm text-ink">
          Menu
        </summary>
        <nav className="flex flex-col gap-3 px-4 pb-4 text-sm">
          {site.nav.map((link) => (
            <Link key={link.href} href={link.href} className="text-ink">
              {link.label}
            </Link>
          ))}
          <Link href={site.wordpressPluginUrl} className="text-ink" target="_blank" rel="noopener noreferrer">
            Install Free
          </Link>
        </nav>
      </details>
    </header>
  );
}
