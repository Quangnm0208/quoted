import siteData from "@/content/site.json";

export type NavLink = { label: string; href: string };
export type FooterSection = { title: string; links: NavLink[] };

export type SiteConfig = {
  name: string;
  tagline: string;
  description: string;
  url: string;
  supportEmail: string;
  twitter: string;
  wordpressPluginUrl: string;
  githubUrl: string;
  nav: NavLink[];
  footerSections: FooterSection[];
};

export const site = siteData as SiteConfig;

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || site.url;

export const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || site.supportEmail;
