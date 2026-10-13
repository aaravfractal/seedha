import { monthLabel, ratingsView } from "@/lib/hotelSiteV2";
import type { Lang } from "@/lib/types-site";
import type { RatingSummary } from "@/lib/types-hotel-site";
import type { V2Copy } from "./copy";
import s from "./hotel.module.css";

/** Five stars as text, filled to the nearest whole star (decoration; the number is read out instead). */
function starRow(value: number): string {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

/**
 * Verified-guest ratings, only as the API sums them: the average and count
 * once at least 3 guests have rated, with the comments the owner has not
 * hidden. Before that: "New on Seedha, no ratings yet". Nothing is invented.
 */
export function Ratings({
  ratings,
  lang,
  t,
  titleId,
  waLink,
}: {
  ratings: RatingSummary | undefined;
  lang: Lang;
  t: V2Copy;
  titleId: string;
  waLink: string;
}) {
  const view = ratingsView(ratings);
  return (
    <section className={s.section} aria-labelledby={titleId}>
      <h2 id={titleId} className={`${s.display} ${s.h2}`}>
        {t.ratings}
      </h2>
      {view.kind === "new" ? (
        <div className={s.empty} data-ratings="new">
          <p className={s.emptyTitle}>{t.noRatings}</p>
          <p className={s.muted}>{t.ratingsWho}</p>
          {waLink ? (
            <a className={s.link} href={waLink} rel="noopener noreferrer">
              {t.askHotel}
            </a>
          ) : null}
        </div>
      ) : (
        <div className={s.ratingBox} data-ratings="shown">
          <p className={s.ratingBig}>
            <span className={s.stars} aria-hidden="true">
              {starRow(Number(view.average))}
            </span>{" "}
            <b className={s.num}>{t.outOf5(view.average)}</b>{" "}
            <span className={s.muted}>{t.ratingCount(view.count)}</span>
          </p>
          <p className={s.note}>{t.ratingsWho}</p>
          {view.comments.length ? (
            <ul className={s.comments}>
              {view.comments.map((c, i) => (
                <li key={i}>
                  <p>
                    <span className={s.stars} aria-hidden="true">
                      {starRow(c.stars)}
                    </span>
                    <span className={s.srOnly}>{t.stars(c.stars)}</span>
                  </p>
                  <p>{c.comment}</p>
                  <p className={s.muted}>{monthLabel(c.month, lang)}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
