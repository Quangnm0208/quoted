import { Badge } from "./Badge";

type Entry = {
  version: string;
  date: string;
  summary: string;
  fixed: string[];
  improved: string[];
  security: string[];
  notes?: string;
};

function Section({
  tone,
  label,
  items,
}: {
  tone: "success" | "info" | "danger";
  label: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <Badge tone={tone}>{label}</Badge>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ChangelogItem({ entry }: { entry: Entry }) {
  return (
    <article className="rounded-lg border border-line bg-white p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold text-ink">v{entry.version}</h2>
        <time className="text-xs text-ink-muted" dateTime={entry.date}>
          {new Date(entry.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
      </header>
      <p className="mt-2 text-sm text-ink">{entry.summary}</p>
      <Section tone="success" label="Fixed" items={entry.fixed} />
      <Section tone="info" label="Improved" items={entry.improved} />
      <Section tone="danger" label="Security" items={entry.security} />
      {entry.notes ? (
        <p className="mt-4 border-t border-line-soft pt-4 text-xs italic text-ink-muted">
          {entry.notes}
        </p>
      ) : null}
    </article>
  );
}
