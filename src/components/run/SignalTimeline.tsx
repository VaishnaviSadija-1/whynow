import { signalWindows } from "@/lib/assess";
import type { Signal } from "@/lib/types";

const DAY = 86_400_000;
const fmtMonth = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

/**
 * Each signal as a dot on its date, with a bar for how long it keeps the
 * account warm. The "today" line shows which windows are still open.
 */
export function SignalTimeline({ signals, asOf }: { signals: Signal[]; asOf: string }) {
  const windows = signalWindows(signals, asOf);
  if (!windows.length) return null;
  const today = Date.parse(asOf);
  const from = Math.min(today - 300 * DAY, ...windows.map((w) => Date.parse(w.start))) - 10 * DAY;
  const to = today + 90 * DAY;
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - from) / (to - from)) * 100))}%`;
  const ticks: number[] = [];
  for (let d = new Date(from); d.getTime() <= to; d.setUTCMonth(d.getUTCMonth() + 2, 1)) ticks.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const index = new Map(signals.map((s, i) => [s.id, i + 1]));

  return (
    <div className="rise rounded-2xl border border-line bg-card px-5 py-5 sm:px-6">
      <div className="relative h-5 font-mono text-[10px] text-faint">
        {ticks.filter((t) => t >= from).map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>
            {fmtMonth(t)}
          </span>
        ))}
      </div>
      <div className="relative mt-1 space-y-3">
        <div className="pointer-events-none absolute inset-y-0 w-px bg-accent" style={{ left: pct(today) }}>
          <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-accent">today</span>
        </div>
        {windows
          .sort((a, b) => a.start.localeCompare(b.start))
          .map((w) => (
            <div key={w.signalId}>
              <p className="mb-1 truncate text-xs text-muted">
                <span className="mr-1.5 font-mono text-accent">{index.get(w.signalId)}</span>
                {w.title}
              </p>
              <div className="relative h-2">
                <div className="absolute inset-y-0 rounded-full bg-line/60" style={{ left: 0, right: 0 }} />
                <div
                  className={`absolute inset-y-0 rounded-full ${w.open ? "bg-accent/70" : "bg-line-strong"}`}
                  style={{ left: pct(Date.parse(w.start)), width: `calc(${pct(Date.parse(w.end))} - ${pct(Date.parse(w.start))})` }}
                />
                <div
                  className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card ${w.open ? "bg-accent" : "bg-faint"}`}
                  style={{ left: pct(Date.parse(w.start)) }}
                />
              </div>
            </div>
          ))}
      </div>
      <p className="mt-4 text-xs text-faint">Bars show how long each signal keeps the account warm. Purple means still open today.</p>
    </div>
  );
}
