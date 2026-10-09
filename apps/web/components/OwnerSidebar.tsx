"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OWNER_SCREENS } from "@/lib/screens";

/** Owner screens list: a sidebar on desktop, a scrolling chip row on phones. */
export function OwnerSidebar() {
  const pathname = usePathname();
  return (
    <nav className="side" aria-label="Owner screens">
      {OWNER_SCREENS.map((screen) => (
        <Link
          key={screen.key}
          href={screen.href}
          aria-current={pathname.startsWith(screen.href) ? "page" : undefined}
        >
          <span>{screen.label}</span>
          {screen.pro ? <span className="tag pro">Pro</span> : null}
        </Link>
      ))}
    </nav>
  );
}
