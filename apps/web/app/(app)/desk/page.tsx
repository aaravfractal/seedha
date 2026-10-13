"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { roomParam } from "@/lib/rooms";
import type { DeskState, PropertyInfo, Slip } from "@/lib/types";
import { DeskDevice } from "@/components/DeskDevice";
import { RatingPanel } from "@/components/desk/RatingPanel";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import styles from "@/components/desk/Desk.module.css";

const HEADING = "One scan at check-in. One slip at checkout.";

function timeNow(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function DeskPage() {
  const desk = useApi<DeskState>("desk/state");
  const property = useApi<PropertyInfo>("property");
  const toast = useToast();
  // ?room=204 (from the Overview room board) preselects that guest when they are in house.
  const roomQuery = useSearchParams().get("room");
  const [room, setRoom] = useState<number | null>(() => roomParam(roomQuery));
  const [consentPath, setConsentPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [simOnline, setSimOnline] = useState<boolean | null>(null);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [ratingUrl, setRatingUrl] = useState<string | null>(null);

  const guests = useMemo(() => desk.data?.guests ?? [], [desk.data]);
  const selected = guests.find((g) => g.room === room) ?? guests[0];
  const reload = desk.reload;
  const onEvent = useCallback(
    (kind: string) => {
      if (kind === "show_ok") toast(`Consent saved at ${timeNow()}`);
      if (kind === "show_ok" || kind === "print_slip") reload();
    },
    [reload, toast],
  );
  const remember = (slip: Slip) => setSlips((prev) => [slip, ...prev].slice(0, 6));

  async function act<T>(path: string, body: object | undefined, done: (result: T) => void) {
    setBusy(true);
    try {
      done(await postJson<T>(path, body));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work");
    } finally {
      setBusy(false);
    }
  }

  if (desk.error || !desk.data) {
    return (
      <section className={`view ${styles.page}`}>
        <h1 className={styles.h1}>{HEADING}</h1>
        {desk.error ? (
          <ErrorState message={desk.error.message} code={desk.error.code} onRetry={desk.reload} />
        ) : (
          <Loading rows={2} label="Loading tonight's guests" />
        )}
      </section>
    );
  }

  const info = desk.data.device;
  const online = info.registered && (simOnline === true || (simOnline === null && info.online));
  const hotelName = property.data?.name ?? "your hotel";
  const where = `${info.name ?? "Front desk"}, ${hotelName}`;
  // Every guest can check out; consent only decides whether messages may follow (D-081).
  const canCheckout = Boolean(selected && !selected.checked_out);

  return (
    <section className={`view ${styles.page}`}>
      <h1 className={styles.h1}>{HEADING}</h1>

      <div className={styles.banner}>
        <span
          className={`${styles.dot} ${
            !info.registered || simOnline === false ? styles.dotOff : online ? styles.dotOn : styles.dotWait
          }`}
          aria-hidden="true"
        />
        <p className={styles.bannerText} role="status" aria-live="polite">
          {!info.registered
            ? "The front desk screen is not set up for this hotel yet."
            : online
              ? `Front desk screen connected · ${where}`
              : simOnline === false
                ? "The front desk screen is offline. Check the Wi-Fi and the Seedha server."
                : "Connecting to the front desk screen"}
        </p>
        <Link className={styles.pill} href="/desk/device">
          Open the front desk screen
        </Link>
      </div>
      <p className={styles.intro}>
        Run the full loop: show the QR, tick consent on the guest phone, show the checkout slip on screen,
        then book direct on Seedha Link. At reception, open the front desk screen on any phone or tablet.
      </p>

      <div className={styles.stage}>
        <div>
          <DeskDevice
            hotel={property.data?.short_name ?? "Hotel"}
            knownSlips={slips}
            onEvent={onEvent}
            onOnline={setSimOnline}
          />

          <div className={styles.guestRow}>
            <label htmlFor="guestSel">Guest at the desk</label>
            <select
              id="guestSel"
              value={selected?.room ?? ""}
              onChange={(e) => {
                setRoom(Number(e.target.value));
                setConsentPath(null);
              }}
            >
              {guests.map((g) => (
                <option key={g.booking_id} value={g.room ?? ""}>
                  Room {g.room} · {g.name}
                  {g.checked_out ? " · checked out" : g.consent ? " · said yes" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={`${styles.ctl} ${styles.ctlPrimary}`}
              disabled={busy || !selected || selected.checked_out}
              onClick={() =>
                act<{ url: string }>("desk/checkin", { room: selected?.room }, (r) => {
                  setConsentPath(new URL(r.url).pathname);
                })
              }
            >
              Show QR{selected?.room ? ` · Room ${selected.room}` : ""}
            </button>
            <button
              type="button"
              className={styles.ctl}
              disabled={busy || !selected || !canCheckout}
              aria-describedby="checkoutHint"
              onClick={() =>
                act<{ perk_code: string; slip: Slip; rating_url?: string | null }>(
                  "desk/checkout",
                  { room: selected?.room },
                  (r) => {
                    remember(r.slip);
                    setRatingUrl(r.rating_url ?? null);
                    toast(`Slip ready with ${r.perk_code}. A draft is waiting in Approvals.`);
                    desk.reload();
                  },
                )
              }
            >
              Check out and show slip
            </button>
            <button
              type="button"
              className={styles.ctl}
              disabled={busy}
              onClick={() =>
                act<Slip>("desk/close-slip", undefined, (slip) => {
                  remember(slip);
                  toast("9 PM close slip is on screen");
                })
              }
            >
              9 PM close slip
            </button>
          </div>
          <p id="checkoutHint" className={styles.hint}>
            {!selected
              ? "No guests in house tonight."
              : selected.checked_out
                ? `${selected.name} has checked out${selected.perk_code ? ` with code ${selected.perk_code}` : ""}.`
                : canCheckout
                  ? `${selected.name} said yes to offers. Check out shows the slip with their perk code.`
                  : `${selected.name} · ${selected.channel}. No yes to offers yet: the slip still shows, and no messages will be sent.`}
          </p>
          {ratingUrl ? <RatingPanel url={ratingUrl} onClose={() => setRatingUrl(null)} /> : null}
        </div>

        <div className={styles.phone} role="region" aria-label="Guest phone">
          <div className={styles.island} aria-hidden="true" />
          {consentPath ? (
            <iframe src={consentPath} title="Guest phone: consent page" key={consentPath} />
          ) : (
            <p className={styles.phoneEmpty}>Show the QR. The guest&apos;s phone screen opens here.</p>
          )}
        </div>
      </div>

      <p className={styles.footnote}>
        The QR opens the guest&apos;s real consent page on their own phone. The slip shows on screen. Nothing
        needs to be printed.
      </p>
    </section>
  );
}
