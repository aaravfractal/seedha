"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { type CodeSent, normalisePhone, safeNext } from "@/lib/auth";
import { AuthFrame, BetaLogin, errorMessage, savePending, styles, useShake } from "./AuthFrame";

const PHONE_ERROR = "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shaking, shake] = useShake();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  function fail(message: string) {
    setError(message);
    shake();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normal = normalisePhone(phone);
    if (!normal) {
      fail(PHONE_ERROR);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normal }),
      });
      if (res.ok) {
        savePending(normal, (await res.json()) as CodeSent, { remember, flow: "signin", next });
        router.push("/otp");
        return;
      }
      fail(await errorMessage(res));
    } catch {
      fail("No connection. Try again.");
    }
    setBusy(false);
  }

  return (
    <AuthFrame
      title="Sign in"
      sub="We send a one-time code to your WhatsApp. No password to remember or leak."
    >
      <BetaLogin remember={remember} onError={fail} next={next} />
      <p className={styles.or}>or sign in with your number</p>
      <form onSubmit={submit} noValidate>
        <label className={styles.label} htmlFor="phone">
          Mobile number
        </label>
        <div
          className={`${styles.phone} ${shaking ? styles.shake : ""}`}
          data-invalid={error ? "true" : undefined}
        >
          <span className={styles.prefix} aria-hidden="true">
            +91
          </span>
          <input
            id="phone"
            className={styles.input}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit number"
            maxLength={16}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        <label className={styles.check}>
          <input
            id="remember"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Keep me signed in on this device for 30 days</span>
        </label>
        {error ? (
          <p id="login-error" className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <button id="send-code" className={styles.primary} type="submit" disabled={busy}>
          {busy ? "Sending code" : "Send code on WhatsApp"}
        </button>
      </form>
      <p className={styles.foot}>
        New to Seedha? <Link href="/signup">Create an account</Link>
      </p>
    </AuthFrame>
  );
}
