import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { assertParsed, claude, FAST_MODEL } from "../claude";
import { ContactSchema, type Company, type Contact, type Signal } from "../types";

/** Which role at the target company should the rep write to? A title, never a person. */
export async function suggestContact(icp: string, company: Company, signals: Signal[]): Promise<Contact> {
  const evidence = signals.slice(0, 5).map((s) => `- ${s.title}`).join("\n") || "- (no recent signals)";
  const res = await claude().messages.parse({
    model: FAST_MODEL,
    max_tokens: 400,
    system:
      "You tell a sales rep which role at a target company to contact. Choose the single job title most likely to own the problem the seller solves, using the company's size, stage and recent signals. Give a title only, never a name. Keep 'why' to one short sentence that points at the evidence.",
    messages: [{ role: "user", content: `Seller: ${icp}\n\nTarget: ${company.name}, ${company.oneLiner} (${company.employeeRange} people)\n\nRecent signals:\n${evidence}` }],
    output_config: { format: zodOutputFormat(ContactSchema) },
  });
  return assertParsed(res.parsed_output, "contact");
}
