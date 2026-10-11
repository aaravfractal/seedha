"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, postJson } from "@/lib/api";

type Result = { received: boolean; request_id: number; message: string };

/** The erasure request form (POST /public/data-deletion through the web server). */
export function DeletionForm() {
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
    <>
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
    </>
  );
}
