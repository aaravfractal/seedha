"use client";

import { useApi } from "@/lib/api";
import { count, inr, monthRange } from "@/lib/format";
import { dayLong, readNights } from "@/lib/rooms";
import { tonightCard } from "@/lib/proSample";
import type { Ledger } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";
import { CalcNote } from "@/components/owner/ui";
import o from "@/app/(owner)/(screens)/pro/pro.module.css";

/**
 * Pro card "tonight": rooms free on the latest closed night from GET /rooms/nights
 * and the channel with the highest net ADR from GET /ledger/channels.
 */
export function TonightView() {
  const nights = useApi<unknown>("rooms/nights");
  const ledger = useApi<Ledger>("ledger/channels");
  const failed = nights.error ?? ledger.error;
  if (failed) {
    return (
      <ErrorState
        message={failed.message}
        code={failed.code}
        onRetry={() => {
          nights.reload();
          ledger.reload();
        }}
      />
    );
  }
  if (!nights.data || !ledger.data) return <Loading rows={1} label="Loading tonight" />;
  const night = readNights(nights.data).nights.at(-1);
  if (!night)
    return <p className={o.vText}>No nights closed yet. The card fills after the first 9 PM close.</p>;
  const t = tonightCard(night, ledger.data.channels);
  return (
    <div className={o.view}>
      <dl className={o.stats}>
        <div className={o.stat}>
          <dt className={o.statLabel}>Rooms free at the last close</dt>
          <dd className={o.statValue}>{count(t.roomsLeft)}</dd>
          <dd className={o.statSub}>
            of {count(t.roomsTotal)}, {dayLong(night.night)}
          </dd>
        </div>
        <div className={o.stat}>
          <dt className={o.statLabel}>Best channel</dt>
          <dd className={o.statValue}>{t.best ? t.best.name : "Not yet"}</dd>
          {t.best?.net_adr != null ? <dd className={o.statSub}>Net ADR {inr(t.best.net_adr)}</dd> : null}
        </div>
      </dl>
      <p className={o.vText}>{t.line}</p>
      <CalcNote>
        Net ADR over {monthRange(ledger.data.start, ledger.data.end)}. Rooms free from the latest 9 PM close,
        not live.
      </CalcNote>
    </div>
  );
}
