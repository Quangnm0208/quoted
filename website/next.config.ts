import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { mdxRs: false },
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

export default config;
