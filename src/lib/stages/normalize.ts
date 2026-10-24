import * as z from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { assertParsed, claude, FAST_MODEL } from "../claude";
import { quoteIsIn } from "../lint";
import { CompanySchema, SignalSchema, type Company, type RunInput, type Signal } from "../types";

const NormalizedSchema = z.object({ company: CompanySchema, signals: z.array(SignalSchema) });

const MAX_AGE_DAYS = 365;

export async function normalize(
  input: RunInput,
  notes: string,
  evidenceCorpus: string,
  today: string,
): Promise<{ company: Company; signals: Signal[] }> {
  const res = await claude().messages.parse({
    model: FAST_MODEL,
    max_tokens: 8000,
    system:
      "You convert research notes into strict JSON. Copy quotes exactly as written in the notes; never invent or paraphrase them. Each signal's title must only restate what its own snippet says: no numbers, names or claims that aren't in the snippet. Drop any signal that has no source URL or whose snippet doesn't actually support its point.",
    messages: [
      {
        role: "user",
        content: `Domain: ${input.domain}
Seller ICP: ${input.icp}

Research notes:
"""
${notes}
"""

Return the company profile and the signals. Number signal ids sig_1, sig_2, ... in order of importance.
icpRelevance: 0 = unrelated to the seller's ICP, 3 = directly creates a need for what the seller offers.`,
      },
    ],
    output_config: { format: zodOutputFormat(NormalizedSchema) },
  });
  const parsed = assertParsed(res.parsed_output, "normalize");
  if (process.env.WHYNOW_DEBUG) console.log(`normalize: ${parsed.signals.length} signals from notes`);
  return { company: parsed.company, signals: cleanSignals(parsed.signals, evidenceCorpus, today) };
}

/** Deterministic post-processing: drop undated-and-stale junk, dedupe, verify quotes against retrieved text. */
export function cleanSignals(signals: Signal[], evidenceCorpus: string, today: string): Signal[] {
  const seen = new Set<string>();
  const out: Signal[] = [];
  const drop = (s: Signal, why: string) => process.env.WHYNOW_DEBUG && console.log(`drop ${s.id} (${why}): ${s.title}`);
  for (const s of signals) {
    if (!/^https?:\/\//.test(s.sourceUrl)) {
      drop(s, "no url");
      continue;
    }
    if (s.date && Date.parse(today) - Date.parse(s.date) > MAX_AGE_DAYS * 86_400_000) {
      drop(s, `older than ${MAX_AGE_DAYS} days`);
      continue;
    }
    const key = `${s.type}|${s.title.toLowerCase().slice(0, 40)}`;
    if (seen.has(key)) {
      drop(s, "duplicate");
      continue;
    }
    seen.add(key);
    out.push({ ...s, id: `sig_${out.length + 1}`, snippetVerified: quoteIsIn(s.snippet, evidenceCorpus) });
  }
  return out;
}
