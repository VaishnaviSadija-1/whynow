"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { FixtureSummary } from "@/lib/fixtures";
import type { RunEvent } from "@/lib/types";
import { assess, stageLabel } from "@/lib/assess";
import { scoreSignals } from "@/lib/scoring";
import type { Signal } from "@/lib/types";
import { AddSignal } from "./AddSignal";
import { DraftReview, FinalEmail } from "./DraftReview";
import { SignalTimeline } from "./SignalTimeline";
import { VerdictCard } from "./VerdictCard";
import { SignalCard } from "./SignalCard";
import { StageRail } from "./StageRail";
import { initialState, LAST_RUN_KEY, reducer } from "./state";



const DEFAULT_ICP =
  "We sell RevOps analytics that gives sales leaders one trusted view of pipeline, for Series B+ B2B companies scaling their go-to-market team.";

type Status = { live: boolean; fixtures: FixtureSummary[] };

export function RunWorkspace({ initialDomain }: { initialDomain?: string }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [status, setStatus] = useState<Status | null>(null);
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [icp, setIcp] = useState(DEFAULT_ICP);
  const [formError, setFormError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [injecting, setInjecting] = useState(false);
  const [ownSignals, setOwnSignals] = useState<Signal[]>([]);
  const autoStarted = useRef(false);
  const icpRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = icpRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [icp]);

  const run = useCallback(async (d: string, i: string) => {
    setFormError(null);
    setHighlight([]);
    setOwnSignals([]);
    dispatch({ type: "start" });
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d, icp: i }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        dispatch({ type: "fail", message: body.error ?? "Couldn't start the run." });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RunEvent;
          dispatch({ type: "event", event });
          if (event.type === "record") {
            try {
              sessionStorage.setItem(LAST_RUN_KEY, JSON.stringify(event.record));
            } catch {}
          }
        }
      }
    } catch {
      dispatch({ type: "fail", message: "Lost the connection mid-run. Try again." });
    }
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: Status) => {
        setStatus(s);
        const f = s.fixtures.find((x) => x.domain === initialDomain);
        if (f && !autoStarted.current) {
          autoStarted.current = true;
          setIcp(f.icp);
          run(f.domain, f.icp);
        }
      })
      .catch(() => setStatus({ live: false, fixtures: [] }));
  }, [initialDomain, run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return setFormError("Enter a company domain, like acme.com.");
    if (icp.trim().length < 15) return setFormError("Describe what you sell in at least 15 characters.");
    run(domain, icp);
  };

  const inject = async () => {
    if (!state.record) return;
    setInjecting(true);
    try {
      const res = await fetch("/api/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.record),
      });
      const body = await res.json();
      if (res.ok) dispatch({ type: "injected", value: body });
    } finally {
      setInjecting(false);
    }
  };

  // Your own signals join the web signals; fit, timing and score are plain code, so they recompute instantly.
  const signals = [...state.signals, ...ownSignals];
  const assessment =
    ownSignals.length && state.company && state.criteria && state.asOf
      ? assess(state.company, signals, state.criteria, state.asOf)
      : state.assessment;
  const score = ownSignals.length && state.asOf ? scoreSignals(signals, state.asOf) : state.score;

  const running = state.phase === "running";
  const verifying = state.stages.verify?.status === "running";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <form onSubmit={submit} className="rounded-xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Who are you prospecting?</span>
          {status?.fixtures.map((f) => (
            <button
              type="button"
              key={f.domain}
              disabled={running}
              onClick={() => {
                setDomain(f.domain);
                setIcp(f.icp);
                run(f.domain, f.icp);
              }}
              className="rounded-full border border-line px-3 py-1 text-xs hover:border-faint disabled:opacity-50"
            >
              {f.name}
            </button>
          ))}
          <span className="ml-auto text-xs text-faint">
            {status ? (status.live ? "Live runs on" : "Live runs off: sample accounts only") : ""}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block sm:max-w-xs">
            <span className="text-xs text-muted">Company domain</span>
            <input
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setFormError(null);
              }}
              placeholder="acme.com"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">What you sell, and to whom</span>
            <textarea
              ref={icpRef}
              value={icp}
              rows={2}
              onChange={(e) => {
                setIcp(e.target.value);
                setFormError(null);
              }}
              className="mt-1 block w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {formError && <p className="text-sm text-bad">{formError}</p>}
            <button
              type="submit"
              disabled={running}
              className="ml-auto w-full rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {running ? "Running…" : "Find why now"}
            </button>
          </div>
        </div>
      </form>

      {state.phase === "idle" ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <StageRail stages={state.stages} phase={state.phase} />
            {state.mode === "sample" && <p className="mt-4 px-3 text-xs text-faint">Fictional sample company.</p>}
          </aside>

          <div className="min-w-0 space-y-10">
            {state.error && (
              <div className="rounded-lg border border-bad/30 bg-bad-soft p-4 text-sm text-bad">{state.error}</div>
            )}

            {state.company && (
              <section className="rise">
                <h1 className="font-display text-4xl">{state.company.name}</h1>
                <p className="mt-1 text-muted">{state.company.oneLiner}</p>
                <p className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                  {[state.company.industry, stageLabel(state.company.fundingStage), `${state.company.employeeRange} employees`].map((t) => (
                    <span key={t} className="rounded-full border border-line px-2 py-0.5">
                      {t}
                    </span>
                  ))}
                </p>
              </section>
            )}

            {state.company && assessment && (
              <VerdictCard company={state.company} assessment={assessment} score={score} contact={state.contact} />
            )}

            {(signals.length > 0 || state.score) && (
              <section className="space-y-3">
                <SectionTitle title="Signals" />
                {state.asOf && <SignalTimeline signals={signals} asOf={state.asOf} />}
                {signals.map((s, i) => (
                  <SignalCard
                    key={s.id}
                    signal={s}
                    index={i}
                    highlighted={highlight.includes(s.id)}
                    onRemove={s.own ? () => setOwnSignals((o) => o.filter((x) => x.id !== s.id)) : undefined}
                  />
                ))}
                {state.phase === "done" && state.asOf && (
                  <AddSignal asOf={state.asOf} count={Math.max(0, ...ownSignals.map((o) => Number(o.id.slice(4))))} onAdd={(s) => setOwnSignals((o) => [...o, s])} />
                )}
                {signals.length === 0 && state.score && (
                  <p className="rounded-lg border border-line bg-card p-4 text-sm text-muted">
                    No recent, sourced signals found. That&apos;s a real answer: there&apos;s no reason to reach out to this
                    account yet.
                  </p>
                )}
              </section>
            )}

            {state.final && (
              <section className="space-y-3">
                <SectionTitle
                  title="Draft outreach"
                  hint={state.assessment?.timing.verdict === "watch" ? "Ready for when the next trigger lands." : undefined}
                />
                <FinalEmail draft={state.final} signals={state.signals} companyName={state.company?.name} />
              </section>
            )}

            {state.draft && (
              <details className="group rounded-2xl border border-line bg-card px-5 py-4 sm:px-6">
                <summary className="cursor-pointer list-none text-sm text-muted marker:hidden hover:text-ink">
                  <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                  How every sentence was fact-checked
                </summary>
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-faint">Click a sentence to see its source.</p>
                    {state.record && (
                      <button
                        onClick={inject}
                        disabled={injecting || Boolean(state.injected)}
                        className="ml-auto rounded-lg border border-bad/40 px-3 py-1.5 text-xs font-medium text-bad hover:bg-bad-soft disabled:opacity-50"
                      >
                        {injecting ? "Checking…" : state.injected ? "Hallucination injected" : "Inject a hallucination"}
                      </button>
                    )}
                  </div>
                  <DraftReview
                    draft={state.draft}
                    verdicts={state.verdicts}
                    repairs={state.repairs}
                    signals={state.signals}
                    checking={verifying}
                    injected={state.injected}
                    onSelectCites={setHighlight}
                  />
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-faint">{hint}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 text-center">
      <p className="font-display text-3xl">Pick an account, or enter any company.</p>
      <p className="mt-2 text-sm text-muted">
        WhyNow finds its recent signals, then tells you if it&apos;s the right company and the right time.
      </p>
    </div>
  );
}
