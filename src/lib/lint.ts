import type { Company, Draft, Sentence, Signal, Verdict } from "./types";

/** Normalize text so quote matching ignores case, whitespace and curly quotes. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears (normalized) inside `haystack`. Empty quotes never match. */
export function quoteIsIn(quote: string, haystack: string): boolean {
  const q = normalizeText(quote).replace(/^["']|["']$/g, "");
  if (q.length < 4) return false;
  return normalizeText(haystack).includes(q);
}

const MONTHS =
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;

/**
 * A sentence labelled "generic" that contains a number, a month or the
 * prospect's name might be a claim in disguise. Code only flags suspects;
 * a model decides whether it actually states a fact about the prospect.
 */
export function looksLikeHiddenClaim(text: string, company: Pick<Company, "name">): boolean {
  if (/\d/.test(text)) return true;
  if (MONTHS.test(text)) return true;
  const t = normalizeText(text);
  return companyNameForms(company.name).some((form) => t.includes(form));
}

const GENERIC_NAME_WORDS = new Set(["inc", "labs", "technologies", "the", "company", "group", "systems"]);

/** "Northwind Pay, Inc." -> ["northwind pay, inc.", "northwind"]: people shorten names in emails. */
function companyNameForms(name: string): string[] {
  const full = normalizeText(name);
  if (full.length < 2) return [];
  const first = full.split(/[\s,.]+/)[0];
  return first.length >= 4 && !GENERIC_NAME_WORDS.has(first) && first !== full ? [full, first] : [full];
}

/**
 * Deterministic citation lint. Runs before any model sees the draft and
 * returns failing verdicts for sentences that break the hard rules.
 */
export function lintDraft(draft: Draft, signals: Signal[]): Verdict[] {
  const ids = new Set(signals.map((s) => s.id));
  const out: Verdict[] = [];
  for (const s of draft.sentences) {
    const issue = lintSentence(s, ids);
    if (issue) out.push({ sentenceId: s.id, verdict: "UNSUPPORTED", rationale: issue, quote: "", source: "lint" });
  }
  return out;
}

export function lintSentence(s: Sentence, ids: Set<string>): string | null {
  const unknown = s.cites.filter((c) => !ids.has(c));
  if (unknown.length) return `Cites ${unknown.join(", ")}, which doesn't exist.`;
  if (s.kind === "claim" && s.cites.length === 0) return "Makes a claim about the prospect but cites no source.";
  return null;
}

/** Uncited "generic" sentences that mention a name, number or date: checked by a model for hidden claims. */
export function hiddenClaimSuspects(draft: Draft, company: Pick<Company, "name">): Sentence[] {
  return draft.sentences.filter((s) => s.kind === "generic" && s.cites.length === 0 && looksLikeHiddenClaim(s.text, company));
}

/** Sentences that need a model check: anything with citations that passed lint. */
export function sentencesToVerify(draft: Draft, lintFailures: Verdict[]): Sentence[] {
  const failed = new Set(lintFailures.map((v) => v.sentenceId));
  return draft.sentences.filter((s) => !failed.has(s.id) && s.cites.length > 0);
}

/**
 * The verifier must quote its evidence. If the quote isn't really in the
 * cited snippets, we don't trust a positive verdict. Quotes stitched from
 * several snippets ("a ... b") pass when every piece is in some snippet.
 */
export function enforceQuote(v: Verdict, citedSnippets: string[]): Verdict {
  if (v.verdict !== "SUPPORTED" && v.verdict !== "PARTIAL") return v;
  const pieces = v.quote.split(/\s*(?:\.\.\.|…)\s*/).filter((p) => p.trim().length > 0);
  if (pieces.length && pieces.every((p) => citedSnippets.some((snip) => quoteIsIn(p, snip)))) return v;
  return {
    ...v,
    verdict: "UNSUPPORTED",
    rationale: `Verifier's evidence quote isn't in the cited source. (Model said ${v.verdict}: ${v.rationale})`,
    source: "quote_check",
  };
}

/**
 * The verifier lists details it couldn't find in the evidence. If it listed
 * any, the sentence fails, whatever label the model picked.
 */
export function enforceDetails(v: Verdict, unsupportedDetails: string[]): Verdict {
  const details = unsupportedDetails.map((d) => d.trim()).filter(Boolean);
  if (!details.length || v.verdict === "UNSUPPORTED" || v.verdict === "CONTRADICTED") return v;
  return {
    ...v,
    verdict: "UNSUPPORTED",
    rationale: `Not in the source: ${details.join("; ")}. (Model said ${v.verdict}: ${v.rationale})`,
    source: "detail_check",
  };
}

export const isFailing = (v: Verdict) => v.verdict === "UNSUPPORTED" || v.verdict === "CONTRADICTED";
