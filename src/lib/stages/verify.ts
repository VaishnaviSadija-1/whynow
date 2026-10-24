import * as z from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { assertParsed, claude, FAST_MODEL, SMART_MODEL } from "../claude";

/** The fact-checker. Sonnet: it separates hedged opinions from invented facts more reliably, for ~1-2 cents a run. */
export const VERIFY_MODEL = SMART_MODEL;
import { enforceDetails, enforceQuote, hiddenClaimSuspects, lintDraft, sentencesToVerify } from "../lint";
import { VERDICTS, type Company, type Draft, type Sentence, type Signal, type Verdict } from "../types";

const VerdictSchema = z.object({
  unsupportedDetails: z
    .array(z.string())
    .describe(
      "Checkable facts about the prospect that the evidence does not state: names, people, titles, numbers, amounts, dates, places, investors, customers, rankings, events. Never list opinions, judgments or hedged inferences (e.g. 'a big step', 'great next step', 'probably getting a closer look'). Empty if none.",
    ),
  verdict: z.enum(VERDICTS),
  rationale: z.string().describe("One sentence explaining the verdict"),
  quote: z.string().describe("The exact words from the evidence that support the claim; empty string if none"),
});

/** Quotes older than this that describe a plan or temporary state can't be stated as current. */
const STALE_DAYS = 60;

const SYSTEM = `You are a strict fact-checker for sales emails. Decide whether a sentence is supported by the evidence quotes, and nothing else.

The email is addressed to the prospect company, so "you" and "your" refer to that company.

First list every factual detail the sentence asserts about the prospect: names, people, titles, numbers, amounts, dates, places, rankings, investors, customers, events. Then check each one against the evidence.

- SUPPORTED: every factual detail is stated in the evidence.
- PARTIAL: every factual detail is stated in the evidence, and the sentence only adds an opinion or a hedged inference ("probably", "likely", "must be", "is a big step"). PARTIAL never covers a new fact.
- UNSUPPORTED: at least one factual detail is not in the evidence, even if the rest is. A true fact plus one invented detail is UNSUPPORTED. Overstating the evidence (e.g. "topped" when it says "named to") is UNSUPPORTED.
- CONTRADICTED: the evidence states something different for at least one detail.

Time matters. Each quote is true as of its publication date, not necessarily today. If a quote is more than ${STALE_DAYS} days old and describes a temporary state or a plan ("in beta", "will launch", "plans to", "currently hiring", "is raising"), a sentence that presents that state or plan as true today is UNSUPPORTED, because it may have changed. Past events stated as past ("you raised a Series B in 2024", "back in May you announced...") are fine.

Copy the supporting quote character-for-character from the evidence.`;

export async function verifySentence(sentence: Sentence, signals: Signal[]): Promise<Verdict> {
  const cited = signals.filter((s) => sentence.cites.includes(s.id));
  const res = await claude().messages.parse({
    model: VERIFY_MODEL,
    max_tokens: 1000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}, so relative dates like "last year" or "this quarter" are relative to that.

Sentence: "${sentence.text}"

Evidence:
${cited.map((s) => `[${s.id}] (published ${s.date ?? "date unknown"}) "${s.snippet}"`).join("\n")}`,
      },
    ],
    output_config: { format: zodOutputFormat(VerdictSchema) },
  });
  const { unsupportedDetails, ...v } = assertParsed(res.parsed_output, "verify");
  return enforceQuote(
    enforceDetails({ sentenceId: sentence.id, ...v, source: "model" }, unsupportedDetails),
    cited.map((s) => s.snippet),
  );
}

const HiddenClaimSchema = z.object({
  statesProspectFact: z.boolean(),
  fact: z.string().describe("The fact about the prospect it states, or empty string"),
});

/**
 * An uncited "generic" sentence that mentions a name, number or date. Is it
 * really about the seller / a question, or does it slip in a prospect fact?
 */
export async function checkHiddenClaim(sentence: Sentence, company: Company): Promise<Verdict | null> {
  const res = await claude().messages.parse({
    model: FAST_MODEL,
    max_tokens: 500,
    system: `You review one sentence from a sales email sent to ${company.name}. Decide if it states a specific fact about ${company.name}: an event, number, date, ranking, person, customer or achievement. Sentences describing the seller's own product or customers, questions, calls to action, and opinions are not facts about ${company.name}.`,
    messages: [{ role: "user", content: `Sentence: "${sentence.text}"` }],
    output_config: { format: zodOutputFormat(HiddenClaimSchema) },
  });
  const r = assertParsed(res.parsed_output, "hidden-claim");
  if (!r.statesProspectFact) return null;
  return {
    sentenceId: sentence.id,
    verdict: "UNSUPPORTED",
    rationale: `Labelled generic, but states a fact about ${company.name} with no source: ${r.fact}`,
    quote: "",
    source: "model",
  };
}

/** Hard rules in code first, then model calls for cited sentences and hidden-claim suspects, all in parallel. */
export async function verifyDraft(draft: Draft, signals: Signal[], company: Company): Promise<Verdict[]> {
  const lint = lintDraft(draft, signals);
  const [checked, hidden] = await Promise.all([
    Promise.all(sentencesToVerify(draft, lint).map((s) => verifySentence(s, signals))),
    Promise.all(hiddenClaimSuspects(draft, company).map((s) => checkHiddenClaim(s, company))),
  ]);
  const byId = new Map([...lint, ...checked, ...hidden.filter((v) => v !== null)].map((v) => [v.sentenceId, v]));
  return draft.sentences.flatMap((s) => (byId.has(s.id) ? [byId.get(s.id)!] : []));
}
