import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = path.join(process.cwd(), "content");

export type ArticleFrontmatter = {
  title: string;
  description: string;
  date: string;
  author?: string;
  tags?: string[];
  ogImage?: string;
};

export type Article = {
  slug: string;
  frontmatter: ArticleFrontmatter;
  content: string;
};

export type DocFrontmatter = {
  title: string;
  description: string;
  order: number;
};

export type DocPage = {
  slug: string;
  frontmatter: DocFrontmatter;
  content: string;
};

function readMarkdownDir<T>(dir: string): { slug: string; frontmatter: T; content: string }[] {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(fullDir, file), "utf8");
      const { data, content } = matter(raw);
      const slug = file.replace(/\.(md|mdx)$/, "");
      return { slug, frontmatter: data as T, content };
    });
}

export function getAllArticles(): Article[] {
  return readMarkdownDir<ArticleFrontmatter>("articles").sort(
    (a, b) => +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date)
  );
}

export function getArticle(slug: string): Article | null {
  return getAllArticles().find((a) => a.slug === slug) ?? null;
}

export function getAllDocs(): DocPage[] {
  return readMarkdownDir<DocFrontmatter>("docs").sort(
    (a, b) => (a.frontmatter.order ?? 99) - (b.frontmatter.order ?? 99)
  );
}

export function getDoc(slug: string): DocPage | null {
  return getAllDocs().find((d) => d.slug === slug) ?? null;
}
