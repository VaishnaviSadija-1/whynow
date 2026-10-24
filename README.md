# WhyNow

**Know which companies to call, and exactly when.**

[**Live demo**](https://whynow-theta.vercel.app) · [Accounts view](https://whynow-theta.vercel.app/accounts)

> A portfolio prototype, not a product. I built it to show how I think about GTM engineering: what a sales team actually needs to know, and where AI should and shouldn't make the call.

Sales reps lose time on accounts that either aren't a fit or aren't ready yet. WhyNow answers three questions for any company:

1. **What's happening there?** Recent buying signals from the web, each with a date, a source and the exact quote.
2. **Is it the right company?** Checked against what *you* sell.
3. **Is now the right time?** Each signal keeps an account warm for a set window. When the window closes, the answer is "wait", not a stale "congrats on the launch".

## What's in it

| | |
|---|---|
| **Accounts** | Ranks accounts by timing, then fit, so a team knows who to call today and who to watch. |
| **Recommendation** | One answer per company: reach out now, reach out this week, or watch. |
| **Right company?** | You describe what you sell in plain English. It becomes checks (industry, stage, size, need) with a ✓ ✗ ? for each. |
| **Right time?** | A window bar shows how many days are left. The why-now score is a formula you can read. |
| **Who to contact** | The job title most likely to own the problem, with one line on why. Titles only, never names. |
| **Your own signals** | Add what only your team knows (pricing-page visit, demo request, past champion). It joins the timeline and the timing updates instantly. |
| **Signal timeline** | Every signal as a dot on its date, with a bar for how long it stays warm. |
| **Outreach draft** | A short email where every claim cites a signal. |
| **Fact-check** | Every sentence is checked against its source quote. Unsupported claims are repaired or cut. A button injects a fake claim so you can watch it get caught. |

## The design idea

**The AI reads and writes. Code decides.**

- Claude finds the evidence, turns "what you sell" into criteria, suggests a contact role and drafts the email.
- Plain code decides fit, timing, the why-now score and the ranking. The same evidence always gives the same answer, and every verdict can be explained line by line.
- Anything the AI says must show its work: signals carry a verbatim quote, and the fact-checker returns the evidence quote that code then verifies is really in the source.

## How a run works

1. **Signals** (Claude Sonnet + server-side web search and fetch). Recent company-level events, each with a verbatim quote and date. The research prefers the newest source and checks whether announced plans actually happened.
2. **Normalize** (Haiku, then code). A strict `Signal[]` schema. Code drops stale or URL-less signals and checks each quote against text the agent actually retrieved.
3. **Right company?** (Haiku, then code). Claude extracts criteria from the seller's description. Code checks the company against each one.
4. **Right time?** (code only). Windows by signal type: new exec 120 days, funding 120, launch 90, news 30, and shorter for your own signals (pricing visit 14, demo request 30). The strongest open window decides.
5. **Priority** (code only). Sort by timing, then fit, then score.
6. **Who to contact** (Haiku). One job title, tied to the evidence.
7. **Outreach** (Sonnet + code). A cited draft, time-aware (an old plan can't be stated as current), fact-checked sentence by sentence, repaired once or cut.

## Does the fact-checker work?

I built a small eval of 36 labelled claims: 21 fabricated, 15 faithful.

- **21 of 21** fabrications caught
- **0 of 15** false alarms

Results are in [`src/data/eval-results.json`](src/data/eval-results.json). It runs with `npm run eval`.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Without an API key the app runs on recorded accounts only: they replay through the same code path and UI as a live run. To enable live runs on any company:

```bash
export ANTHROPIC_API_KEY=...
npm run dev
```

| Env var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Enables live runs |
| `LIVE_MODE` | on | Set to `off` as a kill switch (recorded runs only) |
| `LIVE_RUNS_PER_IP` | 5 | Live runs per visitor per day |
| `LIVE_RUNS_PER_DAY` | 25 | Global live runs per day (a live run costs about $0.22) |

## Tests

```bash
npm test             # scoring, fit and timing, citation rules, quote check, fixture consistency
npm run eval         # fact-checker eval (calls Claude)
npm run record -- ramp.com "We sell ..."   # record a real run as a replayable demo account
```

## Make it yours

Your name and links live in [`src/lib/site.ts`](src/lib/site.ts). The demo accounts are recorded runs in `src/data/fixtures/`, listed in `src/lib/fixtures.ts`. Northwind Pay is a fictional sample company, so its sources are placeholders.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Anthropic SDK with structured outputs, web search and web fetch · Zod · Vitest · Vercel

## Known limits (it's a prototype)

- Rate limits and the 24-hour run cache are in memory and reset on a serverless cold start. A real deployment would use a shared store.
- Window lengths and score weights are hand-set. The next step is to fit them to outcomes such as replies and meetings.
- Your own signals are typed in by hand and don't change the email draft. There's no CRM connection yet.
- The research agent only uses public web sources and skips LinkedIn.
- Web research varies from run to run, and a live run takes about 90-120 seconds, so the demo leads with recorded accounts.
- Quotes seen only in search results (not fetched pages) can't be re-checked word for word, so they're labelled "From search result".

## What I'd build next

- **Your data, connected:** CRM activity, website visits and product usage next to public signals.
- **Always watching:** re-check every account daily and alert the rep the moment a window opens.
- **Timing that learns:** tune windows and weights from which outreach got replies and meetings.
- **Who to contact:** map the buying team for each account and route it to the right rep.

---

Built by [Vaishnavi Sadija](https://www.linkedin.com/in/vaishnavi-sadija-886705221/).
