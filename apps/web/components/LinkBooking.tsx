"use client";

import { useEffect, useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import type { BookResult, LinkPage } from "@/lib/types";
import { ErrorState, Loading } from "./States";

const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"]; // prettier-ignore

function longDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${LONG_MONTHS[(m ?? 1) - 1]}`;
}

function codeMessage(page: LinkPage, typed: string): { text: string; good: boolean } {
  if (!typed.trim()) return { text: "Enter the code from your slip or WhatsApp", good: false };
  if (page.code_status === "valid") return { text: `${page.perk} for ${page.guest_short_name}`, good: true };
  if (page.code_status === "used") return { text: "This code was already used.", good: false };
  return { text: "That code is not right. Check your slip or WhatsApp.", good: false };
}

/** The direct booking page a returning guest opens: dates, room, perk, UPI. */
export function LinkBooking({
  initialCode,
  onBooked,
}: {
  initialCode: string;
  onBooked?: (result: BookResult) => void;
}) {
  const [typed, setTyped] = useState(initialCode);
  const [query, setQuery] = useState(initialCode);
  const page = useApi<LinkPage>(
    `public/link${query.trim() ? `?code=${encodeURIComponent(query.trim())}` : ""}`,
  );
  const [dateIndex, setDateIndex] = useState(0);
  const [room, setRoom] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<BookResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);

  if (page.error && !page.data) return <ErrorState message={page.error.message} onRetry={page.reload} />;
  if (!page.data) return <Loading rows={3} label="Opening the booking page" />;
  const p = page.data;
  const chosenRoom =
    p.rooms.find((r) => r.room_type === room) ??
    p.rooms.find((r) => r.room_type === "Deluxe Valley View") ??
    p.rooms[0];
  const stay = p.dates[dateIndex] ?? p.dates[0];
  const total = chosenRoom && stay ? chosenRoom.nightly_rate * stay.nights : 0;
  const msg = codeMessage(p, typed);
  const blocked = typed.trim() !== "" && p.code_status !== "valid";

  async function pay() {
    if (!chosenRoom || !stay) return;
    setBusy(true);
    setError("");
    try {
      const result = await postJson<BookResult>("public/link/book", {
        code: typed.trim() || null,
        check_in: stay.check_in,
        nights: stay.nights,
        room_type: chosenRoom.room_type,
      });
      setSheet(false);
      setDone(result);
      onBooked?.(result);
    } catch (err) {
      setSheet(false);
      setError(err instanceof ApiError ? err.message : "Payment did not go through. Try again.");
      page.reload();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", marginTop: 60 }}>
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
        <h3 className="sub-title">Booked.</h3>
        <p className="sub">
          See you on {longDate(done.check_in)}.{done.perk_applied ? " Breakfast is on us." : ""}
          <br />
          Reference {done.reference} · {inr(done.amount)} paid by UPI.
        </p>
        <p className="calc">{done.payment}</p>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            setDone(null);
            setTyped("");
          }}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="tag">Booking directly with the hotel</p>
      <h3 className="sub-title" style={{ fontSize: 26, marginTop: 12 }}>
        {p.hotel}
      </h3>
      <p className="sub" style={{ margin: "2px 0 12px" }}>
        {p.address}
      </p>
      <div
        style={{
          height: 120,
          borderRadius: 18,
          background: "linear-gradient(160deg,#2C5E48,#1E6B4E 40%,#A9C7B6)",
          marginBottom: 6,
        }}
        aria-hidden="true"
      />
      <label className="fl" htmlFor="lnDates">
        Dates
      </label>
      <select id="lnDates" value={dateIndex} onChange={(e) => setDateIndex(Number(e.target.value))}>
        {p.dates.map((d, i) => (
          <option key={d.check_in} value={i}>
            {d.label}
          </option>
        ))}
      </select>
      <label className="fl" htmlFor="lnRoom">
        Room
      </label>
      <select id="lnRoom" value={chosenRoom?.room_type ?? ""} onChange={(e) => setRoom(e.target.value)}>
        {p.rooms.map((r) => (
          <option key={r.room_type} value={r.room_type}>
            {r.room_type} · {inr(r.nightly_rate)} a night
          </option>
        ))}
      </select>
      <label className="fl" htmlFor="lnCode">
        Perk code
      </label>
      <input
        type="text"
        id="lnCode"
        value={typed}
        placeholder="DEODAR-XX26"
        autoComplete="off"
        autoCapitalize="characters"
        onChange={(e) => setTyped(e.target.value)}
        aria-describedby="codeMsg"
      />
      <p
        id="codeMsg"
        style={{ fontSize: 14, margin: "8px 0 0", color: msg.good ? "var(--gain)" : "var(--ink2)" }}
        aria-live="polite"
      >
        {msg.text}
      </p>
      <div
        style={{ display: "flex", justifyContent: "space-between", margin: "16px 0 12px", fontWeight: 600 }}
      >
        <span>Total</span>
        <span className="num">{inr(total)}</span>
      </div>
      {error ? (
        <p role="alert" style={{ color: "var(--loss)", fontSize: 15 }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn"
        style={{ width: "100%" }}
        disabled={blocked || busy}
        onClick={() => setSheet(true)}
      >
        Pay {inr(total)} with UPI
      </button>
      <p className="calc" style={{ textAlign: "center" }}>
        Same price as the hotel&apos;s own rate. Your perk is extra.
      </p>
      <div
        className={`sheet${sheet ? " up" : ""}`}
        role="dialog"
        aria-label="Pay with UPI"
        aria-hidden={!sheet}
      >
        <h3 className="sub-title">Pay with UPI</h3>
        <p className="sub" style={{ margin: "6px 0 4px" }}>
          {inr(total)} to {p.hotel}
        </p>
        <p className="tag sim" style={{ marginBottom: 14 }}>
          Simulated UPI (test mode). No money moves.
        </p>
        <button
          type="button"
          className="btn"
          style={{ width: "100%" }}
          disabled={busy || !sheet}
          onClick={pay}
        >
          {busy ? "Paying" : "Pay"}
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 8 }}
          disabled={!sheet}
          onClick={() => setSheet(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
