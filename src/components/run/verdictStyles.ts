/** Shared colors and labels for fit and timing verdicts (demo page and accounts list). */
export const TIMING_STYLE = {
  closing: { tone: "text-warn", chip: "bg-warn-soft text-warn", label: "Reach out this week" },
  now: { tone: "text-ok", chip: "bg-ok-soft text-ok", label: "Reach out now" },
  watch: { tone: "text-muted", chip: "bg-paper text-muted border border-line", label: "Watch" },
  none: { tone: "text-muted", chip: "bg-paper text-muted border border-line", label: "No signals" },
} as const;

export const FIT_STYLE = {
  strong: { chip: "bg-ok-soft text-ok", label: "Strong fit" },
  moderate: { chip: "bg-warn-soft text-warn", label: "Possible fit" },
  weak: { chip: "bg-bad-soft text-bad", label: "Poor fit" },
} as const;
