"use client";

import { useApi } from "@/lib/api";
import { inr, pctTenths } from "@/lib/format";
import { splitWidths } from "@/lib/proViews";
import type { DiscountSplit } from "@/lib/types-pro";
import { ErrorState, Loading } from "@/components/States";
import s from "./proCalc.module.css";

/** Who paid the discount: per OTA promotion, hotel-funded (from statements) vs OTA-funded (sample). */
export function DiscountSplitView() {
  const { data, error, loading, reload } = useApi<DiscountSplit>("pro/discount-split");
  if (error) return <ErrorState message={error.message} code={error.code} onRetry={reload} />;
  if (loading || !data) return <Loading rows={3} label="Loading the discount split" />;
  return (
    <div className={s.view}>
      <div className={s.head}>
        <p className={s.lead}>
          Your statements show {inr(data.total_hotel_funded)} of discount that you funded. The OTA-funded part
          is not on statements, so it is a sample figure here.
        </p>
      </div>
      <ul className={s.bars}>
        {data.rows.map((row) => {
          const [hotel, ota] = splitWidths(row.hotel_funded, row.ota_funded);
          return (
            <li key={row.channel_key}>
              <div className={s.barHead}>
                <span className={s.barName}>
                  {row.channel_name}: {row.promotion}
                </span>
                {row.hotel_share_tenths === null ? null : (
                  <span className={s.num}>You paid {pctTenths(row.hotel_share_tenths)}</span>
                )}
              </div>
              <div
                className={s.bar}
                role="img"
                aria-label={`${row.channel_name}: you funded ${inr(row.hotel_funded)}, the OTA funded ${inr(row.ota_funded)} (sample)`}
              >
                <span className={s.hotelPart} style={{ width: `${hotel}%` }} />
                <span className={s.otaPart} style={{ width: `${ota}%` }} />
              </div>
              <dl className={s.legend}>
                <div className={s.legendItem}>
                  <dt>
                    <span className={`${s.swatch} ${s.hotelPart}`} aria-hidden="true" />
                    You funded
                  </dt>
                  <dd className={s.num}>{inr(row.hotel_funded)}</dd>
                </div>
                <div className={s.legendItem}>
                  <dt>
                    <span className={`${s.swatch} ${s.otaPart}`} aria-hidden="true" />
                    OTA funded (sample)
                  </dt>
                  <dd className={s.num}>{inr(row.ota_funded)}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      <p className={s.note}>Ask each OTA for its promotion funding report to replace the sample part.</p>
    </div>
  );
}
