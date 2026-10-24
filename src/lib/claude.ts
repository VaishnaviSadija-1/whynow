import Anthropic from "@anthropic-ai/sdk";

/** Sonnet 5 does the open-ended work: research with tools, writing, repair, play compiling. */
export const SMART_MODEL = "claude-sonnet-5";
/** Haiku 4.5 does narrow, cheap jobs: extraction, hidden-claim checks, judging. */
export const FAST_MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claude(): Anthropic {
  if (!client) {
    const c = new Anthropic(process.env.WHYNOW_DEBUG ? { fetch: trackingFetch } : {});
    // Occasionally a structured output doesn't pass the schema check; one retry fixes it,
    // instead of failing a whole 90-second run.
    const parse = c.messages.parse.bind(c.messages);
    c.messages.parse = ((params, options) =>
      parse(params, options).catch((err: unknown) => {
        if (err instanceof Error && err.message.includes("Failed to parse structured output")) return parse(params, options);
        throw err;
      })) as typeof c.messages.parse;
    client = c;
  }
  return client;
}

/** $ per million tokens (input, output). Web search is billed per search on top. */
const PRICE: Record<string, [number, number]> = { [SMART_MODEL]: [2, 10], [FAST_MODEL]: [1, 5] };
const PRICE_PER_SEARCH = 0.01;

export const usageLog: { model: string; input: number; output: number; searches: number; fetches: number }[] = [];

/** Debug only: record token usage from every API response, so a run's cost can be measured. */
async function trackingFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  res
    .clone()
    .json()
    .then((body) => {
      const u = body?.usage;
      if (!u) return;
      usageLog.push({
        model: body.model,
        input: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        output: u.output_tokens ?? 0,
        searches: u.server_tool_use?.web_search_requests ?? 0,
        fetches: u.server_tool_use?.web_fetch_requests ?? 0,
      });
    })
    .catch(() => {});
  return res;
}

export function usageSummary() {
  const byModel = new Map<string, { calls: number; input: number; output: number }>();
  let searches = 0;
  let fetches = 0;
  let dollars = 0;
  for (const u of usageLog) {
    const m = byModel.get(u.model) ?? { calls: 0, input: 0, output: 0 };
    m.calls += 1;
    m.input += u.input;
    m.output += u.output;
    byModel.set(u.model, m);
    searches += u.searches;
    fetches += u.fetches;
    const [pin, pout] = u.model.startsWith(FAST_MODEL) ? PRICE[FAST_MODEL] : PRICE[SMART_MODEL];
    dollars += (u.input * pin + u.output * pout) / 1e6 + u.searches * PRICE_PER_SEARCH;
  }
  return { byModel: Object.fromEntries(byModel), searches, fetches, dollars: Math.round(dollars * 1000) / 1000 };
}

/** Concatenate the text blocks of a response. */
export function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function assertParsed<T>(value: T | null | undefined, stage: string): T {
  if (value == null) throw new Error(`${stage}: model returned output that didn't match the schema`);
  return value;
}
