"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { MAX_NIGHTS, dayLabel, matchRoom, stayLabel } from "@/lib/linkPrefill";
import type { Prefill } from "@/lib/linkPrefill";
import type { BookResult, LinkPage } from "@/lib/types";
import { ErrorState, Loading } from "./States";
import { useDialogFocus } from "./useDialogFocus";
import styles from "./guest/Guest.module.css";

const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"]; // prettier-ignore
const NIGHT_CHOICES = Array.from({ length: MAX_NIGHTS }, (_, i) => i + 1);
const PROCESSING_MS = 1400;

const UPI_APPS = [
  { name: "Google Pay", mark: "G", color: "#1a73e8" },
  { name: "PhonePe", mark: "Pe", color: "#5f259f" },
  { name: "Paytm", mark: "P", color: "#002e6e" },
] as const;
type UpiApp = (typeof UPI_APPS)[number]["name"];

const NO_PREFILL: Prefill = { room: null, checkIn: null, nights: null, code: null };

function longDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${LONG_MONTHS[(m ?? 1) - 1]}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type CodeState = "empty" | "checking" | "valid" | "used" | "unknown";

function codeMessage(state: CodeState, perk: string): string {
  // No name until the code is accepted with a booking: a guessed code must not reveal a guest (D-076).
  switch (state) {
    case "valid":
      return `${perk}. Your code is valid.`;
    case "used":
      return "This code was already used. You can still book at the same price.";
    case "unknown":
      return "That code is not right. Check your slip or WhatsApp.";
    case "checking":
      return "Checking your code";
    default:
      return "Have a code from your slip or WhatsApp? Enter it here.";
  }
}

/** The direct booking page a returning guest opens: dates, room, perk, UPI. */
export function LinkBooking({
  initialCode,
  prefill = NO_PREFILL,
  contained = false,
  onBooked,
}: {
  initialCode: string;
  prefill?: Prefill;
  /** True inside a phone frame: the sheet stays inside the frame. */
  contained?: boolean;
  onBooked?: (result: BookResult) => void;
}) {
  const [typed, setTyped] = useState(initialCode);
  const [query, setQuery] = useState(initialCode);
  const page = useApi<LinkPage>(
    `public/link${query.trim() ? `?code=${encodeURIComponent(query.trim())}` : ""}`,
  );
  const [roomSel, setRoomSel] = useState<string | null>(null);
  const [checkInSel, setCheckInSel] = useState<string | null>(null);
  const [nightsSel, setNightsSel] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [phase, setPhase] = useState<"choose" | "processing">("choose");
  const [app, setApp] = useState<UpiApp>("Google Pay");
  const [error, setError] = useState("");
  const [done, setDone] = useState<BookResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);

  const sheetRef = useRef<HTMLDivElement>(null);
  const payRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(sheetRef, sheet, () => {
    if (phase !== "processing") setSheet(false);
  });
  // Runs after useDialogFocus: the primary action gets focus, Google Pay is already chosen.
  useEffect(() => {
    if (sheet) payRef.current?.focus();
  }, [sheet]);
  useEffect(() => {
    if (phase === "processing") sheetRef.current?.focus();
  }, [phase]);

  if (page.error && !page.data) return <ErrorState message={page.error.message} onRetry={page.reload} />;
  if (!page.data) return <Loading rows={3} label="Opening the booking page" />;
  const p = page.data;

  const roomTypes = p.rooms.map((r) => r.room_type);
  const roomName =
    roomSel ??
    matchRoom(prefill.room, roomTypes) ??
    roomTypes.find((t) => t === "Deluxe Valley View") ??
    roomTypes[0];
  const chosenRoom = p.rooms.find((r) => r.room_type === roomName);
  const checkIns = [...new Set([...p.dates.map((d) => d.check_in), ...(prefill.checkIn ? [prefill.checkIn] : [])])]
    .sort(); // prettier-ignore
  const checkIn = checkInSel ?? prefill.checkIn ?? p.dates[0]?.check_in ?? null;
  const nights = nightsSel ?? prefill.nights ?? p.dates.find((d) => d.check_in === checkIn)?.nights ?? 2;
  const total = chosenRoom ? chosenRoom.nightly_rate * nights : 0;

  const code = typed.trim();
  const checking = code !== query.trim() || page.loading;
  const state: CodeState = !code
    ? "empty"
    : checking
      ? "checking"
      : p.code_status === "valid"
        ? "valid"
        : p.code_status === "used"
          ? "used"
          : "unknown";
  const blocked = code !== "" && state !== "valid";

  async function pay() {
    if (!chosenRoom || !checkIn) return;
    setPhase("processing");
    setError("");
    try {
      const [result] = await Promise.all([
        postJson<BookResult>("public/link/book", {
          code: code ? code.toUpperCase() : null,
          check_in: checkIn,
          nights,
          room_type: chosenRoom.room_type,
        }),
        wait(reducedMotion() ? 0 : PROCESSING_MS),
      ]);
      setSheet(false);
      setDone(result);
      onBooked?.(result);
    } catch (err) {
      setSheet(false);
      setError(err instanceof ApiError ? err.message : "Payment did not go through. Try again.");
      page.reload();
    } finally {
      setPhase("choose");
    }
  }

  if (done) {
    return (
      <section className={`${styles.shell} ${styles.done}`} role="status" aria-live="polite">
        <div className={styles.check} aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" strokeWidth="3">
            <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className={styles.doneTitle}>
          {done.guest_short_name ? `Booked. Thank you, ${done.guest_short_name}.` : "Booked."}
        </h2>
        <p className={styles.doneSub}>
          See you on {longDate(done.check_in)}.{done.perk_applied ? " Breakfast is on us." : ""}
        </p>
        <p className={styles.doneSub}>
          Reference {done.reference} · <span className="num">{inr(done.amount)}</span> paid by UPI.
        </p>
        <p className={styles.sim}>{done.payment}</p>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setDone(null);
            setTyped("");
          }}
        >
          Back
        </button>
      </section>
    );
  }

  return (
    <div className={`${styles.shell} ${contained ? styles.contained : ""}`}>
      <p className={styles.trust}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
          <path d="M8.5 12l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        You are booking directly with the hotel.
      </p>
      <h2 className={styles.hotelName}>{p.hotel}</h2>
      <p className={styles.address}>{p.address}</p>
      <div className={styles.photo} role="img" aria-label={`Sample photo placeholder for ${p.hotel}`}>
        <span className={styles.photoLabel} aria-hidden="true">
          Sample photo
        </span>
      </div>

      <div className={styles.row2}>
        <div>
          <label className={styles.label} htmlFor="lnDates">
            Check-in
          </label>
          <select id="lnDates" value={checkIn ?? ""} onChange={(e) => setCheckInSel(e.target.value)}>
            {checkIns.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={styles.label} htmlFor="lnNights">
            Nights
          </label>
          <select id="lnNights" value={nights} onChange={(e) => setNightsSel(Number(e.target.value))}>
            {NIGHT_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      {checkIn ? <p className={styles.stayLine}>{stayLabel(checkIn, nights)}</p> : null}

      <label className={styles.label} htmlFor="lnRoom">
        Room
      </label>
      <select id="lnRoom" value={roomName ?? ""} onChange={(e) => setRoomSel(e.target.value)}>
        {p.rooms.map((r) => (
          <option key={r.room_type} value={r.room_type}>
            {r.room_type} · {inr(r.nightly_rate)} a night
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="lnCode">
        Perk code
      </label>
      <input
        type="text"
        id="lnCode"
        className={styles.code}
        value={typed}
        placeholder="DEODAR-XX26"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={30}
        onChange={(e) => setTyped(e.target.value)}
        aria-describedby="codeMsg"
        aria-invalid={state === "used" || state === "unknown" ? true : undefined}
      />
      <div className={styles.codeMsg}>
        <span
          id="codeMsg"
          aria-live="polite"
          className={
            state === "valid"
              ? styles.codeGood
              : state === "used" || state === "unknown"
                ? styles.codeBad
                : ""
          }
        >
          {codeMessage(state, p.perk)}
        </span>
        {state === "used" || state === "unknown" ? (
          <button type="button" className={styles.linkBtn} onClick={() => setTyped("")}>
            Remove code
          </button>
        ) : null}
      </div>

      <div className={styles.total}>
        <span className={styles.totalLabel}>
          Total · {nights} {nights === 1 ? "night" : "nights"}
        </span>
        <b className="num">{inr(total)}</b>
      </div>
      <p className={styles.note}>
        {state === "valid"
          ? "Your perk is added. Same price as the hotel's own rate."
          : "Same price as the hotel's own rate. A code adds a perk, never a lower price."}
      </p>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={styles.primary}
        disabled={blocked || !chosenRoom || !checkIn}
        onClick={() => setSheet(true)}
      >
        Pay {inr(total)} with UPI
      </button>

      <div
        className={`${styles.scrim} ${sheet ? styles.scrimOn : ""}`}
        aria-hidden="true"
        onClick={() => phase !== "processing" && setSheet(false)}
      />
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${sheet ? styles.sheetUp : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Pay with UPI"
        aria-hidden={!sheet}
        inert={!sheet}
        tabIndex={-1}
      >
        <div className={styles.grabber} aria-hidden="true" />
        <h2 className={styles.sheetTitle}>Pay with UPI</h2>
        <p className={styles.sheetSub}>
          <span className="num">{inr(total)}</span> to {p.hotel} · {stayLabel(checkIn ?? "", nights)}
        </p>
        <p className={styles.sim}>Simulated UPI (test mode). No money moves.</p>
        {phase === "processing" ? (
          <div className={styles.processing} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <p className={styles.sheetTitle}>Approve in {app}</p>
            <p className={styles.sheetSub}>Waiting for the simulated UPI app.</p>
          </div>
        ) : (
          <>
            <div className={styles.apps} role="group" aria-label="UPI app">
              {UPI_APPS.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  className={styles.app}
                  aria-pressed={app === a.name}
                  disabled={!sheet}
                  onClick={() => setApp(a.name)}
                >
                  <span className={styles.appMark} style={{ background: a.color }} aria-hidden="true">
                    {a.mark}
                  </span>
                  {a.name}
                  {app === a.name ? (
                    <span className={styles.appTick} aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <button ref={payRef} type="button" className={styles.primary} disabled={!sheet} onClick={pay}>
              Pay <span className="num">{inr(total)}</span>
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={!sheet}
              onClick={() => setSheet(false)}
            >
              Cancel
            </button>
            <p className={styles.fee}>UPI fee 0.4% is paid by the hotel, not you.</p>
          </>
        )}
      </div>
    </div>
  );
}
