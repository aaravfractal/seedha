"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { AppHeader } from "./shell/AppHeader";
import { isAppRoute } from "@/lib/screens";

/** Pages a guest opens on their own phone: no owner navigation. */
export function isGuestPage(pathname: string): boolean {
  return pathname.startsWith("/consent/") || /^\/link\/[^/]+/.test(pathname);
}

/**
 * Header for every page: the app shell header on owner, Front desk and Guest
 * mode screens; a plain brand bar on guest phones, sign-in and public pages.
 * The old "Pipeline" and "Plans" tabs are gone (D3).
 */
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
  if (isAppRoute(pathname)) return <AppHeader />;
  return (
    <header className="site-header">
      <div className="bar">
        <Link href="/home" className="brand" aria-label="Seedha home">
          <i aria-hidden="true" />
          Seedha
        </Link>
        <span style={{ marginLeft: "auto" }} />
        <ThemeToggle />
      </div>
    </header>
  );
}
