"use client";

import { useState } from "react";
import { WINDOW_DAYS, type Assessment, type Check } from "@/lib/assess";
import type { Company, Contact, ScoreResult } from "@/lib/types";
import { FIT_STYLE, TIMING_STYLE } from "./verdictStyles";

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The answer first: is this the right company, and is now the right time? */
export function VerdictCard({
  company,
  assessment,
  score,
  contact,
}: {
  company: Company;
  assessment: Assessment;
  score: ScoreResult | null;
  contact: Contact | null;
}) {
  const { fit, timing } = assessment;
  const t = TIMING_STYLE[timing.verdict];
  const [open, setOpen] = useState(false);

  return (
    <section className="rise overflow-hidden rounded-2xl border border-line bg-card">
      <div className="border-b border-line px-5 py-5 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Recommendation</p>
        <p className={`mt-2 font-display text-3xl leading-tight sm:text-4xl ${t.tone}`}>
          {timing.verdict === "watch" && fit.level !== "weak"
            ? `Good fit. Wait for the next trigger at ${company.name}.`
            : fit.level === "weak"
              ? `Not a fit for what you sell.`
              : `${timing.headline} to ${company.name}.`}
        </p>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-card px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Right company?</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FIT_STYLE[fit.level].chip}`}>{FIT_STYLE[fit.level].label}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {fit.checks.map((c) => (
              <CheckRow key={c.label} c={c} />
            ))}
          </ul>
        </div>

        <div className="bg-card px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Right time?</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.chip}`}>{t.label}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{timing.reason}</p>
          {timing.primary && <WindowBar start={timing.primary.start} end={timing.primary.end} daysLeft={timing.primary.daysLeft} />}
          {score && (
            <p className="mt-4 text-xs text-faint">
              Why-now score <span className="font-mono text-ink">{score.score}</span>/100 ·{" "}
              <button onClick={() => setOpen(!open)} className="text-accent hover:underline">
                {open ? "hide" : "how timing works"}
              </button>
            </p>
          )}
          {open && (
            <p className="mt-2 rounded-lg bg-paper p-3 text-xs leading-relaxed text-muted">
              Each signal keeps an account warm for a set time:{" "}
              {Object.entries(WINDOW_DAYS)
                .map(([k, v]) => `${k.replace("_", " ")} ${v} days`)
                .join(", ")}
              . The strongest open window decides the timing. The why-now score weighs signal type, recency and fit to
              what you sell. Both are plain code, so the same evidence always gives the same answer.
            </p>
          )}
        </div>
      </div>

      {contact && fit.level !== "weak" && (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <p className="text-sm">
            <span className="font-medium">Who to contact</span> <span className="text-faint">·</span>{" "}
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[13px] font-medium text-accent">{contact.role}</span>
          </p>
          <p className="mt-1.5 text-sm text-muted">{contact.why}</p>
        </div>
      )}
    </section>
  );
}

function CheckRow({ c }: { c: Check }) {
  const mark = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "?";
  const color = c.status === "pass" ? "text-ok" : c.status === "fail" ? "text-bad" : "text-faint";
  return (
    <li className="flex gap-2 text-sm">
      <span className={`w-3 shrink-0 ${color}`}>{mark}</span>
      <span>
        <span className="text-ink">{c.label}</span> <span className="text-muted">· {c.detail}</span>
      </span>
    </li>
  );
}

function WindowBar({ start, end, daysLeft }: { start: string; end: string; daysLeft: number }) {
  const total = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  const used = Math.min(100, Math.max(0, ((total - daysLeft) / total) * 100));
  return (
    <div className="mt-4">
      <div className="relative h-1.5 rounded-full bg-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${used}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
        <span>{fmt(start)}</span>
        <span>{daysLeft} days left</span>
        <span>{fmt(end)}</span>
      </div>
    </div>
  );
}
