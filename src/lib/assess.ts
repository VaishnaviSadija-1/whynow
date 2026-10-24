import * as z from "zod";
import { signalContribution } from "./scoring";
import { FUNDING_STAGES, type Company, type AnySignalType, type Signal } from "./types";

/**
 * "Right company?" and "Right time?" — the two questions a sales team actually
 * asks. Claude turns the seller's description into criteria and finds the
 * evidence; everything in this file is plain code, so every verdict can be
 * explained line by line.
 */

export const FitCriteriaSchema = z.object({
  industries: z.array(z.string()).describe("Target industries, lowercase. Empty if the seller didn't narrow it down."),
  minStage: z.enum(FUNDING_STAGES).describe("Earliest funding stage the seller targets, or 'unknown' if not stated"),
  minEmployees: z.number().int().nullable().describe("Smallest company size targeted, or null"),
  maxEmployees: z.number().int().nullable().describe("Largest company size targeted, or null"),
  need: z.string().describe("The situation that creates demand for the offer, in a few words, e.g. 'scaling their go-to-market team'"),
});
export type FitCriteria = z.infer<typeof FitCriteriaSchema>;

export type Check = { label: string; status: "pass" | "fail" | "unknown"; detail: string };
export type Fit = { level: "strong" | "moderate" | "weak"; checks: Check[] };

const stageRank = (s: string) => FUNDING_STAGES.indexOf(s as (typeof FUNDING_STAGES)[number]);
export const stageLabel = (s: string) =>
  s === "unknown" ? "Unknown stage" : s.replace("series_d_plus", "series_D+").replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** "150-200" -> 150, "1,001+" -> 1001, "unknown" -> NaN */
export const headcount = (range: string) => Number(range.match(/\d[\d,]*/)?.[0].replace(/,/g, "") ?? NaN);

export function assessFit(company: Company, signals: Signal[], c: FitCriteria): Fit {
  const checks: Check[] = [];

  if (c.industries.length) {
    const ind = company.industry.toLowerCase();
    const hit = c.industries.some((t) => ind.includes(t.toLowerCase()) || t.toLowerCase().includes(ind));
    checks.push({ label: "Industry", status: hit ? "pass" : "fail", detail: `${company.industry} (you target ${c.industries.join(", ")})` });
  }

  if (c.minStage !== "unknown") {
    const status = company.fundingStage === "unknown" ? "unknown" : stageRank(company.fundingStage) >= stageRank(c.minStage) ? "pass" : "fail";
    checks.push({ label: "Stage", status, detail: `${stageLabel(company.fundingStage)} (you target ${stageLabel(c.minStage)}+)` });
  }

  if (c.minEmployees != null || c.maxEmployees != null) {
    const n = headcount(company.employeeRange);
    const ok = (c.minEmployees == null || n >= c.minEmployees) && (c.maxEmployees == null || n <= c.maxEmployees);
    const range = c.maxEmployees == null ? `${c.minEmployees}+` : `${c.minEmployees ?? 0}-${c.maxEmployees}`;
    checks.push({ label: "Size", status: Number.isNaN(n) ? "unknown" : ok ? "pass" : "fail", detail: `${company.employeeRange} people (you target ${range})` });
  }

  const needSignal = [...signals].sort((a, b) => b.icpRelevance - a.icpRelevance)[0];
  checks.push(
    needSignal && needSignal.icpRelevance >= 2
      ? { label: "Need", status: "pass", detail: `${c.need}: ${needSignal.title}` }
      : { label: "Need", status: "unknown", detail: `No clear sign of ${c.need}` },
  );

  const level = checks.some((x) => x.status === "fail") ? "weak" : checks.every((x) => x.status === "pass") ? "strong" : "moderate";
  return { level, checks };
}

/**
 * How long each kind of signal keeps an account warm. New leaders buy in their
 * first ~4 months; a funding round is fresh for about as long; news goes stale fast.
 */
export const WINDOW_DAYS: Record<AnySignalType, number> = {
  funding: 120,
  exec_hire: 120,
  expansion: 90,
  launch: 90,
  tech_change: 90,
  hiring_surge: 60,
  partnership: 60,
  news: 30,
  demo_request: 30,
  pricing_visit: 14,
  champion_move: 90,
  product_usage: 30,
};
/** An open window with this many days or fewer left is "closing". */
export const CLOSING_DAYS = 14;

const DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

export type SignalWindow = { signalId: string; title: string; start: string; end: string; open: boolean; daysLeft: number };
export type Timing = {
  verdict: "closing" | "now" | "watch" | "none";
  headline: string;
  reason: string;
  primary: SignalWindow | null;
  windows: SignalWindow[];
};

export function signalWindows(signals: Signal[], asOf: string): SignalWindow[] {
  return signals
    .filter((s) => s.date && !Number.isNaN(Date.parse(s.date)))
    .map((s) => {
      const start = s.date!.slice(0, 10);
      const end = addDays(start, WINDOW_DAYS[s.type]);
      const daysLeft = daysBetween(asOf, end);
      return { signalId: s.id, title: s.title, start, end, open: daysLeft >= 0 && start <= asOf, daysLeft };
    });
}

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function assessTiming(signals: Signal[], asOf: string): Timing {
  const windows = signalWindows(signals, asOf);
  const relevant = new Set(signals.filter((s) => s.icpRelevance >= 2).map((s) => s.id));
  const byId = new Map(signals.map((s) => [s.id, s]));
  const open = windows
    .filter((w) => w.open && relevant.has(w.signalId))
    .sort((a, b) => signalContribution(byId.get(b.signalId)!, asOf) - signalContribution(byId.get(a.signalId)!, asOf));

  if (!signals.length) return { verdict: "none", headline: "No signals yet", reason: "Nothing recent and sourced to act on.", primary: null, windows };

  const primary = open[0] ?? null;
  if (!primary) {
    const last = windows.filter((w) => relevant.has(w.signalId)).sort((a, b) => b.end.localeCompare(a.end))[0];
    return {
      verdict: "watch",
      headline: "Watch, don't reach out yet",
      reason: last
        ? `The last strong trigger (${last.title}) went cold on ${fmt(last.end)}. Re-check in 30 days.`
        : "No strong, dated trigger. Re-check in 30 days.",
      primary: null,
      windows,
    };
  }
  const age = daysBetween(primary.start, asOf);
  if (primary.daysLeft <= CLOSING_DAYS)
    return {
      verdict: "closing",
      headline: "Reach out this week",
      reason: `${primary.title}, ${age} days ago. The window closes ${fmt(primary.end)}.`,
      primary,
      windows,
    };
  return {
    verdict: "now",
    headline: "Reach out now",
    reason: `${primary.title}, ${age} days ago. Warm until ${fmt(primary.end)}.`,
    primary,
    windows,
  };
}

export type Assessment = { fit: Fit; timing: Timing };

export function assess(company: Company, signals: Signal[], criteria: FitCriteria, asOf: string): Assessment {
  return { fit: assessFit(company, signals, criteria), timing: assessTiming(signals, asOf) };
}

const TIMING_RANK = { closing: 3, now: 2, watch: 1, none: 0 } as const;
const FIT_BONUS = { strong: 0.5, moderate: 0.2, weak: -1.5 } as const;

/** Sort key for the accounts list: timing first, then fit, then the why-now score. */
export const priority = (a: Assessment, score: number) => TIMING_RANK[a.timing.verdict] + FIT_BONUS[a.fit.level] + score / 1000;
