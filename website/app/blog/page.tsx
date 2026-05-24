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
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
      <header>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Blog</h1>
        <p className="mt-4 text-slate-600 max-w-2xl">
          Practical writing on AI search, llms.txt, WordPress SEO, and citation tracking.
          Updated when there&apos;s something useful to say — never for the sake of posting.
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="mt-10 text-slate-500">No articles yet. Check back soon.</p>
      ) : (
        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {articles.map((article) => (
            <BlogCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </section>
  );
}
