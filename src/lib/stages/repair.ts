import * as z from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { assertParsed, claude, SMART_MODEL } from "../claude";
import { isFailing } from "../lint";
import { SentenceSchema, type Company, type Draft, type Sentence, type Signal, type Verdict } from "../types";
import { signalBlock } from "./draft";
import { verifyDraft } from "./verify";

const RepairSchema = z.object({
  sentences: z.array(
    z.object({ id: z.string(), drop: z.boolean(), replacement: SentenceSchema.nullable() }),
  ),
});

/**
 * One repair pass: Sonnet rewrites only the failing sentences, we re-verify,
 * and anything still failing is removed from the final draft.
 */
export async function repairDraft(
  draft: Draft,
  verdicts: Verdict[],
  signals: Signal[],
  company: Company,
): Promise<{ repairs: { sentences: Sentence[]; verdicts: Verdict[]; removed: string[] }; final: Draft }> {
  const failing = verdicts.filter(isFailing);
  const res = await claude().messages.parse({
    model: SMART_MODEL,
    max_tokens: 3000,
    system:
      `You fix sentences in a sales email that failed fact-checking.
- Remove every detail the problem names. Don't soften it ("toward", "starting to") — cut it or replace it with what the quote actually says.
- Stay close to the quote's own wording for facts, e.g. "in beta with about 20 teams, launching publicly soon" instead of "launched".
- Cite every signal whose facts or names you use, and only those.
- A shorter sentence with one true fact beats a longer one with two half-true facts.
- If the problem is that a source is old, don't state its plan or status as current: anchor it in time ("back in May...") or cut it.
- Drop the sentence only if nothing true and relevant is left.
Keep the same id. Keep the tone warm and natural.`,
    messages: [
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}.

Full email for context:
${draft.sentences.map((s) => `${s.id}: ${s.text}`).join("\n")}

Failing sentences:
${failing
  .map((v) => {
    const s = draft.sentences.find((x) => x.id === v.sentenceId)!;
    return `${s.id}: "${s.text}" (cites: ${s.cites.join(", ") || "none"}) - problem: ${v.rationale}`;
  })
  .join("\n")}

Available evidence:
${signalBlock(signals)}`,
      },
    ],
    output_config: { format: zodOutputFormat(RepairSchema) },
  });
  const parsed = assertParsed(res.parsed_output, "repair");

  const rewritten: Sentence[] = parsed.sentences
    .filter((r) => !r.drop && r.replacement)
    .map((r) => ({ ...r.replacement!, id: r.id }));
  const failingIds = new Set(failing.map((v) => v.sentenceId));
  const recheck = await verifyDraft({ subject: draft.subject, sentences: rewritten }, signals, company);
  const stillFailing = new Set(recheck.filter(isFailing).map((v) => v.sentenceId));
  const fixed = new Map(rewritten.filter((s) => !stillFailing.has(s.id)).map((s) => [s.id, s]));

  const removed = [...failingIds].filter((id) => !fixed.has(id));
  const final: Draft = {
    subject: draft.subject,
    sentences: draft.sentences.flatMap((s) => (failingIds.has(s.id) ? (fixed.has(s.id) ? [fixed.get(s.id)!] : []) : [s])),
  };
  return { repairs: { sentences: rewritten, verdicts: recheck, removed }, final };
}
