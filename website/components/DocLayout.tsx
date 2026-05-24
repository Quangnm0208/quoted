import Link from "next/link";
import type { ReactNode } from "react";
import { getAllDocs } from "@/lib/content";

export function DocLayout({ slug, children }: { slug: string; children: ReactNode }) {
  const docs = getAllDocs();
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[230px_1fr] lg:px-8">
      <aside className="md:sticky md:top-20 md:self-start">
        <nav className="space-y-0.5 text-sm">
          {docs.map((d) => (
            <Link
              key={d.slug}
              href={`/docs/${d.slug}`}
              className={`block rounded-md px-3 py-2 transition-colors ${
                d.slug === slug
                  ? "bg-brand-50 font-semibold text-brand-900"
                  : "text-ink-muted hover:bg-slate-50 hover:text-ink"
              }`}
            >
              {d.frontmatter.title}
            </Link>
          ))}
        </nav>
      </aside>
      <article className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h3:text-lg prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-code:text-ink prose-code:before:content-none prose-code:after:content-none">
        {children}
      </article>
    </div>
  );
}
