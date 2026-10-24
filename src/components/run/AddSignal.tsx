"use client";

import { useState } from "react";
import { OWN_SIGNAL_TYPES, type OwnSignalType, type Signal } from "@/lib/types";

export const OWN_LABEL: Record<OwnSignalType, string> = {
  demo_request: "Asked for a demo",
  pricing_visit: "Visited the pricing page",
  champion_move: "Past champion joined them",
  product_usage: "Active in a free trial",
};

/** The seller's own data (CRM, website, product), layered on top of what the web says. */
export function AddSignal({ asOf, count, onAdd }: { asOf: string; count: number; onAdd: (s: Signal) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<OwnSignalType>("pricing_visit");
  const [date, setDate] = useState(asOf);
  const [note, setNote] = useState("");

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-accent hover:bg-accent-soft">
        + Add your own signal
      </button>
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: `own_${count + 1}`,
      type,
      own: true,
      title: OWN_LABEL[type],
      date,
      sourceUrl: "",
      sourceTitle: "Your team",
      snippet: note.trim() || OWN_LABEL[type],
      icpRelevance: 3,
    });
    setNote("");
    setOpen(false);
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-card p-4">
      <p className="text-sm text-muted">Something only your team knows about this account. It joins the timeline and changes the timing.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <label className="block">
          <span className="text-xs text-muted">What happened</span>
          <select value={type} onChange={(e) => setType(e.target.value as OwnSignalType)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent">
            {OWN_SIGNAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {OWN_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">When</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs text-muted">Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. Visited 3 times this week" className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
      </label>
      <div className="mt-3 flex gap-2">
        <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90">
          Add signal
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}
