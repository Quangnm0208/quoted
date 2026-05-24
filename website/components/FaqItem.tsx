type Props = { question: string; answer: string };

export function FaqItem({ question, answer }: Props) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-white p-5 open:bg-slate-50">
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium text-slate-900 list-none [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-slate-500 group-open:rotate-45 transition-transform"
        >
          +
        </span>
      </summary>
      <div className="mt-3 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
        {answer}
      </div>
    </details>
  );
}
