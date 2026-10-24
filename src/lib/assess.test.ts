import { describe, expect, it } from "vitest";
import { assessFit, assessTiming, headcount, priority, stageLabel, type FitCriteria } from "./assess";
import { findFixture } from "./fixtures";
import type { Company, Signal } from "./types";

const company: Company = {
  name: "Acme",
  domain: "acme.com",
  industry: "fintech",
  fundingStage: "series_c",
  employeeRange: "201-500",
  oneLiner: "Payments",
};
const criteria: FitCriteria = { industries: [], minStage: "series_b", minEmployees: null, maxEmployees: null, need: "scaling sales" };
const sig = (over: Partial<Signal> = {}): Signal => ({
  id: "sig_1",
  type: "exec_hire",
  title: "New VP Sales",
  date: "2026-09-01",
  sourceUrl: "https://x.example",
  sourceTitle: "x",
  snippet: "x",
  icpRelevance: 3,
  ...over,
});

describe("fit", () => {
  it("is strong when every check passes", () => {
    expect(assessFit(company, [sig()], criteria).level).toBe("strong");
  });
  it("is weak when any check fails, e.g. too early a stage", () => {
    expect(assessFit({ ...company, fundingStage: "seed" }, [sig()], criteria).level).toBe("weak");
  });
  it("checks industry and size only when the seller specified them", () => {
    const f = assessFit(company, [sig()], { ...criteria, industries: ["healthcare"], minEmployees: 1000, maxEmployees: null });
    expect(f.checks.map((c) => [c.label, c.status])).toEqual([
      ["Industry", "fail"],
      ["Stage", "pass"],
      ["Size", "fail"],
      ["Need", "pass"],
    ]);
  });
  it("is only a possible fit when nothing shows the need", () => {
    expect(assessFit(company, [sig({ icpRelevance: 1 })], criteria).level).toBe("moderate");
  });
  it("parses headcounts and stage labels", () => {
    expect(headcount("1,001-5,000")).toBe(1001);
    expect(Number.isNaN(headcount("unknown"))).toBe(true);
    expect(stageLabel("series_d_plus")).toBe("Series D+");
  });
});

describe("timing", () => {
  it("says reach out now while a strong signal's window is open", () => {
    const t = assessTiming([sig({ date: "2026-09-01" })], "2026-09-30");
    expect(t.verdict).toBe("now");
    expect(t.primary?.end).toBe("2026-12-30");
  });
  it("says reach out this week when the window is about to close", () => {
    expect(assessTiming([sig({ date: "2026-06-10" })], "2026-09-30").verdict).toBe("closing");
  });
  it("says watch when every window has closed", () => {
    const t = assessTiming([sig({ date: "2025-12-01" })], "2026-09-30");
    expect(t.verdict).toBe("watch");
    expect(t.reason).toContain("went cold");
  });
  it("ignores weakly relevant and undated signals", () => {
    expect(assessTiming([sig({ icpRelevance: 1 }), sig({ id: "sig_2", date: null })], "2026-09-30").verdict).toBe("watch");
  });
  it("ranks a hot, strong-fit account above a cold one", () => {
    const hot = { fit: assessFit(company, [sig()], criteria), timing: assessTiming([sig()], "2026-09-30") };
    const cold = { fit: hot.fit, timing: assessTiming([sig({ date: "2025-01-01" })], "2026-09-30") };
    expect(priority(hot, 10)).toBeGreaterThan(priority(cold, 90));
  });
});

describe("recorded accounts", () => {
  it.each([
    ["northwind-pay.example", "now"],
    ["linear.app", "now"],
    ["fello.ai", "watch"],
    ["vercel.com", "watch"],
  ])("%s -> %s", (domain, verdict) => {
    const f = findFixture(domain)!;
    expect(f.criteria).toBeDefined();
    expect(assessTiming(f.signals, f.asOf).verdict).toBe(verdict);
  });
});

describe("your own signals", () => {
  it("a fresh pricing-page visit turns a 'watch' account into 'reach out this week'", () => {
    const f = findFixture("fello.ai")!;
    expect(assessTiming(f.signals, f.asOf).verdict).toBe("watch");
    const own = sig({ id: "own_1", type: "pricing_visit", own: true, date: f.asOf, icpRelevance: 3 });
    expect(assessTiming([...f.signals, own], f.asOf).verdict).toBe("closing");
  });
});
