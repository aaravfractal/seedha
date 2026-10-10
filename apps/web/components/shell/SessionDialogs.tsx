"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/components/useDialogFocus";
import { signOut } from "./signOut";
import styles from "./Shell.module.css";

export const IDLE_MS = 30 * 60 * 1000;
const ACTIVITY = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/** "Still there?" after 30 minutes without input. */
export function IdleDialog({ onStay }: { onStay: () => void }) {
  const [idle, setIdle] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (idle) return;
    let timer = setTimeout(() => setIdle(true), IDLE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };
    ACTIVITY.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [idle]);

  const stay = () => {
    setIdle(false);
    onStay();
  };
  useDialogFocus(ref, idle, stay);

  if (!idle) return null;
  return (
    <div className={`${styles.scrim} ${styles.scrimCenter}`}>
      <div
        className={styles.dialog}
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-body"
      >
        <h2 id="idle-title">Still there?</h2>
        <p id="idle-body">You have been away for 30 minutes. Stay signed in to keep working.</p>
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={stay}>
            Stay signed in
          </button>
          <button type="button" className="btn ghost" onClick={() => void signOut(router.push)}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown when the API says the owner session has ended. */
export function SessionEnded() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useDialogFocus(ref, true, () => undefined);
  const next = `/login?next=${encodeURIComponent(pathname)}`;
  return (
    <div className={styles.ended}>
      <div
        className={styles.dialog}
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ended-title"
        aria-describedby="ended-body"
      >
        <h2 id="ended-title">Your session has ended.</h2>
        <p id="ended-body">Sign in again to see your hotel. Nothing you saved is lost.</p>
        <div className={styles.actions}>
          <Link className="btn" href={next}>
            Sign in
          </Link>
          <Link className="btn ghost" href="/login">
            Direct beta login
          </Link>
        </div>
      </div>
    </div>
  );
}
