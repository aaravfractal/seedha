"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { type CodeSent, normalisePhone } from "@/lib/auth";
import { AuthFrame, errorMessage, savePending, styles, useShake } from "../login/AuthFrame";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [hotel, setHotel] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shaking, shake] = useShake();
  const router = useRouter();

  const normal = normalisePhone(phone);
  const nameOk = name.trim().length >= 2;
  const hotelOk = hotel.trim().length >= 2;
  const valid = nameOk && hotelOk && normal !== null && terms;
  const phoneShowsError = phone.replace(/\D/g, "").length >= 10 && normal === null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || !normal) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), hotel: hotel.trim(), phone: normal, terms, updates }),
      });
      if (res.ok) {
        savePending(normal, (await res.json()) as CodeSent, {
          remember: true,
          flow: "signup",
          next: "/onboard",
        });
        router.push("/otp");
        return;
      }
      setError(await errorMessage(res));
      shake();
    } catch {
      setError("No connection. Try again.");
      shake();
    }
    setBusy(false);
  }

  return (
    <AuthFrame
      title="Create your account"
      sub="Three details. Setup takes under 3 minutes."
      backHref="/login"
      backLabel="Back to sign in"
    >
      <form onSubmit={submit} noValidate className={shaking ? styles.shake : undefined}>
        <label className={styles.label} htmlFor="su-name">
          Your name
        </label>
        <input
          id="su-name"
          className={styles.input}
          autoComplete="name"
          placeholder="Full name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className={styles.label} htmlFor="su-hotel">
          Hotel name
        </label>
        <input
          id="su-hotel"
          className={styles.input}
          autoComplete="organization"
          placeholder="Hotel or homestay"
          maxLength={120}
          value={hotel}
          onChange={(e) => setHotel(e.target.value)}
        />
        <label className={styles.label} htmlFor="su-phone">
          WhatsApp number
        </label>
        <div className={styles.phone} data-invalid={phoneShowsError ? "true" : undefined}>
          <span className={styles.prefix} aria-hidden="true">
            +91
          </span>
          <input
            id="su-phone"
            className={styles.input}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit number"
            maxLength={16}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={phoneShowsError ? true : undefined}
            aria-describedby="su-phone-hint"
          />
        </div>
        <p id="su-phone-hint" className={phoneShowsError ? styles.error : styles.hint}>
          {phoneShowsError
            ? "Enter a 10-digit mobile number starting with 6, 7, 8 or 9."
            : "We send your sign-in code here."}
        </p>
        <label className={styles.check}>
          <input
            id="su-terms"
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            required
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank">
              Privacy policy
            </Link>
            .
          </span>
        </label>
        <label className={styles.check}>
          <input
            id="su-updates"
            type="checkbox"
            checked={updates}
            onChange={(e) => setUpdates(e.target.checked)}
          />
          <span>
            Send me product updates on WhatsApp <span className={styles.optional}>(optional)</span>
          </span>
        </label>
        {error ? (
          <p id="signup-error" className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <button id="signup-submit" className={styles.primary} type="submit" disabled={!valid || busy}>
          {busy ? "Sending code" : "Create account"}
        </button>
      </form>
      <p className={styles.foot}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}
