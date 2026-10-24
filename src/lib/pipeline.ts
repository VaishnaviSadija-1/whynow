import { isFailing } from "./lint";
import { assess } from "./assess";
import { scoreSignals } from "./scoring";
import { extractCriteria } from "./stages/criteria";
import { suggestContact } from "./stages/contact";
import { draftEmail } from "./stages/draft";
import { judgeDraft } from "./stages/judge";
import { normalize } from "./stages/normalize";
import { repairDraft } from "./stages/repair";
import { research } from "./stages/research";
import { verifyDraft } from "./stages/verify";
import type { RunEvent, RunInput, RunRecord, Sentence } from "./types";

export type Emit = (e: RunEvent) => void;

const today = () => new Date().toISOString().slice(0, 10);

async function researchAndNormalize(input: RunInput, asOf: string) {
  const { notes, evidenceCorpus } = await research(input, asOf);
  return normalize(input, notes, evidenceCorpus, asOf);
}

/** Run every stage live, streaming events as each one finishes. Returns the full record for caching. */
export async function runLive(input: RunInput, emit: Emit): Promise<RunRecord | null> {
  const asOf = today();
  // Runs alongside research, so fit criteria are ready by the time signals are.
  const criteriaP = extractCriteria(input.icp);

  emit({ type: "stage", stage: "research", status: "running", note: "Searching the web for signals" });
  let { company, signals } = await researchAndNormalize(input, asOf);
  // Web research varies run to run; one empty result gets one retry before we report "no why-now".
  if (signals.length === 0) {
    emit({ type: "stage", stage: "research", status: "running", note: "Nothing solid yet, searching again" });
    ({ company, signals } = await researchAndNormalize(input, asOf));
  }
  emit({ type: "company", company });
  emit({ type: "signals", signals });
  emit({ type: "stage", stage: "research", status: "done" });

  emit({ type: "stage", stage: "score", status: "running" });
  const score = scoreSignals(signals, asOf);
  emit({ type: "score", score });
  const [criteria, contact] = await Promise.all([criteriaP, signals.length ? suggestContact(input.icp, company, signals) : null]);
  emit({ type: "assessment", assessment: assess(company, signals, criteria, asOf), criteria, asOf });
  if (contact) emit({ type: "contact", contact });
  emit({ type: "stage", stage: "score", status: "done" });

  if (signals.length === 0) {
    for (const stage of ["draft", "verify", "judge"] as const)
      emit({ type: "stage", stage, status: "skipped", note: "No evidence found, so nothing to write about." });
    return null;
  }

  emit({ type: "stage", stage: "draft", status: "running" });
  const draft = await draftEmail(input, company, signals, score);
  emit({ type: "draft", draft });
  emit({ type: "stage", stage: "draft", status: "done" });

  emit({ type: "stage", stage: "verify", status: "running", note: "Checking every claim against its source" });
  const verdicts = await verifyDraft(draft, signals, company);
  emit({ type: "verdicts", verdicts });
  let final = draft;
  let repairs: RunRecord["repairs"] = null;
  if (verdicts.some(isFailing)) {
    emit({ type: "stage", stage: "verify", status: "running", note: "Repairing flagged sentences" });
    const r = await repairDraft(draft, verdicts, signals, company);
    repairs = r.repairs;
    final = r.final;
    emit({ type: "repairs", repairs });
  }
  emit({ type: "final", draft: final });
  emit({ type: "stage", stage: "verify", status: "done" });

  emit({ type: "stage", stage: "judge", status: "running" });
  const judge = await judgeDraft(input, final);
  emit({ type: "judge", judge });
  emit({ type: "stage", stage: "judge", status: "done" });

  return { input, asOf, company, signals, criteria, contact: contact ?? undefined, draft, verdicts, repairs, final, judge };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Replay a recorded run through the same event stream the live pipeline uses.
 * The score is recomputed by the same deterministic function, not read from the file.
 */
export async function replay(record: RunRecord, emit: Emit, pace = 1): Promise<void> {
  const wait = (ms: number) => sleep(ms * pace);
  emit({ type: "stage", stage: "research", status: "running", note: "Searching the web for signals" });
  await wait(1400);
  emit({ type: "company", company: record.company });
  emit({ type: "signals", signals: record.signals });
  emit({ type: "stage", stage: "research", status: "done" });

  emit({ type: "stage", stage: "score", status: "running" });
  await wait(300);
  emit({ type: "score", score: scoreSignals(record.signals, record.asOf) });
  if (record.criteria)
    emit({ type: "assessment", assessment: assess(record.company, record.signals, record.criteria, record.asOf), criteria: record.criteria, asOf: record.asOf });
  if (record.contact) emit({ type: "contact", contact: record.contact });
  emit({ type: "stage", stage: "score", status: "done" });

  emit({ type: "stage", stage: "draft", status: "running" });
  await wait(1100);
  emit({ type: "draft", draft: record.draft });
  emit({ type: "stage", stage: "draft", status: "done" });

  emit({ type: "stage", stage: "verify", status: "running", note: "Checking every claim against its source" });
  await wait(1000);
  emit({ type: "verdicts", verdicts: record.verdicts });
  if (record.repairs) {
    emit({ type: "stage", stage: "verify", status: "running", note: "Repairing flagged sentences" });
    await wait(900);
    emit({ type: "repairs", repairs: record.repairs });
  }
  emit({ type: "final", draft: record.final });
  emit({ type: "stage", stage: "verify", status: "done" });

  if (record.judge) {
    emit({ type: "stage", stage: "judge", status: "running" });
    await wait(600);
    emit({ type: "judge", judge: record.judge });
    emit({ type: "stage", stage: "judge", status: "done" });
  }
}

/**
 * The "inject a hallucination" demo: a claim that sounds plausible and cites a
 * real signal, but adds a number the source never states.
 */
export function fabricatedClaim(record: Pick<RunRecord, "signals" | "company" | "final">): Sentence {
  const target = record.signals[0];
  return {
    id: "s_injected",
    text: `I saw ${record.company.name} also tripled revenue to $400M this year, which must be putting real pressure on the team.`,
    cites: target ? [target.id] : [],
    kind: "claim",
  };
}
