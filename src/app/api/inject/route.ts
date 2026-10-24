import { liveEnabled } from "@/lib/guard";
import { lintSentence } from "@/lib/lint";
import { fabricatedClaim } from "@/lib/pipeline";
import { verifySentence } from "@/lib/stages/verify";
import type { RunRecord, Verdict } from "@/lib/types";

/**
 * "Inject a hallucination": add a fabricated claim that cites a real signal,
 * then run it through the same checks as every other sentence.
 */
export async function POST(req: Request) {
  const record = (await req.json().catch(() => null)) as RunRecord | null;
  if (!record?.signals?.length || !record.final || !record.company)
    return Response.json({ error: "Run an account first." }, { status: 400 });
  if (record.signals.length > 12 || record.signals.some((s) => s.snippet.length > 800))
    return Response.json({ error: "Record too large." }, { status: 400 });

  const sentence = fabricatedClaim(record);

  if (!liveEnabled()) {
    if (record.injected) return Response.json({ ...record.injected, live: false });
    return Response.json({ error: "Live checks are off right now." }, { status: 403 });
  }

  const lint = lintSentence(sentence, new Set(record.signals.map((s) => s.id)));
  const verdict: Verdict = lint
    ? { sentenceId: sentence.id, verdict: "UNSUPPORTED", rationale: lint, quote: "", source: "lint" }
    : await verifySentence(sentence, record.signals);
  return Response.json({ sentence, verdict, live: true });
}
