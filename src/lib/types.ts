import * as z from "zod";
import type { Assessment, FitCriteria } from "./assess";

export const SIGNAL_TYPES = [
  "funding",
  "exec_hire",
  "hiring_surge",
  "launch",
  "expansion",
  "partnership",
  "tech_change",
  "news",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

/** Signals the seller's own team adds (CRM, website, product). They never come from web research. */
export const OWN_SIGNAL_TYPES = ["demo_request", "pricing_visit", "champion_move", "product_usage"] as const;
export type OwnSignalType = (typeof OWN_SIGNAL_TYPES)[number];
export type AnySignalType = SignalType | OwnSignalType;

export const FUNDING_STAGES = [
  "unknown",
  "bootstrapped",
  "seed",
  "series_a",
  "series_b",
  "series_c",
  "series_d_plus",
  "public",
] as const;

export const CompanySchema = z.object({
  name: z.string(),
  domain: z.string(),
  industry: z.string().describe("Short industry label, e.g. 'fintech', 'devtools'"),
  fundingStage: z.enum(FUNDING_STAGES),
  employeeRange: z.string().describe("e.g. '201-500', or 'unknown'"),
  oneLiner: z.string().describe("What the company does, one sentence"),
});
export type Company = z.infer<typeof CompanySchema>;

export const SignalSchema = z.object({
  id: z.string().describe("sig_1, sig_2, ..."),
  type: z.enum(SIGNAL_TYPES),
  title: z.string().describe("Short headline, under 80 chars, that only restates what the snippet says"),
  date: z.string().nullable().describe("ISO date YYYY-MM-DD, or null if unknown"),
  sourceUrl: z.string(),
  sourceTitle: z.string(),
  snippet: z.string().describe("Verbatim text copied from the source, max ~400 chars"),
  icpRelevance: z.number().int().min(0).max(3),
});
export type Signal = Omit<z.infer<typeof SignalSchema>, "type"> & {
  type: AnySignalType;
  /** Added by the seller's own team rather than found on the web. */
  own?: boolean;
  /** Set in code: the snippet was found verbatim in text the research agent actually retrieved. */
  snippetVerified?: boolean;
};

export const ContactSchema = z.object({
  role: z.string().describe("A job title only, e.g. 'VP of Revenue Operations'. Never a person's name."),
  why: z.string().describe("One short sentence on why this role cares, tied to the evidence"),
});
export type Contact = z.infer<typeof ContactSchema>;

export const SentenceSchema = z.object({
  id: z.string().describe("s1, s2, ..."),
  text: z.string(),
  cites: z.array(z.string()).describe("Signal ids that support this sentence"),
  kind: z.enum(["claim", "generic"]),
});
export type Sentence = z.infer<typeof SentenceSchema>;

export const DraftSchema = z.object({
  subject: z.string(),
  sentences: z.array(SentenceSchema),
});
export type Draft = z.infer<typeof DraftSchema>;

export const VERDICTS = ["SUPPORTED", "PARTIAL", "UNSUPPORTED", "CONTRADICTED"] as const;
export type VerdictLabel = (typeof VERDICTS)[number];

export type Verdict = {
  sentenceId: string;
  verdict: VerdictLabel;
  rationale: string;
  /** Evidence quote the verifier pointed at; checked in code to be a substring of a cited snippet. */
  quote: string;
  /** Which check produced this verdict. */
  source: "lint" | "model" | "quote_check" | "detail_check";
};

export type ScoreReason = { signalId: string; label: string; contribution: number };
export type ScoreResult = { score: number; raw: number; reasons: ScoreReason[] };

export const JudgeSchema = z.object({
  specificity: z.object({ score: z.number().int().min(1).max(5), reason: z.string() }),
  relevance: z.object({ score: z.number().int().min(1).max(5), reason: z.string() }),
  tone: z.object({ score: z.number().int().min(1).max(5), reason: z.string() }),
  spamRisk: z
    .object({ score: z.number().int().min(1).max(5), reason: z.string() })
    .describe("5 = very low spam risk, 1 = very spammy"),
});
export type Judge = z.infer<typeof JudgeSchema>;

export type StageName = "research" | "score" | "draft" | "verify" | "judge";
export type StageStatus = "running" | "done" | "skipped" | "error";

export type RunMode = "live" | "cached" | "recorded" | "sample";

export type RunInput = { domain: string; icp: string };

/** Everything a run produces. Also the on-disk fixture format. */
export type RunRecord = {
  input: RunInput;
  asOf: string; // ISO date the run happened; scoring recency is relative to this
  company: Company;
  signals: Signal[];
  /** Fit criteria Claude extracted from input.icp. */
  criteria?: FitCriteria;
  /** Who on the target's team to reach out to. */
  contact?: Contact;
  draft: Draft; // first draft, before checks
  verdicts: Verdict[]; // verdicts on the first draft
  repairs: { sentences: Sentence[]; verdicts: Verdict[]; removed: string[] } | null;
  final: Draft;
  judge: Judge | null;
  /** Pre-recorded result of the "inject a hallucination" demo, used when live mode is off. */
  injected?: { sentence: Sentence; verdict: Verdict };
  sample?: boolean;
};

export type RunEvent =
  | { type: "meta"; mode: RunMode; sample: boolean }
  | { type: "stage"; stage: StageName; status: StageStatus; note?: string }
  | { type: "company"; company: Company }
  | { type: "signals"; signals: Signal[] }
  | { type: "score"; score: ScoreResult }
  | { type: "assessment"; assessment: Assessment; criteria: FitCriteria; asOf: string }
  | { type: "contact"; contact: Contact }
  | { type: "draft"; draft: Draft }
  | { type: "verdicts"; verdicts: Verdict[] }
  | { type: "repairs"; repairs: NonNullable<RunRecord["repairs"]> }
  | { type: "final"; draft: Draft }
  | { type: "judge"; judge: Judge }
  | { type: "record"; record: RunRecord }
  | { type: "error"; message: string }
  | { type: "done" };
