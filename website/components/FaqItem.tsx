type Props = { question: string; answer: string };

export function FaqItem({ question, answer }: Props) {
  return (
    <details className="group rounded-lg border border-line bg-white p-4 open:bg-white open:shadow-soft transition-shadow">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-transform group-open:rotate-45"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </span>
      </summary>
      <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
        {answer}
      </div>
    </details>
  );
}
