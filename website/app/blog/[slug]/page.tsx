import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllArticles, getArticle } from "@/lib/content";
import { buildMetadata } from "@/lib/seo";
import { site, siteUrl } from "@/lib/site";

type Params = { slug: string };

export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return buildMetadata({ title: "Not found", description: "", path: `/blog/${slug}` });

  return buildMetadata({
    title: article.frontmatter.title,
    description: article.frontmatter.description,
    path: `/blog/${article.slug}`,
    image: article.frontmatter.ogImage,
    type: "article",
    publishedTime: article.frontmatter.date,
  });
}

export default async function BlogArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.frontmatter.title,
    description: article.frontmatter.description,
    datePublished: article.frontmatter.date,
    author: { "@type": "Person", name: article.frontmatter.author ?? site.name },
    publisher: { "@type": "Organization", name: site.name },
    mainEntityOfPage: `${siteUrl}/blog/${article.slug}`,
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <nav className="mb-6 text-sm">
        <Link href="/blog" className="text-brand-700 hover:text-brand-800">
          ← All articles
        </Link>
      </nav>

      <header>
        <time className="text-2xs uppercase tracking-wide text-ink-muted" dateTime={article.frontmatter.date}>
          {new Date(article.frontmatter.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink md:text-5xl">
          {article.frontmatter.title}
        </h1>
        <p className="mt-4 text-lg text-ink-muted">{article.frontmatter.description}</p>
        {article.frontmatter.author ? (
          <p className="mt-4 text-xs text-ink-muted">By {article.frontmatter.author}</p>
        ) : null}
      </header>

      <div className="prose prose-slate mt-10 max-w-none prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-code:text-ink prose-code:before:content-none prose-code:after:content-none">
        <MDXRemote source={article.content} />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
    </article>
  );
}
