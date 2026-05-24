import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { getAllArticles, getAllDocs } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = getAllArticles().map((a) => ({
    url: `${siteUrl}/blog/${a.slug}`,
    lastModified: new Date(a.frontmatter.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const docRoutes: MetadataRoute.Sitemap = getAllDocs().map((d) => ({
    url: `${siteUrl}/docs/${d.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...articleRoutes, ...docRoutes];
}
