import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">404</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink">
        Page not found
      </h1>
      <p className="mt-4 text-sm text-ink-muted">
        The page you were looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-8 flex justify-center gap-3 text-sm">
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md bg-brand-500 px-4 font-medium text-white hover:bg-brand-600"
        >
          Back to home
        </Link>
        <Link
          href="/docs"
          className="inline-flex h-9 items-center rounded-md border border-line bg-white px-4 font-medium text-ink hover:bg-surface-bg"
        >
          Read the docs
        </Link>
      </div>
    </section>
  );
}
