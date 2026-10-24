/**
 * Owner details shown in the site footer.
 * Edit this one file before sharing the prototype. Empty strings are hidden.
 */
export const SITE = {
  ownerName: "Vaishnavi Sadija",
  /** One line about you. Leave empty to hide. */
  ownerBlurb: "",
  /** Full URLs, e.g. "https://github.com/you/whynow". */
  github: "https://github.com/VaishnaviSadija-1",
  linkedin: "https://www.linkedin.com/in/vaishnavi-sadija-886705221/",
  /** Plain address, e.g. "you@example.com". */
  email: "vaishnavisadija7@gmail.com",
  /** Calendar link, e.g. a Cal.com or Calendly URL. */
  bookingUrl: "",
} as const;

export type SiteLink = { label: string; href: string; primary?: boolean };

/** The owner's links in display order, with empty ones dropped. */
export function siteLinks(): SiteLink[] {
  const links: SiteLink[] = [
    { label: "Book 20 minutes", href: SITE.bookingUrl, primary: true },
    { label: "GitHub", href: SITE.github },
    { label: "LinkedIn", href: SITE.linkedin },
    { label: "Email", href: SITE.email ? `mailto:${SITE.email}` : "" },
  ];
  return links.filter((l) => l.href);
}
