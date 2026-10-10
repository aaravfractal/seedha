"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { PENDING_KEY, type ApiErrorBody, type CodeSent, type PendingCode, maskPhone } from "@/lib/auth";
import styles from "./auth.module.css";

/** Back link, logo and the centred card every auth screen shares. */
export function AuthFrame({
  title,
  sub,
  children,
  backHref = "/",
  backLabel = "Back to website",
}: {
  title: string;
  sub?: ReactNode;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className={styles.stage}>
      <div className={styles.column}>
        <Link className={styles.back} href={backHref}>
          ‹ {backLabel}
        </Link>
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">
            <i />
            <i />
          </span>
          Seedha
        </div>
        <section className={styles.card} aria-labelledby="auth-title">
          <h1 id="auth-title" className={styles.title}>
            {title}
          </h1>
          {sub ? <p className={styles.sub}>{sub}</p> : null}
          {children}
        </section>
      </div>
    </div>
  );
}

/** Direct beta login card: one tap into the fictional sample hotel. */
export function BetaLogin({
  remember,
  onError,
  next = "/home",
}: {
  remember: boolean;
  onError: (message: string) => void;
  next?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remember }),
      });
      if (res.ok) {
        // Full navigation: pages prefetched while signed out hold cached
        // redirects to /login, so a client-side push would bounce back.
        window.location.assign(next);
        return;
      }
      onError(await errorMessage(res));
    } catch {
      onError("No connection. Try again.");
    }
    setBusy(false);
  }
  return (
    <button type="button" id="beta-login" className={styles.beta} onClick={open} disabled={busy}>
      <span className={styles.betaIcon} aria-hidden="true">
        β
      </span>
      <span className={styles.betaText}>
        <span className={styles.betaTitle}>
          Direct beta login <span className={styles.betaChip}>Beta</span>
        </span>
        <span className={styles.betaSub}>
          {busy ? "Opening Hotel Deodar View" : "One tap into Hotel Deodar View. No code needed."}
        </span>
      </span>
      <span className={styles.chev} aria-hidden="true">
        ›
      </span>
    </button>
  );
}

export async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return body?.error?.message ?? "Something went wrong. Try again.";
}

/** Remember a sent code's details for the /otp screen (this tab only). */
export function savePending(
  phone: string,
  sent: CodeSent,
  extra: Pick<PendingCode, "remember" | "flow" | "next">,
) {
  const pending: PendingCode = {
    phone,
    masked: maskPhone(phone),
    sentAt: Date.now(),
    expiresIn: sent.expires_in,
    resendIn: sent.resend_in,
    triesLeft: sent.tries_left,
    demoCode: sent.demo_code,
    ...extra,
  };
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Private mode without storage: /otp will ask for the number again.
  }
}

/** Re-run a CSS animation (the error shake) each time it is asked for. */
export function useShake(): [boolean, () => void] {
  const [shaking, setShaking] = useState(false);
  const shake = useCallback(() => {
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
  }, []);
  return [shaking, shake];
}

export { styles };
