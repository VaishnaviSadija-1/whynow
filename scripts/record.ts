/**
 * Record a real live run as a replayable fixture, so the demo works even if
 * live mode is off or slow.
 *
 *   ANTHROPIC_API_KEY=... npm run record -- ramp.com "We sell ..."
 *
 * Then add the file to FIXTURES in src/lib/fixtures.ts.
 */
import { writeFileSync } from "node:fs";
import { fabricatedClaim, runLive } from "../src/lib/pipeline";
import { verifySentence } from "../src/lib/stages/verify";
import { usageSummary } from "../src/lib/claude";

const [domain, icp] = process.argv.slice(2);
if (!domain || !icp) {
  console.error('Usage: npm run record -- <domain> "<what you sell, and to whom>"');
  process.exit(1);
}

async function main() {
  const record = await runLive({ domain, icp }, (e) => {
    if (e.type === "stage") console.log(`${e.stage}: ${e.status}${e.note ? ` (${e.note})` : ""}`);
  });
  if (!record) {
    console.error("No signals found; nothing to record.");
    process.exit(1);
  }
  const sentence = fabricatedClaim(record);
  record.injected = { sentence, verdict: await verifySentence(sentence, record.signals) };
  const file = `src/data/fixtures/${domain.replace(/[^a-z0-9]+/gi, "-")}.json`;
  writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
  console.log(`Saved ${file}`);
  if (process.env.WHYNOW_DEBUG) console.log("usage", JSON.stringify(usageSummary(), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
