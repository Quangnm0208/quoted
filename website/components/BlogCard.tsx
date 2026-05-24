import Link from "next/link";
import type { Article } from "@/lib/content";

export function BlogCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group block rounded-lg border border-line bg-white p-5 transition hover:border-brand-200 hover:shadow-soft"
    >
      <time
        className="text-2xs uppercase tracking-wide text-ink-muted"
        dateTime={article.frontmatter.date}
      >
        {new Date(article.frontmatter.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </time>
      <h2 className="mt-2 text-lg font-semibold text-ink group-hover:text-brand-700">
        {article.frontmatter.title}
      </h2>
      <p className="mt-1.5 line-clamp-3 text-sm text-ink-muted">
        {article.frontmatter.description}
      </p>
      {article.frontmatter.tags && article.frontmatter.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {article.frontmatter.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-ink-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
