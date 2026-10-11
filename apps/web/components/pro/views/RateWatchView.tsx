"use client";

import { inr, pctTenths } from "@/lib/format";
import { RATE_WATCH_SAMPLE, parityGap, parityLine } from "@/lib/proSample";
import o from "@/app/(owner)/(screens)/pro/pro.module.css";

/**
 * Pro card "rate-watch": a sample screenshot comparison. The two prices are
 * fixed sample values; the gap is computed in code (lib/proSample.ts).
 */
export function RateWatchView() {
  const s = RATE_WATCH_SAMPLE;
  const g = parityGap(s.ota.price, s.direct.price);
  return (
    <div className={o.view}>
      <p className={o.vNote}>
        {s.room}, {s.stayDate}. From your screenshot. No scraping.
      </p>
      <div className={o.priceTiles}>
        {[
          { side: "ota" as const, tile: s.ota },
          { side: "direct" as const, tile: s.direct },
        ].map(({ side, tile }) => (
          <div className={o.priceTile} key={side} data-lower={g.lower === side ? "true" : "false"}>
            <span className={o.priceName}>{tile.name}</span>
            <span className={o.price}>{inr(tile.price)}</span>
          </div>
        ))}
      </div>
      {g.lower === "equal" ? null : (
        <p className={o.gapLine}>
          <span className={o.gapFigure}>{inr(g.gap)}</span>
          <span className={o.vNote}>parity gap, {pctTenths(g.gapTenths)} of your direct price</span>
        </p>
      )}
      <p className={o.vText}>{parityLine(s)}</p>
    </div>
  );
}
