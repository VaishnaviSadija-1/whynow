import { STAGES, type RunState } from "./state";

export function StageRail({ stages, phase }: { stages: RunState["stages"]; phase: RunState["phase"] }) {
  return (
    <ol className="space-y-1">
      {STAGES.map((s) => {
        const st = stages[s.id];
        const status = st?.status ?? (phase === "error" ? "error" : "pending");
        return (
          <li key={s.id} className="rounded-lg px-3 py-2.5 data-[active=true]:bg-card" data-active={status === "running"}>
            <div className="flex items-center gap-2.5">
              <StatusDot status={status} />
              <span className={`text-sm ${status === "pending" ? "text-faint" : ""}`}>{s.label}</span>
            </div>
            {st?.note && status !== "done" && <p className="mt-1 pl-5 text-xs text-muted">{st.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "done") return <span className="grid h-3 w-3 place-items-center rounded-full bg-ok" aria-label="done" />;
  if (status === "running")
    return <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="running" />;
  if (status === "skipped") return <span className="h-3 w-3 rounded-full border border-faint" aria-label="skipped" />;
  if (status === "error") return <span className="h-3 w-3 rounded-full bg-bad" aria-label="error" />;
  return <span className="h-3 w-3 rounded-full border border-line" aria-label="pending" />;
}
