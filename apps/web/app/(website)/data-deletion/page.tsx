"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, postJson } from "@/lib/api";
import { LegalPage } from "@/components/LegalPage";

type Result = { received: boolean; request_id: number; message: string };

export default function DataDeletionPage() {
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(
        await postJson<Result>("public/data-deletion", { booking_ref: ref.trim(), phone: phone.trim() }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LegalPage
      title="Delete my data"
      lede="Ask the hotel to erase the consent you gave at its Desk."
      points={{
        en: [
          "Give the booking reference from your bill or slip and the WhatsApp number you entered.",
          "Your number, the random salt and every link to you are erased. Messages stop.",
          "The anonymous fingerprint stays in the proof record but can no longer be linked to you.",
        ],
        hi: [
          "Apne bill ya slip ka booking reference aur woh WhatsApp number dijiye jo aapne diya tha.",
          "Aapka number, random salt aur aap tak pahunchne wala har link mita diya jaata hai. Message band.",
          "Proof record mein anonymous fingerprint rehta hai, par woh aap se jodha nahi ja sakta.",
        ],
      }}
    >
      {result ? (
        <div className="card" role="status">
          <h2 className="sub-title">Thank you</h2>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            {result.message}
          </p>
          <p className="calc">Request number {result.request_id}. Keep it if you write to us about this.</p>
        </div>
      ) : (
        <form className="card" onSubmit={submit} noValidate>
          <label className="fl" htmlFor="ref">
            Booking reference
          </label>
          <input
            id="ref"
            type="text"
            autoComplete="off"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="As printed on your bill or slip"
          />
          <label className="fl" htmlFor="phone">
            WhatsApp number you gave
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98765 43210"
          />
          {error ? (
            <p role="alert" style={{ color: "var(--loss)", fontSize: 15 }}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn"
            style={{ marginTop: 16 }}
            disabled={busy || ref.trim().length < 3 || phone.trim().length < 10}
          >
            {busy ? "Sending" : "Erase my consent record"}
          </button>
        </form>
      )}

      <h2 className="section">What is deleted</h2>
      <ul>
        <li>Your WhatsApp number.</li>
        <li>The random salt that made your consent fingerprint.</li>
        <li>Every link between you and the published fingerprint.</li>
        <li>The text of messages prepared for you. Unsent drafts are cancelled and nothing more is sent.</li>
      </ul>

      <h2 className="section">What is kept, and why</h2>
      <ul>
        <li>
          The anonymous fingerprint in the nightly proof record. It is a hash that identifies no one, and
          removing it would break the proof for every other guest in that night&apos;s bundle. Without the
          salt it can no longer be linked to you.
        </li>
        <li>
          The hotel&apos;s own booking record of your stay (dates, room, amount), which the hotel may need to
          keep for tax. Ask the hotel directly if you want that reviewed.
        </li>
        <li>
          A note that a deletion request arrived and whether it matched, with no number or reference stored.
        </li>
      </ul>
      <p className="calc">
        For privacy, the answer is the same whether or not a record matched, so nobody can use this page to
        find out who stayed at a hotel.
      </p>
    </LegalPage>
  );
}
