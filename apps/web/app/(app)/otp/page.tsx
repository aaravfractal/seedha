"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  OTP_DIGITS,
  PENDING_KEY,
  type ApiErrorBody,
  type CodeSent,
  type PendingCode,
  cleanCode,
  clock,
  countdownAnnouncement,
  parsePending,
  triesText,
} from "@/lib/auth";
import { AuthFrame, savePending, styles, useShake } from "../login/AuthFrame";

const LOCKED = "Too many tries. Try again in 15 minutes.";

function readPending(): PendingCode | null {
  try {
    return parsePending(sessionStorage.getItem(PENDING_KEY));
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing stored.
  }
}

export default function OtpPage() {
  const [pending, setPending] = useState<PendingCode | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [noAccount, setNoAccount] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [shaking, shake] = useShake();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // sessionStorage exists only in the browser, so read it after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(readPending());
    setLoaded(true);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = pending ? (now - pending.sentAt) / 1000 : 0;
  const remaining = pending ? Math.max(0, Math.ceil(pending.expiresIn - elapsed)) : 0;
  const resendWait = pending ? Math.max(0, Math.ceil(pending.resendIn - elapsed)) : 0;
  const expired = pending !== null && remaining === 0;

  const spoken = countdownAnnouncement(remaining);
  const lastSpoken = useRef<string | null>(null);
  useEffect(() => {
    if (!pending || locked || !spoken || spoken === lastSpoken.current) return;
    lastSpoken.current = spoken;
    // Announce the countdown only at whole minutes, 30 s, 10 s and expiry.
    setAnnounce(spoken);
  }, [spoken, pending, locked]);

  function update(next: PendingCode) {
    setPending(next);
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the screen still works until it is reloaded.
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!pending || locked) return;
    if (code.length !== OTP_DIGITS) {
      setError("Enter the 6-digit code.");
      shake();
      return;
    }
    setBusy(true);
    setError("");
    setNoAccount(false);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: pending.phone, code, remember: pending.remember }),
      });
      if (res.ok) {
        const body = (await res.json()) as { onboarded: boolean };
        clearPending();
        setOpening(true);
        // Full navigation drops redirects prefetched while signed out.
        window.location.replace(body.onboarded ? pending.next : "/onboard");
        return;
      }
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      const err = body?.error;
      if (typeof err?.tries_left === "number") update({ ...pending, triesLeft: err.tries_left });
      if (err?.code === "locked") {
        setLocked(true);
        setError(LOCKED);
      } else {
        setError(err?.message ?? "Something went wrong. Try again.");
        setNoAccount(err?.code === "no_account");
      }
      setCode("");
      shake();
      input.current?.focus();
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  async function resend() {
    if (!pending || resendWait > 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: pending.phone }),
      });
      const body = (await res.json().catch(() => null)) as (CodeSent & ApiErrorBody) | null;
      if (res.ok && body) {
        savePending(pending.phone, body, {
          remember: pending.remember,
          flow: pending.flow,
          next: pending.next,
        });
        setPending(readPending() ?? { ...pending, sentAt: Date.now(), demoCode: body.demo_code });
        lastSpoken.current = null;
        setCode("");
        setLocked(false);
        setAnnounce("A new code is on its way to your WhatsApp.");
      } else if (body?.error?.code === "locked") {
        setLocked(true);
        setError(LOCKED);
      } else {
        setError(body?.error?.message ?? "Could not send a new code. Try again.");
      }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  if (!loaded) return <AuthFrame title="Enter the code">{null}</AuthFrame>;

  if (!pending) {
    return (
      <AuthFrame
        title="Enter the code"
        sub="Ask for a code first. It is sent to your WhatsApp."
        backHref="/login"
        backLabel="Back to sign in"
      >
        <Link className={styles.primary} href="/login" style={{ display: "grid", placeItems: "center" }}>
          Go to sign in
        </Link>
      </AuthFrame>
    );
  }

  if (opening) {
    return (
      <AuthFrame title="Signed in">
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          Opening your dashboard
        </div>
      </AuthFrame>
    );
  }

  const changeHref = pending.flow === "signup" ? "/signup" : "/login";

  return (
    <AuthFrame
      title="Enter the code"
      sub={`Sent on WhatsApp to ${pending.masked}.`}
      backHref={changeHref}
      backLabel={pending.flow === "signup" ? "Back to sign up" : "Back to sign in"}
    >
      {pending.demoCode ? (
        <div className={styles.demo} id="demo-banner" role="note" aria-label="Demo code">
          <strong>Demo mode · simulated WhatsApp</strong>
          No message was sent. In this demo your code is{" "}
          <span id="demo-code" className={styles.demoCode}>
            {pending.demoCode}
          </span>
        </div>
      ) : null}
      <form onSubmit={verify} noValidate>
        <label className={styles.label} htmlFor="otp-code">
          6-digit code
        </label>
        <input
          ref={input}
          id="otp-code"
          className={`${styles.input} ${styles.code} ${shaking ? styles.shake : ""}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={OTP_DIGITS}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          disabled={locked || expired}
          aria-invalid={error ? true : undefined}
          aria-describedby="otp-meta otp-error"
        />
        <div id="otp-meta" className={styles.meta}>
          <span id="otp-countdown">{expired ? "Code expired" : `Code expires in ${clock(remaining)}`}</span>
          <span id="otp-tries">{triesText(locked ? 0 : pending.triesLeft)}</span>
        </div>
        <p className="sr-only-text" aria-live="polite">
          {announce}
        </p>
        <div id="otp-error" role="alert">
          {error ? (
            <p className={styles.error}>
              {error}
              {noAccount ? (
                <>
                  {" "}
                  <Link href="/signup" className={styles.link} style={{ minHeight: 0, padding: 0 }}>
                    Create an account
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <button
          id="otp-verify"
          className={styles.primary}
          type="submit"
          disabled={busy || locked || expired || code.length !== OTP_DIGITS}
        >
          {busy ? "Checking" : "Verify and continue"}
        </button>
      </form>
      <div className={styles.links}>
        <Link className={styles.link} href={changeHref} onClick={clearPending}>
          Change number
        </Link>
        <button
          id="otp-resend"
          type="button"
          className={styles.link}
          onClick={resend}
          disabled={busy || resendWait > 0 || locked}
        >
          {resendWait > 0 ? `Resend code in ${clock(resendWait)}` : "Resend code"}
        </button>
      </div>
    </AuthFrame>
  );
}
