import { hasApiKey } from "./claude";
import type { RunRecord } from "./types";

/**
 * Guardrails for a public demo. State is in memory, so it resets when a
 * serverless instance cold-starts. That's acceptable for a prototype; the
 * Anthropic console's monthly spend limit is the hard backstop.
 */
const PER_IP_LIMIT = Number(process.env.LIVE_RUNS_PER_IP ?? 5);
const DAILY_LIMIT = Number(process.env.LIVE_RUNS_PER_DAY ?? 25);
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const perIp = new Map<string, { day: string; count: number }>();
let global = { day: "", count: 0 };
const cache = new Map<string, { at: number; record: RunRecord }>();

const day = () => new Date().toISOString().slice(0, 10);

export function liveEnabled(): boolean {
  return hasApiKey() && process.env.LIVE_MODE !== "off";
}

export function checkLiveQuota(ip: string): { ok: true; remaining: number } | { ok: false; reason: string } {
  const d = day();
  if (global.day !== d) global = { day: d, count: 0 };
  if (global.count >= DAILY_LIMIT) return { ok: false, reason: "The demo hit today's live-run budget." };
  const entry = perIp.get(ip);
  const count = entry?.day === d ? entry.count : 0;
  if (count >= PER_IP_LIMIT) return { ok: false, reason: `You've used your ${PER_IP_LIMIT} live runs for today.` };
  return { ok: true, remaining: PER_IP_LIMIT - count };
}

export function consumeLiveRun(ip: string) {
  const d = day();
  const entry = perIp.get(ip);
  perIp.set(ip, { day: d, count: (entry?.day === d ? entry.count : 0) + 1 });
  global.count += 1;
}

export const cacheKey = (domain: string, icp: string) => `${domain}::${icp.trim().toLowerCase()}`;

export function getCached(key: string): RunRecord | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.record;
}

export function setCached(key: string, record: RunRecord) {
  cache.set(key, { at: Date.now(), record });
}

/** Accepts "https://www.acme.com/about" and returns "acme.com". */
export function normalizeDomain(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) && s.length <= 253 ? s : null;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
