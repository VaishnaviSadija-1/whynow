import { greetingName } from "@/components/run/DraftReview";
import { describe, expect, it } from "vitest";
import { findFixture, FIXTURES } from "./fixtures";
import { enforceDetails, enforceQuote, hiddenClaimSuspects, lintDraft, looksLikeHiddenClaim, quoteIsIn } from "./lint";
import { cleanSignals } from "./stages/normalize";
import { recencyDecay, scoreSignals, UNDATED_DECAY } from "./scoring";
import type { Signal, Verdict } from "./types";

const fixture = findFixture("northwind-pay.example")!;
const recorded = FIXTURES.filter((f) => !f.sample);

const sig = (over: Partial<Signal> = {}): Signal => ({
  id: "sig_1",
  type: "funding",
  title: "Raised a round",
  date: "2026-09-01",
  sourceUrl: "https://x.example/a",
  sourceTitle: "x",
  snippet: "Acme raised $10 million",
  icpRelevance: 3,
  ...over,
});

describe("scoring", () => {
  it("is deterministic and bounded", () => {
    const a = scoreSignals(fixture.signals, fixture.asOf);
    const b = scoreSignals(fixture.signals, fixture.asOf);
    expect(a).toEqual(b);
    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.reasons).toHaveLength(3);
  });

  it("scores zero with no signals", () => {
    expect(scoreSignals([], "2026-09-29").score).toBe(0);
  });

  it("decays older signals and penalizes undated ones", () => {
    expect(recencyDecay("2026-09-29", "2026-09-29")).toBe(1);
    expect(recencyDecay("2026-06-01", "2026-09-29")).toBeLessThan(recencyDecay("2026-09-01", "2026-09-29"));
    expect(recencyDecay(null, "2026-09-29")).toBe(UNDATED_DECAY);
  });

  it("ranks a fresh, relevant funding round above stale news", () => {
    const r = scoreSignals(
      [sig({ id: "sig_1", type: "news", date: "2025-12-01", icpRelevance: 0 }), sig({ id: "sig_2" })],
      "2026-09-29",
    );
    expect(r.reasons[0].signalId).toBe("sig_2");
  });
});

describe("quote matching", () => {
  it("ignores case, whitespace and curly quotes", () => {
    expect(quoteIsIn("We’re  excited", "we're excited to welcome")).toBe(true);
  });
  it("rejects empty or tiny quotes and non-matches", () => {
    expect(quoteIsIn("", "anything")).toBe(false);
    expect(quoteIsIn("abc", "abcdef")).toBe(false);
    expect(quoteIsIn("tripled revenue", "raised $80 million")).toBe(false);
  });
});

describe("citation lint", () => {
  it("passes the sample draft's hard rules, and sends the sentence naming the company for a hidden-claim check", () => {
    expect(lintDraft(fixture.draft, fixture.signals)).toEqual([]);
    expect(hiddenClaimSuspects(fixture.draft, fixture.company).map((s) => s.id)).toEqual(["s4"]);
  });
  it("flags claims with no citation and citations to unknown signals", () => {
    const draft = {
      subject: "",
      sentences: [
        { id: "s1", text: "You raised money.", cites: [], kind: "claim" as const },
        { id: "s2", text: "You raised money.", cites: ["sig_9"], kind: "claim" as const },
        { id: "s3", text: "Worth a chat?", cites: [], kind: "generic" as const },
      ],
    };
    expect(lintDraft(draft, [sig()]).map((x) => x.sentenceId)).toEqual(["s1", "s2"]);
  });
  it("detects numbers, months and the company name as hidden claims", () => {
    expect(looksLikeHiddenClaim("You grew 3x", { name: "Acme" })).toBe(true);
    expect(looksLikeHiddenClaim("Since March things changed", { name: "Acme" })).toBe(true);
    expect(looksLikeHiddenClaim("acme is growing", { name: "Acme" })).toBe(true);
    expect(looksLikeHiddenClaim("Worth a quick chat?", { name: "Acme" })).toBe(false);
  });
});

describe("enforceQuote", () => {
  const base: Verdict = { sentenceId: "s1", verdict: "SUPPORTED", rationale: "ok", quote: "raised $10 million", source: "model" };
  it("keeps a positive verdict whose quote is in the source", () => {
    expect(enforceQuote(base, ["Acme raised $10 million"]).verdict).toBe("SUPPORTED");
  });
  it("downgrades a positive verdict with an invented quote", () => {
    const v = enforceQuote({ ...base, quote: "tripled revenue" }, ["Acme raised $10 million"]);
    expect(v.verdict).toBe("UNSUPPORTED");
    expect(v.source).toBe("quote_check");
  });
  it("accepts a quote stitched from two snippets, but not if any piece is invented", () => {
    const snippets = ["Acme raised $10 million", "Acme hired a new CRO"];
    expect(enforceQuote({ ...base, quote: "raised $10 million ... hired a new CRO" }, snippets).verdict).toBe("SUPPORTED");
    expect(enforceQuote({ ...base, quote: "raised $10 million … tripled revenue" }, snippets).verdict).toBe("UNSUPPORTED");
  });
  it("leaves negative verdicts alone", () => {
    expect(enforceQuote({ ...base, verdict: "CONTRADICTED", quote: "" }, []).verdict).toBe("CONTRADICTED");
  });
});

describe("greetingName", () => {
  it("uses the first name of a found contact, and a placeholder for a bare title", () => {
    expect(greetingName("Nick Bogaty, Chief Revenue Officer")).toBe("Nick");
    expect(greetingName("Chief Revenue Officer")).toBe("{first name}");
    expect(greetingName(undefined)).toBe("{first name}");
  });
});

describe("enforceDetails", () => {
  const base: Verdict = { sentenceId: "s1", verdict: "PARTIAL", rationale: "ok", quote: "raised", source: "model" };
  it("fails a sentence when the model lists any unsupported detail", () => {
    const v = enforceDetails(base, ["led by Sequoia"]);
    expect(v.verdict).toBe("UNSUPPORTED");
    expect(v.source).toBe("detail_check");
  });
  it("keeps the verdict when nothing is listed", () => {
    expect(enforceDetails(base, [" "]).verdict).toBe("PARTIAL");
  });
});

describe("cleanSignals", () => {
  it("drops stale and URL-less signals, dedupes, renumbers and verifies snippets", () => {
    const out = cleanSignals(
      [
        sig({ id: "a" }),
        sig({ id: "b" }), // duplicate
        sig({ id: "c", sourceUrl: "not a url" }),
        sig({ id: "d", title: "Old news", type: "news", date: "2024-01-01" }),
        sig({ id: "e", title: "Hiring", type: "hiring_surge", snippet: "made up text here" }),
      ],
      "... Acme raised $10 million in new funding ...",
      "2026-09-29",
    );
    expect(out.map((s) => s.id)).toEqual(["sig_1", "sig_2"]);
    expect(out.map((s) => s.snippetVerified)).toEqual([true, false]);
  });
});

describe("recorded fixtures", () => {
  it.each(recorded.map((f) => [f.input.domain, f] as const))("%s: final draft only contains sentences that passed", (_, f) => {
    const failed = new Set(
      [...f.verdicts, ...(f.repairs?.verdicts ?? [])].filter((v) => v.verdict === "UNSUPPORTED" || v.verdict === "CONTRADICTED").map((v) => v.sentenceId),
    );
    const repairedOk = new Set((f.repairs?.verdicts ?? []).filter((v) => v.verdict !== "UNSUPPORTED" && v.verdict !== "CONTRADICTED").map((v) => v.sentenceId));
    for (const s of f.final.sentences) expect(!failed.has(s.id) || repairedOk.has(s.id)).toBe(true);
  });
});

describe("sample fixture", () => {
  it("is internally consistent: every verdict and citation points at something real", () => {
    const sentenceIds = new Set(fixture.draft.sentences.map((s) => s.id));
    const signalIds = new Set(fixture.signals.map((s) => s.id));
    expect(fixture.verdicts.every((v) => sentenceIds.has(v.sentenceId))).toBe(true);
    expect(fixture.final.sentences.flatMap((s) => s.cites).every((c) => signalIds.has(c))).toBe(true);
    for (const v of [...fixture.verdicts, ...fixture.repairs!.verdicts]) {
      if (v.verdict === "SUPPORTED" || v.verdict === "PARTIAL") {
        const s = [...fixture.draft.sentences, ...fixture.repairs!.sentences].find((x) => x.id === v.sentenceId)!;
        const snippets = fixture.signals.filter((g) => s.cites.includes(g.id)).map((g) => g.snippet);
        expect(enforceQuote(v, snippets).verdict).toBe(v.verdict);
      }
    }
  });
});
