import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { assertParsed, claude, FAST_MODEL } from "../claude";
import { JudgeSchema, type Draft, type Judge, type RunInput } from "../types";

/** A different model from the writer grades the final draft against a fixed rubric. */
export async function judgeDraft(input: RunInput, draft: Draft): Promise<Judge> {
  const res = await claude().messages.parse({
    model: FAST_MODEL,
    max_tokens: 1500,
    system: `You grade B2B cold emails on a 1-5 scale. Be critical; 5 is rare.
- specificity: does it reference concrete, prospect-specific facts instead of generic flattery?
- relevance: does it connect those facts to the seller's offer in a way the prospect would care about?
- tone: human, concise, not pushy?
- spamRisk: 5 = reads like a note from a person; 1 = spam-filter bait (hype words, excessive links, fake urgency).`,
    messages: [
      {
        role: "user",
        content: `Seller's ICP / offer: ${input.icp}

Subject: ${draft.subject}
${draft.sentences.map((s) => s.text).join(" ")}`,
      },
    ],
    output_config: { format: zodOutputFormat(JudgeSchema) },
  });
  return assertParsed(res.parsed_output, "judge");
}
