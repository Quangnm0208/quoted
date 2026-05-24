import { BlogCard } from "@/components/BlogCard";
import { getAllArticles } from "@/lib/content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blog",
  description:
    "Practical writing on AI search, llms.txt, WordPress SEO, citation tracking, and how AI engines crawl content.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const articles = getAllArticles();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">Blog</h1>
        <p className="mt-4 max-w-2xl text-sm text-ink-muted">
          Practical writing on AI search, llms.txt, WordPress SEO, and citation tracking.
          Updated when there&apos;s something useful to say — never for the sake of posting.
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="mt-10 text-sm text-ink-muted">No articles yet. Check back soon.</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {articles.map((article) => (
            <BlogCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </section>
  );
}
