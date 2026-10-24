/**
 * Claim-checker eval: runs the real verifier (VERIFY_MODEL + quote and detail checks) over
 * hand-labelled claims and reports how many fabrications it catches.
 *
 *   ANTHROPIC_API_KEY=... npm run eval
 *
 * Writes src/data/eval-results.json, which the "How it works" page shows.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { isFailing } from "../src/lib/lint";
import { verifySentence, VERIFY_MODEL } from "../src/lib/stages/verify";
import type { Signal } from "../src/lib/types";

type Case = { id: string; category: string; claim: string; snippet: string; date?: string; expect: "pass" | "fail" };

const cases: Case[] = readFileSync("evals/claims.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

async function main() {
  const results = await Promise.all(
    cases.map(async (c) => {
      const signal: Signal = {
        id: "sig_1",
        type: "news",
        title: "eval",
        date: c.date ?? null,
        sourceUrl: "https://eval.example",
        sourceTitle: "eval",
        snippet: c.snippet,
        icpRelevance: 1,
      };
      const v = await verifySentence({ id: c.id, text: c.claim, cites: ["sig_1"], kind: "claim" }, [signal]);
      const got = isFailing(v) ? "fail" : "pass";
      return { ...c, got, verdict: v.verdict, source: v.source, rationale: v.rationale, correct: got === c.expect };
    }),
  );

  const fabricated = results.filter((r) => r.expect === "fail");
  const faithful = results.filter((r) => r.expect === "pass");
  const caught = fabricated.filter((r) => r.got === "fail").length;
  const falseAlarms = faithful.filter((r) => r.got === "fail").length;

  const summary = {
    status: "ran",
    ranAt: new Date().toISOString(),
    model: VERIFY_MODEL,
    total: results.length,
    fabricated: fabricated.length,
    caught,
    faithful: faithful.length,
    falseAlarms,
    accuracy: results.filter((r) => r.correct).length / results.length,
    misses: results.filter((r) => !r.correct).map(({ id, category, claim, verdict, rationale }) => ({ id, category, claim, verdict, rationale })),
  };
  writeFileSync("src/data/eval-results.json", JSON.stringify(summary, null, 2) + "\n");

  console.log(`Caught ${caught}/${fabricated.length} fabricated claims`);
  console.log(`False alarms on ${falseAlarms}/${faithful.length} faithful claims`);
  console.log(`Accuracy ${(summary.accuracy * 100).toFixed(1)}%`);
  for (const m of summary.misses) console.log(`  miss ${m.id} [${m.category}] ${m.verdict}: ${m.claim}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
