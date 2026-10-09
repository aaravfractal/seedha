"use client";

import { useCallback, useMemo, useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { DeskState, PropertyInfo, Slip } from "@/lib/types";
import { DeskDevice } from "@/components/DeskDevice";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";

export default function DeskPage() {
  const desk = useApi<DeskState>("desk/state");
  const property = useApi<PropertyInfo>("property");
  const toast = useToast();
  const [room, setRoom] = useState<number | null>(null);
  const [consentPath, setConsentPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guests = useMemo(() => desk.data?.guests ?? [], [desk.data]);
  const selected = guests.find((g) => g.room === room) ?? guests[0];
  const reload = desk.reload;
  const onEvent = useCallback(
    (kind: string) => {
      if (kind === "show_ok" || kind === "print_slip") reload();
    },
    [reload],
  );

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

  if (desk.error) {
    return (
      <section className="view">
        <h2 className="title">Seedha Desk.</h2>
        <ErrorState message={desk.error.message} code={desk.error.code} onRetry={desk.reload} />
      </section>
    );
  }
  if (!desk.data) {
    return (
      <section className="view">
        <h2 className="title">Seedha Desk.</h2>
        <Loading rows={2} label="Loading tonight's guests" />
      </section>
    );
  }

  return (
    <section className="view">
      <h2 className="title">Seedha Desk.</h2>
      <p className="sub">The box on your reception counter. One scan at check-in, one slip at checkout.</p>
      {!desk.data.device.registered ? (
        <p className="tag sim" style={{ marginBottom: 12 }}>
          No Desk box is registered. Set DESK_DEVICE_KEY in .env and run make seed.
        </p>
      ) : null}
      <div className="deskwrap">
        <div>
          <DeskDevice hotel={property.data?.short_name ?? "Hotel"} onEvent={onEvent} />
          <div className="devctl">
            <label htmlFor="guestSel" className="sr-only-text">
              Guest at the desk
            </label>
            <select
              id="guestSel"
              style={{ maxWidth: 280 }}
              value={selected?.room ?? ""}
              onChange={(e) => {
                setRoom(Number(e.target.value));
                setConsentPath(null);
              }}
            >
              {guests.map((g) => (
                <option key={g.booking_id} value={g.room ?? ""}>
                  Room {g.room} · {g.name}
                  {g.checked_out ? " (checked out)" : g.consent ? " ✓" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn small"
              disabled={busy || !selected || selected.checked_out}
              onClick={() =>
                act<{ url: string }>("desk/checkin", { room: selected?.room }, (r) => {
                  setConsentPath(new URL(r.url).pathname);
                })
              }
            >
              Show QR
            </button>
            <button
              type="button"
              className="btn small ghost"
              disabled={busy || !selected}
              onClick={() =>
                act<{ perk_code: string }>("desk/checkout", { room: selected?.room }, (r) => {
                  toast(
                    selected?.consent
                      ? `Slip printed with ${r.perk_code}. A draft is waiting in Approvals.`
                      : `Slip printed with ${r.perk_code}.`,
                  );
                  desk.reload();
                })
              }
            >
              Check out and print
            </button>
            <button
              type="button"
              className="btn small ghost"
              disabled={busy}
              onClick={() => act<Slip>("desk/close-slip", undefined, () => toast("Close slip printed"))}
            >
              9 PM close slip
            </button>
          </div>
          <p className="calc">
            {selected
              ? `${selected.name} · ${selected.channel} · ${
                  selected.consent ? "said yes to offers" : "no consent yet"
                }${selected.perk_code ? ` · perk ${selected.perk_code}` : ""}`
              : "No guests in house tonight."}
          </p>
        </div>
        <div className="phone" aria-label="Guest phone">
          <div className="notch" />
          {consentPath ? (
            <iframe src={consentPath} title="Guest phone: consent page" key={consentPath} />
          ) : (
            <div className="in">
              <p className="sub" style={{ marginTop: 80, textAlign: "center" }}>
                Guest phone. Show a QR on the desk, then it opens here.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
