type Entry = {
  version: string;
  date: string;
  summary: string;
  fixed: string[];
  improved: string[];
  security: string[];
  notes?: string;
};

const sectionStyles: Record<string, string> = {
  Fixed: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Improved: "text-brand-700 bg-brand-50 border-brand-200",
  Security: "text-rose-700 bg-rose-50 border-rose-200",
};

function Section({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sectionStyles[label]}`}
      >
        {label}
      </span>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-700 list-disc pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ChangelogItem({ entry }: { entry: Entry }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold text-slate-900">v{entry.version}</h2>
        <time className="text-sm text-slate-500" dateTime={entry.date}>
          {new Date(entry.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
      </header>
      <p className="mt-2 text-base text-slate-700">{entry.summary}</p>
      <Section label="Fixed" items={entry.fixed} />
      <Section label="Improved" items={entry.improved} />
      <Section label="Security" items={entry.security} />
      {entry.notes ? (
        <p className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500 italic">
          {entry.notes}
        </p>
      ) : null}
    </article>
  );
}
