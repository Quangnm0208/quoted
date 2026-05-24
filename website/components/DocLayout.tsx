import Link from "next/link";
import type { ReactNode } from "react";
import { getAllDocs } from "@/lib/content";

export function DocLayout({ slug, children }: { slug: string; children: ReactNode }) {
  const docs = getAllDocs();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 grid md:grid-cols-[220px_1fr] gap-10">
      <aside className="md:sticky md:top-20 md:self-start">
        <nav className="space-y-1 text-sm">
          {docs.map((d) => (
            <Link
              key={d.slug}
              href={`/docs/${d.slug}`}
              className={`block rounded-md px-3 py-2 ${
                d.slug === slug
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {d.frontmatter.title}
            </Link>
          ))}
        </nav>
      </aside>
      <article className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-a:text-brand-700 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none">
        {children}
      </article>
    </div>
  );
}
