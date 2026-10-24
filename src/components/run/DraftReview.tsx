"use client";

import { useState } from "react";
import type { Draft, RunRecord, Sentence, Signal, Verdict, VerdictLabel } from "@/lib/types";

type Row = {
  sentence: Sentence;
  verdict: Verdict | null;
  repaired: { sentence: Sentence; verdict: Verdict | null } | null;
  removed: boolean;
  injected?: boolean;
};

const STYLE: Record<VerdictLabel | "none" | "checking", { chip: string; label: string; text: string }> = {
  SUPPORTED: { chip: "bg-ok-soft text-ok", label: "Supported", text: "" },
  PARTIAL: { chip: "bg-warn-soft text-warn", label: "Partly supported", text: "" },
  UNSUPPORTED: { chip: "bg-bad-soft text-bad", label: "Unsupported", text: "" },
  CONTRADICTED: { chip: "bg-bad-soft text-bad", label: "Contradicted", text: "" },
  none: { chip: "bg-paper text-faint", label: "No claim", text: "" },
  checking: { chip: "bg-accent-soft text-accent", label: "Checking", text: "" },
};

const SOURCE_LABEL: Record<Verdict["source"], string> = {
  lint: "Citation rules (code)",
  model: "Claude Sonnet 5 fact-check",
  quote_check: "Quote check (code) overrode the model",
  detail_check: "Detail check (code) overrode the model's label",
};

export function DraftReview(props: {
  draft: Draft;
  verdicts: Verdict[];
  repairs: RunRecord["repairs"];
  signals: Signal[];
  checking: boolean;
  injected: { sentence: Sentence; verdict: Verdict; live: boolean } | null;
  onSelectCites: (ids: string[]) => void;
}) {
  const { draft, verdicts, repairs, signals, checking, injected } = props;
  const [selected, setSelected] = useState<string | null>(null);

  const rows: Row[] = draft.sentences.map((s) => {
    const rep = repairs?.sentences.find((x) => x.id === s.id);
    return {
      sentence: s,
      verdict: verdicts.find((v) => v.sentenceId === s.id) ?? null,
      repaired: rep ? { sentence: rep, verdict: repairs?.verdicts.find((v) => v.sentenceId === s.id) ?? null } : null,
      removed: Boolean(repairs?.removed.includes(s.id)),
    };
  });
  if (injected) rows.push({ sentence: injected.sentence, verdict: injected.verdict, repaired: null, removed: false, injected: true });

  const select = (row: Row) => {
    const next = selected === row.sentence.id ? null : row.sentence.id;
    setSelected(next);
    props.onSelectCites(next ? (row.repaired?.sentence ?? row.sentence).cites : []);
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Subject: <span className="text-ink">{draft.subject}</span>
      </p>
      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {rows.map((row) => {
          const key = row.verdict?.verdict ?? (checking && row.sentence.cites.length ? "checking" : "none");
          const style = STYLE[key];
          const open = selected === row.sentence.id;
          return (
            <li key={row.sentence.id} className={row.injected ? "rise bg-bad-soft/40" : ""}>
              <button onClick={() => select(row)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-paper/60" aria-expanded={open}>
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${style.chip}`}>
                  {row.injected ? "Injected" : style.label}
                </span>
                <span className="flex-1 text-sm leading-relaxed">
                  <span className={row.removed || row.repaired ? "text-faint line-through" : ""}>{row.sentence.text}</span>
                  <Cites ids={row.sentence.cites} signals={signals} />
                  {row.repaired && (
                    <span className="mt-1.5 block">
                      {row.removed ? (
                        <span className="mr-2 rounded bg-bad-soft px-1.5 py-0.5 text-[11px] font-medium text-bad">Rewrite also failed</span>
                      ) : (
                        <span className="mr-2 rounded bg-ok-soft px-1.5 py-0.5 text-[11px] font-medium text-ok">Rewritten</span>
                      )}
                      <span className={row.removed ? "text-faint line-through" : ""}>{row.repaired.sentence.text}</span>
                      <Cites ids={row.repaired.sentence.cites} signals={signals} />
                    </span>
                  )}
                  {row.removed && <span className="mt-1.5 block text-xs text-bad">Removed: couldn&apos;t be supported by any source.</span>}
                  {row.injected && row.verdict && (
                    <span className="mt-1.5 block text-xs text-bad">
                      {row.verdict.verdict === "UNSUPPORTED" || row.verdict.verdict === "CONTRADICTED"
                        ? "Caught by the checker. It would never reach the final email."
                        : "Missed: the checker let this through."}{" "}
                      {injected?.live ? "Checked live just now." : "Recorded result (live mode is off)."}
                    </span>
                  )}
                </span>
              </button>
              {open && <Inspector row={row} signals={signals} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Cites({ ids, signals }: { ids: string[]; signals: Signal[] }) {
  if (!ids.length) return null;
  return (
    <sup className="ml-1 font-mono text-[10px] text-accent">
      {ids.map((id) => {
        const n = signals.findIndex((s) => s.id === id) + 1;
        return n ? `[${n}]` : `[?${id}]`;
      })}
    </sup>
  );
}

function Inspector({ row, signals }: { row: Row; signals: Signal[] }) {
  const checks = [
    { title: "First check", sentence: row.sentence, verdict: row.verdict },
    ...(row.repaired ? [{ title: "After rewrite", sentence: row.repaired.sentence, verdict: row.repaired.verdict }] : []),
  ];
  return (
    <div className="space-y-4 border-t border-line bg-paper px-4 py-4 text-sm">
      {checks.map((c) => (
        <div key={c.title} className="space-y-2">
          {checks.length > 1 && <div className="text-xs font-medium text-muted">{c.title}</div>}
          {c.verdict ? (
            <>
              <p>
                <span className="font-medium">{STYLE[c.verdict.verdict].label}.</span> {c.verdict.rationale}
              </p>
              <p className="text-xs text-faint">Decided by: {SOURCE_LABEL[c.verdict.source]}</p>
              {c.verdict.quote && (
                <p className="text-xs">
                  <span className="text-muted">Evidence quoted by the checker: </span>
                  <mark className="rounded bg-ok-soft px-1 text-ok">“{c.verdict.quote}”</mark>
                </p>
              )}
            </>
          ) : (
            <p className="text-muted">
              {c.sentence.kind === "generic"
                ? "About the seller or a call to action, so no source is needed. Citation rules still check it for hidden facts."
                : "Not checked yet."}
            </p>
          )}
          {c.sentence.cites.map((id) => {
            const s = signals.find((x) => x.id === id);
            if (!s) return <p key={id} className="text-xs text-bad">Cites {id}, which doesn&apos;t exist.</p>;
            return (
              <div key={id} className="rounded-lg border border-line bg-card p-3 text-xs leading-relaxed">
                <div className="text-muted">
                  Source [{signals.indexOf(s) + 1}]:{" "}
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {s.sourceTitle}
                  </a>
                </div>
                <p className="mt-1">“{s.snippet}”</p>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function emailParagraphs(draft: Draft): Sentence[][] {
  const claims = draft.sentences.filter((s) => s.kind === "claim");
  const generic = draft.sentences.filter((s) => s.kind === "generic");
  const asks = generic.filter((s) => s.text.trim().endsWith("?"));
  const rest = generic.filter((s) => !asks.includes(s));
  return [claims, rest, asks].filter((p) => p.length);
}

/** "Nick Bogaty, Chief Revenue Officer" -> "Nick". A bare title like "Head of Sales" gives no name. */
export function greetingName(recipient?: string): string {
  const name = recipient?.split(",")[0]?.trim() ?? "";
  const words = name.split(/\s+/);
  const looksLikeName = recipient?.includes(",") && words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Z][\p{L}'.-]*$/u.test(w));
  return looksLikeName ? words[0] : "{first name}";
}

function emailPlainText(draft: Draft, recipient?: string): string {
  const body = emailParagraphs(draft).map((p) => p.map((s) => s.text.trim()).join(" "));
  return [`Subject: ${draft.subject}`, `Hi ${greetingName(recipient)},`, ...body, "Best,\n{your name}"].join("\n\n");
}

function Fill({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\})/).map((part, i) =>
        /^\{[^}]+\}$/.test(part) ? (
          <span key={i} className="rounded border border-dashed border-accent/40 bg-accent-soft px-1 text-accent">
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function CitedSentence({ sentence, signals }: { sentence: Sentence; signals: Signal[] }) {
  const sources = sentence.cites.map((id) => signals.find((s) => s.id === id)).filter((s): s is Signal => Boolean(s));
  if (!sources.length) return <Fill text={sentence.text} />;
  const tip = `tip-${sentence.id}`;
  return (
    <span
      tabIndex={0}
      aria-describedby={tip}
      className="group relative cursor-help underline decoration-faint/60 decoration-dotted underline-offset-4 outline-none hover:decoration-accent focus-visible:rounded focus-visible:bg-accent-soft focus-visible:decoration-accent"
    >
      <Fill text={sentence.text} />
      <span
        id={tip}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden w-max max-w-[min(16rem,80vw)] rounded-md border border-line bg-card px-2.5 py-1.5 text-xs leading-snug text-muted shadow-sm group-hover:block group-focus:block"
      >
        <span className="block text-[10px] font-medium uppercase tracking-wide text-faint">Source</span>
        {sources.map((s) => (
          <span key={s.id} className="block text-ink">
            {s.sourceTitle}
          </span>
        ))}
      </span>
    </span>
  );
}

export function FinalEmail({
  draft,
  signals,
  recipient,
  companyName,
}: {
  draft: Draft;
  signals: Signal[];
  recipient?: string;
  companyName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const paragraphs = emailParagraphs(draft);
  const claims = draft.sentences.filter((s) => s.kind === "claim").length;
  const to = recipient?.trim() || `Head of Sales${companyName ? ` · ${companyName}` : ""}`;
  const copy = () =>
    navigator.clipboard.writeText(emailPlainText(draft, recipient)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  return (
    <article className="rounded-xl border border-line bg-card">
      <header className="rounded-t-xl border-b border-line bg-paper/60 px-5 py-4 text-sm">
        <div className="flex items-start gap-3">
          <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-faint">To</dt>
            <dd className={`min-w-0 truncate ${recipient ? "text-ink" : "text-muted"}`}>{to}</dd>
            <dt className="text-faint">Subject</dt>
            <dd className="min-w-0 font-medium text-ink">{draft.subject}</dd>
          </dl>
          <button
            onClick={copy}
            className="shrink-0 rounded-md border border-line bg-card px-2.5 py-1 text-xs hover:border-faint"
          >
            {copied ? "Copied" : "Copy email"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="rounded-full bg-ok-soft px-2 py-0.5 text-ok">✓ Fact-checked</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-muted">
            {claims} {claims === 1 ? "claim" : "claims"} verified
          </span>
        </div>
      </header>
      <div className="space-y-4 px-5 py-5 text-[15px] leading-relaxed">
        <p>
          <Fill text={`Hi ${greetingName(recipient)},`} />
        </p>
        {paragraphs.map((p) => (
          <p key={p[0].id}>
            {p.map((s, i) => (
              <span key={s.id}>
                {i > 0 && " "}
                <CitedSentence sentence={s} signals={signals} />
              </span>
            ))}
          </p>
        ))}
        <p>
          Best,
          <br />
          <Fill text="{your name}" />
        </p>
      </div>
    </article>
  );
}
