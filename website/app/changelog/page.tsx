import { ChangelogItem } from "@/components/ChangelogItem";
import changelogData from "@/content/changelog.json";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Changelog",
  description:
    "Release notes for Quoted — security patches, bot signature updates, schema engine improvements, and feature releases.",
  path: "/changelog",
});

export default function ChangelogPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
      <header>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
          Changelog
        </h1>
        <p className="mt-4 text-slate-600">
          The work we do so you don&apos;t have to. Curated bot signatures, WordPress
          compatibility patches, schema conflict matrix, and security hardening — shipped on a
          predictable cadence.
        </p>
      </header>

      <div className="mt-10 space-y-6">
        {changelogData.entries.map((entry) => (
          <ChangelogItem key={entry.version} entry={entry} />
        ))}
      </div>
    </section>
  );
}
