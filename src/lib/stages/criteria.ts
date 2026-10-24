import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { FitCriteriaSchema, type FitCriteria } from "../assess";
import { assertParsed, claude, FAST_MODEL } from "../claude";

/** Turn the seller's plain-English "what you sell, and to whom" into checkable fit criteria. */
export async function extractCriteria(icp: string): Promise<FitCriteria> {
  const res = await claude().messages.parse({
    model: FAST_MODEL,
    max_tokens: 800,
    system:
      "You turn a seller's description of their ideal customer into structured targeting criteria. Only include what the description states or clearly implies; leave the rest empty, null or 'unknown'. 'B2B' is not an industry.",
    messages: [{ role: "user", content: icp }],
    output_config: { format: zodOutputFormat(FitCriteriaSchema) },
  });
  return assertParsed(res.parsed_output, "criteria");
}
