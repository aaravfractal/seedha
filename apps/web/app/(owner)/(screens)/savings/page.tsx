"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import { count, inr, pctTenths } from "@/lib/format";
import type { SavingItem } from "@/lib/types";
import type { OwnerSavings, SavingsSeason } from "@/lib/types-owner";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { CalcNote, Screen, ui } from "@/components/owner/ui";
import { useCountUp } from "@/components/owner/motion";
import v from "./savings.module.css";

const TITLE = "Saved by booking direct.";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function seasonLabel(season: SavingsSeason): string {
  const [sy, sm] = season.start.split("-").map(Number);
  const [ey, em] = season.end.split("-").map(Number);
  const s = MONTHS[(sm ?? 1) - 1];
  const e = MONTHS[(em ?? 1) - 1];
  return sy === ey ? `${s} to ${e} ${ey}` : `${s} ${sy} to ${e} ${ey}`;
}

function plural(n: number, word: string): string {
  return `${count(n)} ${word}${n === 1 ? "" : "s"}`;
}

function GoldCard({ total, bookings }: { total: number; bookings: number }) {
  const shown = useCountUp(total, 900);
  return (
    <div className={v.gold}>
      <p className={v.goldLabel}>Commission saved with perk codes</p>
      <b className={v.goldValue} aria-hidden="true">
        {inr(shown)}
      </b>
      <span className="sr-only-text">{inr(total)} saved</span>
      <p className={v.goldSub}>
        {plural(bookings, "coded direct booking")} · Calculated from your statements
      </p>
    </div>
  );
}

export default function SavingsPage() {
  const savings = useApi<OwnerSavings>("savings");
  if (savings.error) {
    return (
      <Screen title={TITLE}>
        <ErrorState message={savings.error.message} code={savings.error.code} onRetry={savings.reload} />
      </Screen>
    );
  }
  if (!savings.data) {
    return (
      <Screen title={TITLE}>
        <Loading rows={3} label="Loading savings" />
      </Screen>
    );
  }
  const s = savings.data;
  return (
    <Screen title={TITLE}>
      <GoldCard total={s.total_net_saving} bookings={s.count} />
      <p className={v.rule}>
        Counted only when a perk code is used. <b>No code, no saving claimed.</b>
      </p>

      {s.count === 0 ? (
        <div className={ui.section}>
          <EmptyState
            title="No coded bookings yet"
            action={
              <Link className="btn small" href="/desk">
                Open Seedha Desk
              </Link>
            }
          >
            Complete the loop: Desk, Approvals, then Seedha Link.
          </EmptyState>
        </div>
      ) : (
        <div className={v.grid}>
          <div className={`${ui.card} ${v.ledger}`}>
            <h2 className={`${ui.sectionTitle} ${v.ledgerTitle}`}>Code ledger</h2>
            {s.items.map((item) => (
              <LedgerRow key={`${item.code}-${item.booked_at}`} item={item} />
            ))}
            <CalcNote>
              Saving = the commission and GST the guest&apos;s original channel would have taken on this
              booking, at that channel&apos;s contract rate, minus the UPI fee paid instead.
            </CalcNote>
          </div>
          <div className={v.season}>
            <h2 className={v.seasonTitle}>Season in review</h2>
            <p className={v.seasonRange}>{seasonLabel(s.season)}</p>
            <b className={v.seasonValue}>+{inr(s.season.total_net_saving)}</b>
            <span className={v.seasonLabel}>
              saved by {plural(s.season.count, "coded direct booking")} booked this season
            </span>
            <CalcNote>Bookings made after the season count in the total above, not here.</CalcNote>
          </div>
        </div>
      )}
    </Screen>
  );
}

function LedgerRow({ item }: { item: SavingItem }) {
  const avoided = item.commission_avoided + item.gst_avoided;
  return (
    <div className={`item ${v.row}`}>
      <div>
        <div className={v.guest}>{item.guest_name}</div>
        <div className={v.line}>
          Code {item.code} · {inr(item.amount)} booked direct
        </div>
        <div className={v.line}>
          {`First came via ${item.original_channel}, ${pctTenths(item.commission_rate_used / 10)} commission`}
        </div>
        <div className={v.line}>
          {`${inr(avoided)} commission and GST avoided (${inr(item.commission_avoided)} + ${inr(item.gst_avoided)} GST) · ${item.upi_fee ? `UPI fee −${inr(item.upi_fee)}` : "no UPI fee"}`}
        </div>
      </div>
      <div className={v.net}>
        <b className="num">+{inr(item.net_saving)}</b>
        <span>net saving</span>
      </div>
    </div>
  );
}
