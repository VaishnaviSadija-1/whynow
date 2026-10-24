import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { NavTabs } from "@/components/nav/NavTabs";
import { SITE, siteLinks } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "WhyNow: the right accounts, at the right time",
  description:
    "A prototype that finds buying signals, checks whether a company fits what you sell, and tells your sales team the right moment to reach out.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const links = siteLinks().filter((l) => !l.primary);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <header className="site-header sticky top-0 z-40 border-b border-line">
          <nav className="mx-auto flex h-[var(--nav-h)] max-w-6xl items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-2 rounded-md font-medium tracking-tight">
              <span className="logo-mark grid h-6 w-6 place-items-center rounded-[7px] font-display text-[15px] italic leading-none">
                W
              </span>
              <span className="hidden min-[380px]:inline">WhyNow</span>
              <span className="hidden rounded-full border border-line-strong px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider text-faint sm:inline">
                Prototype
              </span>
            </Link>
            <NavTabs />
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-xs text-faint sm:px-6">
            <span>
              An independent prototype by <span className="text-muted">{SITE.ownerName}</span>
            </span>
            {links.length > 0 && (
              <span className="flex gap-4">
                {links.map((l) => (
                  <a key={l.label} href={l.href} className="link-quiet" target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                ))}
              </span>
            )}
          </div>
        </footer>
      </body>
    </html>
  );
}
