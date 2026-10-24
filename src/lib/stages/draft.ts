import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { assertParsed, claude, SMART_MODEL } from "../claude";
import { DraftSchema, type Company, type Draft, type RunInput, type ScoreResult, type Signal } from "../types";

export function signalBlock(signals: Signal[]): string {
  return signals
    .map((s) => `[${s.id}] (${s.type}, ${s.date ?? "undated"}) ${s.title}\n  quote: "${s.snippet}"\n  source: ${s.sourceUrl}`)
    .join("\n");
}

export async function draftEmail(
  input: RunInput,
  company: Company,
  signals: Signal[],
  score: ScoreResult,
): Promise<Draft> {
  const top = new Set(score.reasons.map((r) => r.signalId));
  const ordered = [...signals.filter((s) => top.has(s.id)), ...signals.filter((s) => !top.has(s.id))];

  const res = await claude().messages.parse({
    model: SMART_MODEL,
    max_tokens: 4000,
    system: `You write short, warm, specific cold emails for B2B sellers. Every fact about the prospect must come from the provided signals.

Output the email as a list of sentences:
- kind "claim": the sentence states something about the prospect. It MUST cite the signal ids it relies on, and must not add numbers, dates or details beyond what those quotes say.
- kind "generic": about the seller, a question, or the call to action. No citations.
Each quote is true as of its date, not necessarily today. Never present an older plan or temporary state ("in beta", "launching soon", "plans to") as today's status: say when it was ("back in May..."), or leave it out.
Aim for 60-90 words in 3-5 short sentences. No greeting line, sign-off or signature (the app adds those). End with one short question as the call to action. Plain, human, not salesy.`,
    messages: [
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}.
Prospect: ${company.name} (${company.domain}), ${company.oneLiner}
Seller's ICP / offer: ${input.icp}

Signals (strongest why-now reasons first):
${signalBlock(ordered)}`,
      },
    ],
    output_config: { format: zodOutputFormat(DraftSchema) },
  });
  const draft = assertParsed(res.parsed_output, "draft");
  return { ...draft, sentences: draft.sentences.map((s, i) => ({ ...s, id: `s${i + 1}` })) };
}
