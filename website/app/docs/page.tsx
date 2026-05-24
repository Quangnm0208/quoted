import { redirect } from "next/navigation";
import { getAllDocs } from "@/lib/content";

export default function DocsIndexPage() {
  const first = getAllDocs()[0];
  if (first) redirect(`/docs/${first.slug}`);
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20 text-center text-slate-500">
      Documentation coming soon.
    </div>
  );
}
