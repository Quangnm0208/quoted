import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-24 text-center">
      <p className="text-sm font-medium text-brand-700">404</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
        Page not found
      </h1>
      <p className="mt-4 text-slate-600">
        The page you were looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-8 flex justify-center gap-3 text-sm">
        <Link href="/" className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          Back to home
        </Link>
        <Link href="/docs" className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">
          Read the docs
        </Link>
      </div>
    </section>
  );
}
