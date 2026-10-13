"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { OWNER_SCREENS, isCurrent } from "@/lib/screens";
import { Icon } from "./shell/Icons";
import type { IconName } from "./shell/Icons";
import { useShell } from "./shell/ShellData";
import styles from "./shell/Shell.module.css";

/**
 * Owner screens in the approved order: a 232px sidebar from 980px, a
 * scrolling pill row on phones. The Approvals count is the number of drafts
 * waiting, from GET /overview (reloaded on every navigation).
 */
export function OwnerSidebar() {
  const pathname = usePathname();
  const { data } = useShell(pathname);
  const pending = data?.pending_approvals ?? 0;
  const nav = useRef<HTMLElement>(null);

  // On phones the screens are a sideways pill row: keep the current one in
  // view (design QA SH1). Only the row scrolls, never the page.
  useEffect(() => {
    const row = nav.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !current || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav ref={nav} className={styles.side} aria-label="Owner screens">
      <ul>
        {OWNER_SCREENS.map((screen) => (
          <li key={screen.key}>
            <Link
              href={screen.href}
              className={styles.item}
              aria-current={isCurrent(pathname, screen.href) ? "page" : undefined}
            >
              <span className={styles.tile}>
                <Icon name={screen.icon as IconName} />
              </span>
              <span className={styles.label}>{screen.label}</span>
              {screen.key === "approvals" && pending ? (
                <span className={styles.count}>
                  {pending}
                  <span className="sr-only-text"> waiting</span>
                </span>
              ) : null}
              {screen.tag ? <span className={styles.tag}>{screen.tag}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.deskCard}>
        <Link href="/desk">
          Open the front desk <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </nav>
  );
}
