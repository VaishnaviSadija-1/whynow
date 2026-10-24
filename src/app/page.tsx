import type { CSSProperties } from "react";
import Link from "next/link";
import { AccountsPreview } from "@/components/landing/AccountsPreview";
import { PipelineStrip } from "@/components/landing/PipelineStrip";

const LEAD = "Know which companies to call, and".split(" ");
const PHRASE = "exactly when.".split(" ");

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <section className="grid items-center gap-12 pt-14 pb-14 sm:pt-20 lg:grid-cols-[1.5fr_1fr] lg:gap-16 lg:pt-24 lg:pb-20">
        <div>
          <h1 className="max-w-3xl font-display text-[2.9rem] leading-[1.02] tracking-tight sm:text-7xl lg:text-[4.6rem]">
            {LEAD.map((w, i) => (
              <span key={i}>
                <span className="word" style={{ "--i": i } as CSSProperties}>
                  {w}
                </span>{" "}
              </span>
            ))}
            <em className="cite-phrase whitespace-nowrap not-italic">
              {PHRASE.map((w, i) => (
                <span key={i} className="word italic" style={{ "--i": LEAD.length + i } as CSSProperties}>
                  {w}
                  {i < PHRASE.length - 1 ? "\u00a0" : ""}
                </span>
              ))}
            </em>
          </h1>
          <p
            className="fade-up mt-7 max-w-xl text-lg leading-relaxed text-muted"
            style={{ "--d": "650ms" } as CSSProperties}
          >
            WhyNow reads the web for buying signals, checks whether a company fits what you sell, and tells your sales
            team the right moment to reach out, with a source for every reason.
          </p>
          <div className="fade-up mt-9 flex flex-wrap gap-3" style={{ "--d": "850ms" } as CSSProperties}>
            <Link
              href="/accounts"
              className="cta-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
            >
              See today&apos;s accounts
              <span className="cta-arrow" aria-hidden>
                →
              </span>
            </Link>
            <Link href="/run" className="cta-secondary inline-flex items-center rounded-full px-5 py-3 text-sm font-medium">
              Check any company
            </Link>
          </div>
        </div>
        <div className="fade-up" style={{ "--d": "1000ms" } as CSSProperties}>
          <AccountsPreview />
        </div>
      </section>

      <section className="fade-up" style={{ "--d": "1150ms" } as CSSProperties}>
        <PipelineStrip />
      </section>
    </div>
  );
}
