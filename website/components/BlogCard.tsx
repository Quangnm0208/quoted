import Link from "next/link";
import type { Article } from "@/lib/content";

export function BlogCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group block rounded-lg border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-sm transition"
    >
      <time className="text-xs uppercase tracking-wide text-slate-500" dateTime={article.frontmatter.date}>
        {new Date(article.frontmatter.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </time>
      <h2 className="mt-2 text-lg font-semibold text-slate-900 group-hover:text-brand-700">
        {article.frontmatter.title}
      </h2>
      <p className="mt-2 text-sm text-slate-600 line-clamp-3">
        {article.frontmatter.description}
      </p>
      {article.frontmatter.tags && article.frontmatter.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {article.frontmatter.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
