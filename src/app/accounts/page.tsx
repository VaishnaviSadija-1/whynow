import type { Metadata } from "next";
import Link from "next/link";
import { FIT_STYLE, TIMING_STYLE } from "@/components/run/verdictStyles";
import { assess, priority, stageLabel } from "@/lib/assess";
import { FIXTURES } from "@/lib/fixtures";
import { scoreSignals } from "@/lib/scoring";

export const metadata: Metadata = { title: "Accounts · WhyNow" };

const NEXT = [
  { title: "Your own signals", body: "CRM activity, website visits and product usage next to public signals." },
  { title: "Always watching", body: "Re-check every account daily and alert the rep the moment a window opens." },
  { title: "Timing that learns", body: "Tune the windows from which outreach actually got replies and meetings." },
  { title: "Who to contact", body: "Map the buying team for each account and route it to the right rep." },
];

export default function AccountsPage() {
  const rows = FIXTURES.filter((f) => f.criteria)
    .map((f) => {
      const a = assess(f.company, f.signals, f.criteria!, f.asOf);
      const score = scoreSignals(f.signals, f.asOf).score;
      return { f, a, score, rank: priority(a, score) };
    })
    .sort((x, y) => y.rank - x.rank);
  const icp = FIXTURES[0].input.icp;
  const callNow = rows.filter((r) => r.a.timing.verdict === "now" || r.a.timing.verdict === "closing").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Accounts</p>
      <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
        {callNow} of {rows.length} accounts are worth a call right now.
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Ranked by timing, then fit, for a team that sells: <span className="text-ink">{icp}</span>
      </p>

      <ol className="mt-10 space-y-3">
        {rows.map(({ f, a, score }, i) => {
          const t = TIMING_STYLE[a.timing.verdict];
          return (
            <li key={f.input.domain} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
              <Link
                href={`/run?domain=${f.input.domain}`}
                className="group grid gap-4 rounded-2xl border border-line bg-card p-5 hover:border-line-strong sm:grid-cols-[1.4fr_1fr_auto] sm:items-center sm:p-6"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-faint">{i + 1}</span>
                    <span className="text-lg font-medium">{f.company.name}</span>
                    {f.sample && <span className="text-xs text-faint">sample</span>}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">
                    {f.company.industry} · {stageLabel(f.company.fundingStage)} · {f.company.employeeRange} people
                  </p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.chip}`}>{t.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FIT_STYLE[a.fit.level].chip}`}>
                      {FIT_STYLE[a.fit.level].label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{a.timing.reason}</p>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                  <span className="font-display text-3xl leading-none">{score}</span>
                  <span className="text-[11px] text-faint">why-now score</span>
                  <span className="text-sm text-accent transition-transform group-hover:translate-x-0.5 sm:mt-2">Open →</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-sm text-muted">
        <Link href="/run" className="text-accent hover:underline">
          Check any other company
        </Link>{" "}
        and WhyNow researches it live.
      </p>

      <section className="mt-16 rounded-2xl border border-dashed border-line-strong p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">This is a prototype</p>
        <h2 className="mt-2 font-display text-3xl">What I&apos;d build next</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {NEXT.map((n) => (
            <div key={n.title}>
              <h3 className="font-medium">{n.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{n.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
