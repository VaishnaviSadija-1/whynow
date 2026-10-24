/** Marks whether a step is a Claude call or plain code. Used consistently across the site. */
export function Tag({ kind }: { kind: "ai" | "code" }) {
  const ai = kind === "ai";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-wide ${
        ai ? "bg-ai-soft text-ai" : "bg-code-soft text-code"
      }`}
    >
      <span className={`h-1 w-1 rounded-full ${ai ? "bg-ai" : "bg-code"}`} aria-hidden />
      {ai ? "Claude" : "Code"}
    </span>
  );
}
