import Anthropic from "@anthropic-ai/sdk";
import { findFixture } from "@/lib/fixtures";
import {
  cacheKey,
  checkLiveQuota,
  clientIp,
  consumeLiveRun,
  getCached,
  liveEnabled,
  normalizeDomain,
  setCached,
} from "@/lib/guard";
import { replay, runLive } from "@/lib/pipeline";
import type { RunEvent } from "@/lib/types";

export const maxDuration = 300;

const json = (status: number, body: object) => Response.json(body, { status });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { domain?: string; icp?: string } | null;
  const domain = normalizeDomain(body?.domain ?? "");
  const icp = (body?.icp ?? "").trim();
  if (!domain) return json(400, { error: "Enter a company domain, like acme.com." });
  if (icp.length < 15 || icp.length > 600) return json(400, { error: "Describe what you sell in 15-600 characters." });

  const fixture = findFixture(domain);
  const cached = fixture ?? getCached(cacheKey(domain, icp));

  if (!cached) {
    if (!liveEnabled()) return json(403, { error: "Live runs are off right now. Try one of the sample accounts." });
    const quota = checkLiveQuota(clientIp(req));
    if (!quota.ok) return json(429, { error: `${quota.reason} Try one of the sample accounts.` });
    consumeLiveRun(clientIp(req));
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: RunEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (cached) {
          emit({
            type: "meta",
            mode: cached.sample ? "sample" : fixture ? "recorded" : "cached",
            sample: Boolean(cached.sample),
          });
          await replay(cached, emit, fixture ? 1 : 0.4);
          emit({ type: "record", record: cached });
        } else {
          emit({ type: "meta", mode: "live", sample: false });
          const record = await runLive({ domain, icp }, emit);
          if (record) {
            setCached(cacheKey(domain, icp), record);
            emit({ type: "record", record });
          }
        }
        emit({ type: "done" });
      } catch (err) {
        console.error("run failed", err);
        emit({ type: "error", message: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return "Claude is rate-limiting the demo right now. Try a sample account.";
  if (err instanceof Anthropic.AuthenticationError) return "The demo's API key isn't working. Try a sample account.";
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status}). Try again, or use a sample account.`;
  if (err instanceof Error && /schema|structured output/.test(err.message)) return "A stage returned malformed output. Try again.";
  return "Something went wrong mid-run. Try again, or use a sample account.";
}
