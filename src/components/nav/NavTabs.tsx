"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/accounts", label: "Accounts" },
  { href: "/run", label: "Demo" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <div className="nav-tabs ml-auto flex items-center gap-0.5 rounded-full border border-line bg-card/70 p-1 text-[12px] sm:text-[13px]">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 transition-colors duration-200 sm:px-3.5 ${
              active ? "bg-ink font-medium text-paper shadow-sm" : "text-muted hover:bg-line/60 hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </div>
  );
}
