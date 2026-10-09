"use client";

import { use, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { ConsentPage } from "@/lib/types";
import { Loading } from "@/components/States";

const MOBILE = /^(?:\+?91)?[6-9]\d{9}$/;

export default function ConsentScreen({ params }: { params: Promise<{ token: string }> }) {
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
      <section className="guest-shell">
        <Loading rows={2} label="Opening" />
      </section>
    );
  }
  if (page.error || !page.data) {
    return (
      <section className="guest-shell" role="alert">
        <h2 className="title" style={{ fontSize: 26 }}>
          {page.error?.code === "link_used" ? "Already done." : "This link has ended."}
        </h2>
        <p className="sub">{page.error?.message ?? "Ask the desk for a new QR."}</p>
      </section>
    );
  }
  const p = page.data;
  if (done) {
    return (
      <section className="guest-shell" style={{ textAlign: "center", marginTop: 60 }}>
        <div className="check" style={{ background: "var(--accent)" }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="sub-title">You&apos;re in.</h3>
        <p className="sub">Your perk arrives after checkout. Reply STOP to any message to stop them.</p>
      </section>
    );
  }
  return (
    <form className="guest-shell" onSubmit={submit} noValidate>
      <p className="tag">
        {p.hotel} · {p.city}
      </p>
      <h3 className="sub-title" style={{ marginTop: 14, fontSize: 24 }}>
        Welcome, {p.guest_short_name}.
      </h3>
      <div className="perk" style={{ marginTop: 14 }}>
        {p.perk}
      </div>
      <label className="fl" htmlFor="whatsapp">
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
      <p id="number-help" className="calc" style={{ marginTop: 6 }}>
        {number !== "" && !valid
          ? "Enter a 10-digit Indian mobile number."
          : "Only this hotel will message you."}
      </p>
      <label className="chk">
        <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
        <span>{p.wording}</span>
      </label>
      {error ? (
        <p role="alert" style={{ color: "var(--loss)", fontSize: 15 }}>
          {error}
        </p>
      ) : null}
      <button className="btn" type="submit" style={{ width: "100%" }} disabled={!ticked || !valid || busy}>
        Yes, send me offers
      </button>
      <p className="calc" style={{ textAlign: "center" }}>
        No tick, no messages. Your number stays with the hotel.
      </p>
    </form>
  );
}
