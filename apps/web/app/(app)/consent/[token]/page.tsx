"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { ConsentPage } from "@/lib/types";
import { Loading } from "@/components/States";
import styles from "@/components/guest/Guest.module.css";

const MOBILE = /^(?:\+?91)?[6-9]\d{9}$/;

function Tick() {
  return (
    <div className={styles.check} aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" strokeWidth="3">
        <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** The guest's consent page, opened from the front desk QR. Unticked by default (rule 5). */
export default function ConsentScreen({ params }: { params: Promise<{ token: string }> }) {
  // Inside the front desk page's phone frame, show the guest screen alone,
  // without the site header and footer (design QA D1).
  useEffect(() => {
    if (window.self !== window.top) document.documentElement.dataset.embedded = "true";
  }, []);
  const { token } = use(params);
  const page = useApi<ConsentPage>(`public/consent/${encodeURIComponent(token)}`);
  const [ticked, setTicked] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = MOBILE.test(number.replace(/[\s\-()]/g, ""));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ticked || !valid) return;
    setBusy(true);
    setError("");
    try {
      await postJson(`public/consent/${encodeURIComponent(token)}`, { agree: true, whatsapp: number });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (page.loading && !page.data) {
    return (
      <section className={styles.shell}>
        <Loading rows={2} label="Opening" />
      </section>
    );
  }
  if (page.error || !page.data) {
    const code = page.error?.code ?? "";
    const used = code === "link_used";
    const ended = used || code === "link_expired" || code === "invalid_link";
    return (
      <section className={`${styles.shell} ${styles.ended}`} role="alert">
        <h1 className={styles.welcome}>
          {used ? "Already done." : ended ? "This link has ended." : "That did not load."}
        </h1>
        <p className={styles.doneSub}>
          {used
            ? "Your answer is saved. Your perk arrives after checkout."
            : ended
              ? "Links from the front desk QR work for 10 minutes. Ask the front desk for a new QR."
              : (page.error?.message ?? "No connection. Try again.")}
        </p>
        {ended ? null : (
          <button type="button" className={styles.secondary} onClick={page.reload}>
            Try again
          </button>
        )}
      </section>
    );
  }
  const p = page.data;
  if (done) {
    return (
      <section className={`${styles.shell} ${styles.done}`} role="status" aria-live="polite">
        <Tick />
        <h1 className={styles.doneTitle}>You are in.</h1>
        <p className={styles.doneSub}>Your perk arrives after checkout.</p>
        <p className={styles.stop}>Reply STOP to any message to opt out.</p>
      </section>
    );
  }
  return (
    <form className={styles.shell} onSubmit={submit} noValidate>
      <p className={styles.hotelTag}>
        {p.hotel} · {p.city}
      </p>
      <h1 className={styles.welcome}>Welcome, {p.guest_short_name}.</h1>
      <div className={styles.perkCard}>
        <p className={styles.perkEyebrow}>Your perk</p>
        <p className={styles.perkText}>{p.perk}</p>
        <p className={styles.perkNote}>Same price as always. The perk is extra.</p>
      </div>
      <label className={styles.label} htmlFor="whatsapp">
        Your WhatsApp number
      </label>
      <input
        id="whatsapp"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="98765 43210"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        aria-invalid={number !== "" && !valid ? true : undefined}
        aria-describedby="number-help"
      />
      <p id="number-help" className={`${styles.help} ${number !== "" && !valid ? styles.helpBad : ""}`}>
        {number !== "" && !valid
          ? "Enter a 10-digit Indian mobile number."
          : "Only this hotel will message you."}
      </p>
      <label className={styles.tick}>
        <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
        <span>{p.wording}</span>
      </label>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button className={styles.primary} type="submit" disabled={!ticked || !valid || busy}>
        {busy ? "Saving" : "Yes, send me offers"}
      </button>
      <p className={styles.stop}>No tick, no messages. Reply STOP to any message to opt out.</p>
      <p className={styles.stop}>
        The <Link href="/privacy">privacy notice</Link> explains how your number is used. You can{" "}
        <Link href="/data-deletion">ask for it to be deleted</Link> or write to the{" "}
        <Link href="/privacy#grievance">Grievance Officer</Link>.
      </p>
    </form>
  );
}
