import type { Signal } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  funding: "Funding",
  exec_hire: "Exec hire",
  hiring_surge: "Hiring surge",
  launch: "Launch",
  expansion: "Expansion",
  partnership: "Partnership",
  tech_change: "Tech change",
  news: "News",
};
const labelOf = (s: Signal) => (s.own ? "Your data" : TYPE_LABEL[s.type]);

export function SignalCard({ signal, index, highlighted, onRemove }: { signal: Signal; index: number; highlighted: boolean; onRemove?: () => void }) {
  return (
    <article
      id={signal.id}
      className={`rise rounded-lg border bg-card p-4 transition-colors ${highlighted ? "border-accent ring-2 ring-accent-soft" : "border-line"}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="grid h-5 w-5 place-items-center rounded bg-accent-soft font-mono text-[11px] text-accent">{index + 1}</span>
        <span className="font-medium text-ink">{labelOf(signal)}</span>
        <span>·</span>
        <span>{signal.date ?? "Undated"}</span>
        <span className="ml-auto" title="How relevant this is to your ICP (0-3)">
          ICP fit {"●".repeat(signal.icpRelevance)}
          <span className="text-line">{"●".repeat(3 - signal.icpRelevance)}</span>
        </span>
      </div>
      <h4 className="mt-2 font-medium">{signal.title}</h4>
      <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">“{signal.snippet}”</blockquote>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {signal.own ? (
          <>
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">Added by your team</span>
            {onRemove && (
              <button onClick={onRemove} className="text-faint hover:text-bad">
                Remove
              </button>
            )}
          </>
        ) : signal.sourceUrl.includes(".example/") ? (
          <span className="text-faint" title="Northwind Pay is a made-up company, so its sources are placeholders.">
            Fictional sample source
          </span>
        ) : (
          <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate text-accent hover:underline">
            {signal.sourceTitle || signal.sourceUrl}
          </a>
        )}
        {signal.snippetVerified !== undefined &&
          (signal.snippetVerified ? (
            <span className="rounded bg-ok-soft px-1.5 py-0.5 text-ok" title="This quote appears word for word in a page the agent fetched">
              Quote found in source
            </span>
          ) : (
            <span
              className="rounded bg-paper px-1.5 py-0.5 text-muted"
              title="Seen in a search result. Search results aren't returned as readable page text, so this quote can't be re-checked word for word."
            >
              From search result
            </span>
          ))}
      </div>
    </article>
  );
}
