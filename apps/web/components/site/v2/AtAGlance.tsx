import { inr } from "@/lib/format";
import { fromPrice } from "@/lib/hotelSiteV2";
import type { HotelSitePayload } from "@/lib/types-hotel-site";
import type { V2Copy } from "./copy";
import s from "./hotel.module.css";

/**
 * At a glance: how many rooms, how many room types, check-in and check-out,
 * and the starting price exactly as the API computed it (formatted only).
 * A fact the hotel has not given is left out.
 */
export function AtAGlance({ site, t, titleId }: { site: HotelSitePayload; t: V2Copy; titleId: string }) {
  const from = fromPrice(site);
  const facts: [string, string][] = [];
  if (site.rooms_count > 0) facts.push([t.roomsCount, String(site.rooms_count)]);
  if (site.rooms.length > 0) facts.push([t.roomTypes, String(site.rooms.length)]);
  if (site.details.check_in) facts.push([t.checkIn, site.details.check_in]);
  if (site.details.check_out) facts.push([t.checkOut, site.details.check_out]);
  if (!facts.length && from === null) return null;
  return (
    <section className={s.section} aria-labelledby={titleId}>
      <h2 id={titleId} className={`${s.display} ${s.h2}`}>
        {t.atAGlance}
      </h2>
      {from !== null ? (
        <p className={s.fromPrice} data-testid="from-price">
          {t.fromNight(inr(from))}
        </p>
      ) : null}
      <dl className={s.glance}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={s.num}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
