"use client";

import { useId, useState } from "react";
import { useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import {
  DEBOUNCE_MS,
  RATE_MAX,
  RATE_MIN,
  RATE_START,
  RATE_STEP,
  bpsLabel,
  clampRate,
  floorPath,
} from "@/lib/proViews";
import { useDebounced } from "@/lib/useDebounced";
import type { Floor } from "@/lib/types-pro";
import { ErrorState, Loading } from "@/components/States";
import s from "./proCalc.module.css";

/** Floor by channel: a room-rate slider; the API returns what each channel keeps and its floor. */
export function FloorView() {
  const slider = useId();
  const [rate, setRate] = useState(RATE_START);
  const settled = useDebounced(rate, DEBOUNCE_MS);
  const { data, error, loading, reload } = useApi<Floor>(floorPath(settled));
  const stale = loading || settled !== rate;
  return (
    <div className={s.view}>
      <div className={s.head}>
        <p className={s.lead}>
          The floor is the lowest rate where a room night still leaves you{" "}
          {data ? <b className={s.num}>{inr(data.target)}</b> : "your minimum"} after commission, 18% GST on
          commission and fees.
          {data?.target_is_sample ? " The minimum is a sample figure." : null}
        </p>
      </div>
      <div className={s.sliderRow}>
        <label className={s.sliderLabel} htmlFor={slider}>
          <span>Room rate for one night</span>
          <span className={s.num}>{inr(rate * 100)}</span>
        </label>
        <input
          id={slider}
          className={s.slider}
          type="range"
          min={RATE_MIN}
          max={RATE_MAX}
          step={RATE_STEP}
          value={rate}
          aria-valuetext={inr(rate * 100)}
          onChange={(e) => setRate(clampRate(Number(e.target.value)))}
        />
      </div>
      {error ? <ErrorState message={error.message} code={error.code} onRetry={reload} /> : null}
      {!data && !error ? <Loading rows={3} label="Loading floors" /> : null}
      {data ? (
        <div
          className={`${s.tableWrap} ${stale ? s.busy : ""}`}
          tabIndex={0}
          role="region"
          aria-label="Floor table"
          aria-busy={stale}
        >
          <table className={s.table}>
            <caption>
              At {inr(data.rate)} a night. Each floor keeps you at least {inr(data.target)} a night.
            </caption>
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">Commission</th>
                <th scope="col">You keep</th>
                <th scope="col">Floor rate</th>
                <th scope="col">Worth taking</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.channel_key}>
                  <th scope="row">{row.channel_name}</th>
                  <td>
                    {bpsLabel(row.commission_bps)}
                    {row.gst_applies ? " + GST" : ""}
                  </td>
                  <td>{inr(row.at_rate.net_kept)}</td>
                  <td>{inr(row.floor_rate)}</td>
                  <td className={row.worth_taking ? s.yes : s.no}>{row.worth_taking ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
