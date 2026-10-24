import type { AnySignalType, ScoreResult, Signal } from "./types";

/**
 * The why-now score is deliberately NOT produced by a model.
 * Claude finds and labels the evidence; this formula turns it into a number
 * that is explainable, reproducible and easy to tune.
 */
export const TYPE_WEIGHT: Record<AnySignalType, number> = {
  funding: 1.0,
  exec_hire: 0.9,
  hiring_surge: 0.7,
  launch: 0.6,
  expansion: 0.6,
  tech_change: 0.5,
  partnership: 0.4,
  news: 0.3,
  demo_request: 1.0,
  pricing_visit: 0.8,
  champion_move: 0.9,
  product_usage: 0.7,
};

/** Days after which a signal keeps ~37% of its weight. */
export const DECAY_DAYS = 90;
/** Weight multiplier for signals with no date: we can't tell if they're timely. */
export const UNDATED_DECAY = 0.3;
/** Controls how quickly the score saturates toward 100. */
export const SATURATION = 2;

const DAY_MS = 86_400_000;

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS));
}

export function recencyDecay(date: string | null, asOf: string): number {
  if (!date || Number.isNaN(Date.parse(date))) return UNDATED_DECAY;
  return Math.exp(-daysBetween(date, asOf) / DECAY_DAYS);
}

export function signalContribution(signal: Signal, asOf: string): number {
  return (
    TYPE_WEIGHT[signal.type] * recencyDecay(signal.date, asOf) * (1 + signal.icpRelevance / 3)
  );
}

export function scoreSignals(signals: Signal[], asOf: string): ScoreResult {
  const contributions = signals.map((s) => ({ s, c: signalContribution(s, asOf) }));
  const raw = contributions.reduce((sum, x) => sum + x.c, 0);
  const score = Math.round(100 * (1 - Math.exp(-raw / SATURATION)));
  const reasons = contributions
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
    .map(({ s, c }) => ({
      signalId: s.id,
      label: s.title,
      contribution: Math.round(c * 100) / 100,
    }));
  return { score, raw: Math.round(raw * 100) / 100, reasons };
}
