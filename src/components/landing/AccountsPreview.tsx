import type { CSSProperties } from "react";
import { TIMING_STYLE } from "@/components/run/verdictStyles";
import { assess, priority } from "@/lib/assess";
import { FIXTURES } from "@/lib/fixtures";
import { scoreSignals } from "@/lib/scoring";

/** The real demo accounts, ranked, revealing one by one like a morning briefing. */
export function AccountsPreview() {
  const rows = FIXTURES.filter((f) => f.criteria)
    .map((f) => {
      const a = assess(f.company, f.signals, f.criteria!, f.asOf);
      const score = scoreSignals(f.signals, f.asOf).score;
      return { f, a, rank: priority(a, score) };
    })
    .sort((x, y) => y.rank - x.rank);

  return (
    <figure aria-label="Example: accounts ranked by fit and timing" className="rounded-2xl border border-line bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-line pb-3 text-[11px] text-faint">
        <span className="font-mono uppercase tracking-[0.14em]">Today&apos;s accounts</span>
        <span className="flex items-center gap-1.5">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
          Watching signals
        </span>
      </div>
      <ol className="mt-2">
        {rows.map(({ f, a }, i) => {
          const t = TIMING_STYLE[a.timing.verdict];
          const hot = a.timing.verdict === "now" || a.timing.verdict === "closing";
          const top = a.timing.primary?.title ?? a.fit.checks.find((c) => c.label === "Need")?.detail ?? "";
          return (
            <li
              key={f.input.domain}
              className="fade-up flex items-center gap-3 border-b border-line py-3 last:border-0"
              style={{ "--d": `${1200 + i * 280}ms` } as CSSProperties}
            >
              <span className="w-4 font-mono text-[11px] text-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{f.company.name}</p>
                <p className="truncate text-xs text-muted">{top}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${t.chip} ${hot ? "chip-glow" : ""}`}>
                {t.label}
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
