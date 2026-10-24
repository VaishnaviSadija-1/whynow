import type { Assessment, FitCriteria } from "@/lib/assess";
import type {
  Company,
  Contact,
  Draft,
  Judge,
  RunEvent,
  RunMode,
  RunRecord,
  ScoreResult,
  Sentence,
  Signal,
  StageName,
  StageStatus,
  Verdict,
} from "@/lib/types";

export const STAGES: { id: StageName; label: string; tags: ("ai" | "code")[] }[] = [
  { id: "research", label: "Find signals", tags: ["ai"] },
  { id: "score", label: "Fit and timing", tags: ["code"] },
  { id: "draft", label: "Draft outreach", tags: ["ai"] },
  { id: "verify", label: "Fact-check", tags: ["code", "ai"] },
];

export type RunState = {
  phase: "idle" | "running" | "done" | "error";
  mode: RunMode | null;
  sample: boolean;
  stages: Partial<Record<StageName, { status: StageStatus; note?: string }>>;
  company: Company | null;
  signals: Signal[];
  score: ScoreResult | null;
  assessment: Assessment | null;
  criteria: FitCriteria | null;
  contact: Contact | null;
  asOf: string | null;
  draft: Draft | null;
  verdicts: Verdict[];
  repairs: RunRecord["repairs"];
  final: Draft | null;
  judge: Judge | null;
  record: RunRecord | null;
  error: string | null;
  injected: { sentence: Sentence; verdict: Verdict; live: boolean } | null;
};

export const initialState: RunState = {
  phase: "idle",
  mode: null,
  sample: false,
  stages: {},
  company: null,
  signals: [],
  score: null,
  assessment: null,
  criteria: null,
  contact: null,
  asOf: null,
  draft: null,
  verdicts: [],
  repairs: null,
  final: null,
  judge: null,
  record: null,
  error: null,
  injected: null,
};

export type Action =
  | { type: "start" }
  | { type: "event"; event: RunEvent }
  | { type: "fail"; message: string }
  | { type: "injected"; value: NonNullable<RunState["injected"]> };

export function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "start":
      return { ...initialState, phase: "running" };
    case "fail":
      return { ...state, phase: "error", error: action.message };
    case "injected":
      return { ...state, injected: action.value };
    case "event": {
      const e = action.event;
      switch (e.type) {
        case "meta":
          return { ...state, mode: e.mode, sample: e.sample };
        case "stage":
          return { ...state, stages: { ...state.stages, [e.stage]: { status: e.status, note: e.note } } };
        case "company":
          return { ...state, company: e.company };
        case "signals":
          return { ...state, signals: e.signals };
        case "score":
          return { ...state, score: e.score };
        case "assessment":
          return { ...state, assessment: e.assessment, criteria: e.criteria, asOf: e.asOf };
        case "contact":
          return { ...state, contact: e.contact };
        case "draft":
          return { ...state, draft: e.draft };
        case "verdicts":
          return { ...state, verdicts: e.verdicts };
        case "repairs":
          return { ...state, repairs: e.repairs };
        case "final":
          return { ...state, final: e.draft };
        case "judge":
          return { ...state, judge: e.judge };
        case "record":
          return { ...state, record: e.record };
        case "error":
          return { ...state, phase: "error", error: e.message };
        case "done":
          return { ...state, phase: "done" };
      }
    }
  }
}

export const LAST_RUN_KEY = "whynow:last-run";
