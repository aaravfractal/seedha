"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, postJson, useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { channelColour } from "@/lib/channels";
import { dayLong, tileLabel } from "@/lib/rooms";
import type { RoomDetail, RoomTile } from "@/lib/types-rooms";
import { useDialogFocus } from "@/components/useDialogFocus";
import { useToast } from "@/components/Toast";
import { Chip } from "@/components/owner/ui";
import s from "./roomBoard.module.css";

/** A deduction line: "−₹1,234", or "₹0" when nothing was taken. */
const minus = (paise: number) => (paise > 0 ? inr(-paise) : inr(0));

function MoneyLines({ d }: { d: RoomDetail }) {
  // Walk-in and direct rooms pay no commission (ruling 4): no commission lines.
  const noCommission = d.commission === 0 && d.gst_on_commission === 0 && d.if_direct === null;
  return (
    <dl className={s.lines} data-testid="room-money">
      <div>
        <dt>List rate</dt>
        <dd>{inr(d.list_amount)}</dd>
      </div>
      <div>
        <dt>Discount</dt>
        <dd>{minus(d.discount)}</dd>
      </div>
      {noCommission ? null : (
        <>
          <div>
            <dt>Commission</dt>
            <dd>{minus(d.commission)}</dd>
          </div>
          <div>
            <dt>GST on commission</dt>
            <dd>{minus(d.gst_on_commission)}</dd>
          </div>
        </>
      )}
      <div>
        <dt>Fees</dt>
        <dd>{minus(d.fees)}</dd>
      </div>
      <div className={s.netLine}>
        <dt>Net kept</dt>
        <dd>{inr(d.net_kept)}</dd>
      </div>
    </dl>
  );
}

function Details({ d, night }: { d: RoomDetail; night: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const consented = d.consent_status === "consented_at_desk" && d.consent_id !== null;

  async function sendSlip() {
    setBusy(true);
    try {
      await postJson(`rooms/${night}/${d.room}/slip`);
      toast("Slip sent to the front desk screen.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "The slip could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={s.who}>
        <span className={s.initials} aria-label={`Guest ${d.guest_initials}`} data-testid="room-initials">
          {d.guest_initials}
        </span>
        <div className={s.whoText}>
          <b>
            <i style={{ background: channelColour(d.channel_key) }} aria-hidden="true" />
            {d.channel_name}
          </b>
          <span>
            {d.nights} night{d.nights === 1 ? "" : "s"}
          </span>
        </div>
        <Chip tone={consented ? "ok" : "plain"} dot>
          {consented ? "Consented at front desk" : "Not consented"}
        </Chip>
      </div>

      <MoneyLines d={d} />

      {d.if_direct ? (
        <section className={s.ifDirect} aria-labelledby="if-direct-title" data-testid="room-if-direct">
          <div className={s.ifHead}>
            <h3 id="if-direct-title">If this room had been direct</h3>
            <Chip tone="sample" className={s.illus}>
              {d.if_direct.label || "Illustration"}
            </Chip>
          </div>
          <p className={s.ifValue}>{inr(d.if_direct.extra_kept)} more kept if direct</p>
          <p className={s.ifNote}>
            Commission {inr(d.if_direct.commission_avoided)} and GST on it {inr(d.if_direct.gst_avoided)}{" "}
            would have stayed with you, minus the UPI fee of {inr(d.if_direct.upi_fee)}.
          </p>
        </section>
      ) : null}

      <div className={s.actions}>
        <Link href={`/desk?room=${d.room}`} className="btn ghost">
          Open at front desk
        </Link>
        {consented ? (
          <Link href={`/inbox?thread=${d.consent_id}`} className="btn ghost">
            Message guest
          </Link>
        ) : null}
        <button type="button" className="btn" onClick={sendSlip} disabled={busy}>
          {busy ? "Sending" : "Send slip to the front desk"}
        </button>
      </div>
      {consented ? null : (
        <p className={s.sheetNote}>Seedha messages only guests who said yes at the front desk.</p>
      )}
    </>
  );
}

function Loaded({ night, room }: { night: string; room: number }) {
  const detail = useApi<RoomDetail>(`rooms/${night}/${room}`);
  if (detail.data) return <Details d={detail.data} night={night} />;
  if (detail.error) {
    return (
      <div className={s.sheetError} role="alert">
        <p>{detail.error.status === 404 ? "No booking found for this room." : detail.error.message}</p>
        <button type="button" className="btn ghost small" onClick={detail.reload}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" className={s.sheetLoading}>
      <span className="sr-only-text">Loading room {room}</span>
      <div className="skeleton" style={{ height: 56 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  );
}

/**
 * One room on one night: side sheet on wider screens, bottom sheet on a
 * phone. Every rupee comes from GET /rooms/{night}/{room}. Escape, the scrim
 * and Close shut it; focus returns to the tile.
 */
export function RoomSheet({ night, tile, onClose }: { night: string; tile: RoomTile; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // The page behind the sheet is inert while it is open (review F9). Declared
  // before the focus hook so inert is lifted before focus returns to the tile.
  useEffect(() => {
    const own = scrim.current;
    const made = Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el !== own &&
        !el.inert &&
        // Toasts stay announced while the sheet is open.
        !el.matches("[aria-live], [role=status], [role=alert]") &&
        !["SCRIPT", "STYLE", "NEXT-ROUTE-ANNOUNCER"].includes(el.tagName),
    );
    for (const el of made) el.inert = true;
    return () => {
      for (const el of made) el.inert = false;
    };
  }, []);
  useDialogFocus(ref, true, onClose);
  // Portalled to <body>: the screen's enter transform would otherwise trap
  // the fixed scrim inside the content column.
  return createPortal(
    <div ref={scrim} className={s.scrim} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="room-sheet"
      >
        <div className={s.sheetHead}>
          <div>
            <h2 id={titleId} className={s.sheetTitle}>
              Room {tile.room}
            </h2>
            <p className={s.sheetSub}>Night of {dayLong(night)}</p>
          </div>
          <button type="button" className={s.close} onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {tile.sold ? (
          <Loaded night={night} room={tile.room} />
        ) : (
          <>
            <p className={s.emptyText}>{tileLabel(tile)}. No guest stayed in this room that night.</p>
            <div className={s.actions}>
              <Link href={`/desk?room=${tile.room}`} className="btn ghost">
                Open at front desk
              </Link>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
