"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OWNER_SCREENS } from "@/lib/screens";
import { useApi } from "@/lib/api";
import type { Messages } from "@/lib/types";

/** Owner screens list: a sidebar on desktop, a scrolling chip row on phones. */
export function OwnerSidebar() {
  const pathname = usePathname();
  const messages = useApi<Messages>(`messages?from=${encodeURIComponent(pathname)}`);
  const pending = messages.data?.pending ?? 0;
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
          {screen.key === "approvals" && pending ? (
            <span className="tag ok" aria-label={`${pending} waiting`}>
              {pending}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
