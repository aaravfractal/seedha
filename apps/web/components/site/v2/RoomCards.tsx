import type { ReactNode } from "react";
import { inr } from "@/lib/format";
import { roomDetailFor } from "@/lib/hotelSiteV2";
import type { Lang, SiteRoom } from "@/lib/types-site";
import type { RoomDetail } from "@/lib/types-hotel-site";
import type { V2Copy } from "./copy";
import s from "./hotel.module.css";

type Props = {
  rooms: SiteRoom[];
  details: RoomDetail[] | undefined;
  lang: Lang;
  t: V2Copy;
  /** "a night", "Book" (the site's shared copy). */
  aNight: string;
  bookShort: string;
  roomName: (room: SiteRoom) => string;
  /** The room's photo (the owner's chosen photo, else the page's usual one). */
  photo: (room: SiteRoom, index: number, detail: RoomDetail | null) => ReactNode;
  /** Seedha Link for this room type (the room is preselected there). */
  bookHref: (room: SiteRoom) => string;
  waLink: string;
};

/** The room's owner-entered facts in the page language (Hindi falls back to English). */
function facts(detail: RoomDetail, lang: Lang, t: V2Copy): string[] {
  const out: string[] = [];
  if (detail.size_sqft && detail.size_sqft > 0) out.push(t.sqft(detail.size_sqft));
  const hi = (detail.beds_hi ?? "").trim();
  const beds = lang === "hi" && hi ? hi : (detail.beds_en ?? "").trim();
  if (beds) out.push(beds);
  if (detail.max_guests && detail.max_guests > 0) out.push(t.guests(detail.max_guests));
  return out;
}

function features(detail: RoomDetail, lang: Lang): string[] {
  const hi = (detail.features_hi ?? []).filter((f) => f.trim());
  const list = lang === "hi" && hi.length ? hi : (detail.features_en ?? []);
  return list.filter((f) => f.trim()).slice(0, 2);
}

/**
 * Room cards: photo, name, size, beds, guests, up to two features, and the
 * price exactly as the API sends it. "Book" goes to Seedha Link with the
 * room preselected; a room Seedha Link cannot book asks the hotel instead.
 */
export function RoomCards({
  rooms,
  details,
  lang,
  t,
  aNight,
  bookShort,
  roomName,
  photo,
  bookHref,
  waLink,
}: Props) {
  return (
    <div className={s.rooms}>
      {rooms.map((r, i) => {
        const detail = roomDetailFor(details, r.room_type);
        const lines = detail ? facts(detail, lang, t) : [];
        const extras = detail ? features(detail, lang) : [];
        return (
          <article key={r.room_type} className={s.room}>
            {photo(r, i, detail)}
            <div className={s.roomBody}>
              <h3 className={s.display}>{roomName(r)}</h3>
              {r.detail[lang] ? <p className={s.muted}>{r.detail[lang]}</p> : null}
              {lines.length ? (
                <ul className={s.roomFacts} aria-label={t.roomFacts}>
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {extras.length ? (
                <ul className={s.features}>
                  {extras.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
              <div className={s.priceRow}>
                <p className={s.price}>
                  <b className={s.num}>{inr(r.nightly_rate)}</b> <span>{aNight}</span>
                </p>
                {r.bookable ? (
                  <a className={s.pill} href={bookHref(r)} aria-label={`${bookShort}: ${roomName(r)}`}>
                    {bookShort}
                  </a>
                ) : waLink ? (
                  <a
                    className={s.pill}
                    href={waLink}
                    rel="noopener noreferrer"
                    aria-label={`${t.askHotel}: ${roomName(r)}`}
                  >
                    {t.askHotel}
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
