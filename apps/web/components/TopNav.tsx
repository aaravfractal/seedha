"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { OWNER_SCREENS } from "@/lib/screens";

const TABS = [
  { label: "Pipeline", href: "/home", match: (p: string) => p === "/home" || p === "/" },
  {
    label: "Owner",
    href: "/upload",
    match: (p: string) => OWNER_SCREENS.some((s) => p === s.href || p.startsWith(`${s.href}/`)),
  },
  { label: "Desk", href: "/desk", match: (p: string) => p.startsWith("/desk") },
  { label: "Guest", href: "/link", match: (p: string) => p.startsWith("/link") || p.startsWith("/consent") },
  { label: "Plans", href: "/plans", match: (p: string) => p.startsWith("/plans") },
];

/** Pages a guest opens on their own phone: no owner navigation. */
export function isGuestPage(pathname: string): boolean {
  return pathname.startsWith("/consent/") || /^\/link\/[^/]+/.test(pathname);
}

/** Sticky glass header with the five sections from the prototype. */
export function TopNav() {
  const pathname = usePathname();
  if (isGuestPage(pathname)) {
    return (
      <header className="site-header">
        <div className="bar">
          <span className="brand">
            <i aria-hidden="true" />
            Seedha
          </span>
          <span className="meta" style={{ marginLeft: "auto" }}>
            Booking directly with the hotel
          </span>
        </div>
      </header>
    );
  }
  return (
    <header className="site-header">
      <div className="bar">
        <Link href="/home" className="brand" aria-label="Seedha home">
          <i aria-hidden="true" />
          Seedha
        </Link>
        <nav className="seg" aria-label="Sections">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} aria-current={tab.match(pathname) ? "page" : undefined}>
              {tab.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
