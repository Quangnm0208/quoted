import type { Metadata } from "next";
import { site, siteUrl } from "./site";

type BuildMetadataInput = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

export function buildMetadata({
  title,
  description,
  path = "/",
  image,
  type = "website",
  publishedTime,
  modifiedTime,
}: BuildMetadataInput): Metadata {
  const canonical = `${siteUrl}${path}`;
  const fullTitle = path === "/" ? title : `${title} | ${site.name}`;

  // When no image is passed, omit the openGraph.images entry so that the
  // file-based /opengraph-image.tsx (Next.js convention) is picked up
  // automatically by routes that don't override.
  const ogImages = image
    ? [{ url: image, width: 1200, height: 630, alt: fullTitle }]
    : undefined;
  const twImages = image ? [image] : undefined;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: site.name,
      type,
      ...(ogImages ? { images: ogImages } : {}),
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(twImages ? { images: twImages } : {}),
      creator: site.twitter,
    },
    robots: { index: true, follow: true },
  };
}
