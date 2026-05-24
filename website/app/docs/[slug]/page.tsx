import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { DocLayout } from "@/components/DocLayout";
import { getAllDocs, getDoc } from "@/lib/content";
import { buildMetadata } from "@/lib/seo";

type Params = { slug: string };

export function generateStaticParams() {
  return getAllDocs().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return buildMetadata({ title: "Not found", description: "", path: `/docs/${slug}` });
  return buildMetadata({
    title: doc.frontmatter.title,
    description: doc.frontmatter.description,
    path: `/docs/${doc.slug}`,
  });
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  return (
    <DocLayout slug={doc.slug}>
      <h1>{doc.frontmatter.title}</h1>
      <p className="text-lg text-slate-600 !mt-2">{doc.frontmatter.description}</p>
      <hr />
      <MDXRemote source={doc.content} />
    </DocLayout>
  );
}
