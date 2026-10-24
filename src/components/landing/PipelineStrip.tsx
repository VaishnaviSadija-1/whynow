import type { CSSProperties } from "react";
import { Tag } from "@/components/Tag";

const PIPELINE: { title: string; body: string; tags: ("ai" | "code")[] }[] = [
  { title: "Signals", body: "An agent searches the web for recent buying signals and quotes each source.", tags: ["ai"] },
  { title: "Fit", body: "Claude turns what you sell into criteria. Code checks the company against them.", tags: ["ai", "code"] },
  { title: "Timing", body: "Each signal keeps an account warm for a set window. Code finds the one open now.", tags: ["code"] },
  { title: "Priority", body: "Accounts are ranked, so the team knows who to call today and who to watch.", tags: ["code"] },
  { title: "Outreach", body: "A short email where every claim is fact-checked against its source.", tags: ["ai", "code"] },
];

/** The five pipeline steps, lit in sequence on a loop like a run in progress. */
export function PipelineStrip() {
  return (
    <ol className="pipe grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-5">
      {PIPELINE.map((p, i) => (
        <li key={p.title} className="pipe-step bg-card p-5" style={{ "--i": i } as CSSProperties}>
          <div className="flex items-center justify-between">
            <span className="pipe-num font-mono text-xs text-faint">0{i + 1}</span>
            <span className="flex gap-1">
              {p.tags.map((t) => (
                <Tag key={t} kind={t} />
              ))}
            </span>
          </div>
          <h3 className="mt-4 font-medium tracking-tight">{p.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
        </li>
      ))}
    </ol>
  );
}
