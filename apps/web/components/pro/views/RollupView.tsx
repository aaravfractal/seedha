"use client";

import { useState } from "react";
import { useApi } from "@/lib/api";
import { count, inr, pctTenths } from "@/lib/format";
import { rollupPath } from "@/lib/proViews";
import type { Rollup, RollupKey } from "@/lib/types-pro";
import { ErrorState, Loading } from "@/components/States";
import s from "./proCalc.module.css";

const OPTIONS: { key: RollupKey; label: string }[] = [
  { key: "all", label: "Both" },
  { key: "a", label: "This hotel" },
  { key: "b", label: "Second hotel" },
];

/** Two-property rollup: this hotel's ledger beside a fictional second property, and both together. */
export function RollupView() {
  const [key, setKey] = useState<RollupKey>("all");
  const { data, error, loading, reload } = useApi<Rollup>(rollupPath(key));
  const view = data?.view;
  return (
    <div className={s.view}>
      <div className={s.head}>
        <p className={s.lead}>
          One view across properties. The second property is a fictional sample; this build serves one hotel.
        </p>
      </div>
      <div className={s.toggle} role="group" aria-label="Property">
        {OPTIONS.map((o) => (
          <button key={o.key} type="button" aria-pressed={o.key === key} onClick={() => setKey(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error.message} code={error.code} onRetry={reload} /> : null}
      {!view && !error ? <Loading rows={2} label="Loading the rollup" /> : null}
      {view ? (
        <div className={loading ? s.busy : undefined} aria-busy={loading} aria-live="polite">
          <p className={s.note}>
            {view.name}, {view.city}: {count(view.rooms_count)} rooms, {count(view.room_nights)} room nights,
            April to September 2026.
          </p>
          <dl className={s.stats}>
            <div>
              <dt>Room revenue at list</dt>
              <dd className={s.num}>{inr(view.lines.list_amount)}</dd>
            </div>
            <div>
              <dt>Paid to channels</dt>
              <dd className={s.num}>{inr(view.paid_to_channels)}</dd>
            </div>
            <div>
              <dt>You kept</dt>
              <dd className={s.num}>{inr(view.lines.net_kept)}</dd>
            </div>
            <div>
              <dt>Kept per room night</dt>
              <dd className={s.num}>{view.net_adr === null ? "None yet" : inr(view.net_adr)}</dd>
            </div>
            <div>
              <dt>Direct bookings</dt>
              <dd className={s.num}>
                {view.direct_bookings_tenths === null ? "None yet" : pctTenths(view.direct_bookings_tenths)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
