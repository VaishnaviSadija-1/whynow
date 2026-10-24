import fello from "@/data/fixtures/fello-ai.json";
import linear from "@/data/fixtures/linear-app.json";
import northwind from "@/data/fixtures/northwind-pay.json";
import vercel from "@/data/fixtures/vercel-com.json";
import type { RunRecord } from "./types";

/**
 * Recorded runs. `sample: true` means hand-written sample data for a fictional
 * company; recorded real runs (npm run record) are added here without that flag.
 */
export const FIXTURES: RunRecord[] = [fello as RunRecord, linear as RunRecord, vercel as RunRecord, northwind as RunRecord];

export const SAMPLE_FIXTURE = FIXTURES.find((f) => f.sample)!;

export function findFixture(domain: string): RunRecord | null {
  return FIXTURES.find((f) => f.input.domain === domain) ?? null;
}

export type FixtureSummary = { domain: string; name: string; icp: string; sample: boolean };

export function fixtureSummaries(): FixtureSummary[] {
  return FIXTURES.map((f) => ({ domain: f.input.domain, name: f.company.name, icp: f.input.icp, sample: Boolean(f.sample) }));
}
