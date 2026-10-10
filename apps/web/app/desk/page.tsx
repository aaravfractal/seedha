"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { DeskState, PropertyInfo, Slip } from "@/lib/types";
import { DeskDevice } from "@/components/DeskDevice";
import type { DeskHandle } from "@/components/DeskDevice";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import styles from "@/components/desk/Desk.module.css";

const HEADING = "One scan at check-in. One slip at checkout.";

/** A slip made in the browser for "Test print". No money on it. */
function testSlip(where: string): Slip {
  const lines = [
    { label: "Printer OK", amount: null, bold: false },
    { label: "Paper 58 mm, black only", amount: null, bold: false },
  ];
  const footer = ["Seedha Desk simulator"];
  const text = ["TEST PRINT", where, "-".repeat(32), ...lines.map((l) => l.label), "-".repeat(32), ...footer];
  return { title: "TEST PRINT", subtitle: where, lines, footer, text: text.join("\n") };
}

function timeNow(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function DeskPage() {
  const desk = useApi<DeskState>("desk/state");
  const property = useApi<PropertyInfo>("property");
  const toast = useToast();
  const device = useRef<DeskHandle>(null);
  const [room, setRoom] = useState<number | null>(null);
  const [consentPath, setConsentPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noPaper, setNoPaper] = useState(false);
  const [simOnline, setSimOnline] = useState<boolean | null>(null);
  const [slips, setSlips] = useState<Slip[]>([]);

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
            ? "No Desk is registered. Set DESK_DEVICE_KEY in .env and run make seed."
            : online
              ? `Your Desk is connected · ${where}`
              : simOnline === false
                ? "Your Desk is offline. Check its Wi-Fi and the API."
                : "Connecting to your Desk"}
        </p>
        <button
          type="button"
          className={styles.pill}
          disabled={!online}
          onClick={() => {
            device.current?.printLocal(testSlip(where));
            if (noPaper) toast("Printer needs paper. Load paper to print.");
          }}
        >
          Test print
        </button>
      </div>
      <p className={styles.intro}>
        Run the full loop: show the QR, tick consent on the guest phone, print the checkout slip, then book
        direct on Seedha Link.
      </p>

      <div className={styles.stage}>
        <div>
          <DeskDevice
            ref={device}
            hotel={property.data?.short_name ?? "Hotel"}
            noPaper={noPaper}
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
                act<{ perk_code: string; slip: Slip }>("desk/checkout", { room: selected?.room }, (r) => {
                  remember(r.slip);
                  toast(`Slip printed with ${r.perk_code}. A draft is waiting in Approvals.`);
                  desk.reload();
                })
              }
            >
              Check out and print
            </button>
            <button
              type="button"
              className={styles.ctl}
              disabled={busy}
              onClick={() =>
                act<Slip>("desk/close-slip", undefined, (slip) => {
                  remember(slip);
                  toast("Close slip sent to the Desk");
                })
              }
            >
              9 PM close slip
            </button>
            <button
              type="button"
              className={`${styles.ctl} ${noPaper ? styles.ctlWarn : ""}`}
              onClick={() => {
                if (noPaper) {
                  setNoPaper(false);
                  device.current?.paperLoaded();
                } else {
                  setNoPaper(true);
                }
              }}
            >
              {noPaper ? "Load paper" : "Simulate no paper"}
            </button>
          </div>
          <p id="checkoutHint" className={styles.hint}>
            {!selected
              ? "No guests in house tonight."
              : selected.checked_out
                ? `${selected.name} has checked out${selected.perk_code ? ` with code ${selected.perk_code}` : ""}.`
                : canCheckout
                  ? `${selected.name} said yes to offers. Check out prints the slip with their perk code.`
                  : `${selected.name} · ${selected.channel}. No yes to offers yet: the slip still prints, and no messages will be sent.`}
          </p>
        </div>

        <div className={styles.phone} role="region" aria-label="Guest phone">
          <div className={styles.island} aria-hidden="true" />
          {consentPath ? (
            <iframe src={consentPath} title="Guest phone: consent page" key={consentPath} />
          ) : (
            <p className={styles.phoneEmpty}>Show the QR on the Desk. The guest screen opens here.</p>
          )}
        </div>
      </div>

      <p className={styles.footnote}>
        Desk screen 480 × 320 px. Slips are 58 mm thermal, black only. The QR opens the guest&apos;s real
        consent page.
      </p>
    </section>
  );
}
