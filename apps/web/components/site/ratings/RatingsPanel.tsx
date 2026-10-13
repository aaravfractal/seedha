"use client";

import { useState } from "react";
import { ApiError, api, useApi } from "@/lib/api";
import { RATINGS_PUBLIC_FROM, ratingDate, ratingSource, ratingsSummary, starsLabel } from "@/lib/siteDetails";
import type { SiteRating } from "@/lib/types-site-v2-owner";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import o from "../owner.module.css";
import r from "./ratings.module.css";

export function Stars({ stars }: { stars: number }) {
  return (
    <span className={r.stars} role="img" aria-label={starsLabel(stars)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= stars ? undefined : r.off}>
          ★
        </span>
      ))}
    </span>
  );
}

function isRating(value: unknown): value is SiteRating {
  return typeof value === "object" && value !== null && typeof (value as SiteRating).id === "number";
}

/**
 * Ratings from verified guests (a direct booking through Seedha Link or a
 * front desk checkout). The owner can hide or show a comment; stars cannot be
 * edited, and nothing here is ever invented.
 */
export function RatingsPanel() {
  const toast = useToast();
  const ratings = useApi<SiteRating[]>("site/ratings");
  const [busy, setBusy] = useState<number | null>(null);
  const list = ratings.data;

  async function toggle(rating: SiteRating) {
    if (busy !== null || !list) return;
    const hidden = !rating.hidden;
    setBusy(rating.id);
    try {
      const out = await api<unknown>(`site/ratings/${rating.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      const next = isRating(out) ? out : { ...rating, hidden };
      ratings.setData(list.map((x) => (x.id === rating.id ? next : x)));
      toast(hidden ? "Comment hidden. The stars still count." : "Comment shown on your site.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={r.stack} aria-labelledby="ratings-title">
      <div className={o.reviewHead}>
        <div>
          <h2 id="ratings-title" className={o.h2}>
            Ratings
          </h2>
          <p className={o.sub}>
            Only verified guests can rate: guests who booked direct through Seedha Link or checked out at the
            front desk get a one-time link.
          </p>
        </div>
      </div>
      <ul className={r.rules}>
        <li>Stars cannot be edited. You can hide a comment that is abusive; its stars still count.</li>
        <li>
          Your site shows the average and the count only from {RATINGS_PUBLIC_FROM} ratings. Before that it
          says it is new on Seedha.
        </li>
      </ul>

      {ratings.error && !list ? (
        <ErrorState message={ratings.error.message} code={ratings.error.code} onRetry={ratings.reload} />
      ) : !list ? (
        <Loading rows={2} label="Loading ratings" />
      ) : list.length === 0 ? (
        <p className={`${o.card} ${r.noComment}`} role="status">
          No ratings yet. They appear here when a verified guest rates their stay.
        </p>
      ) : (
        <>
          <p className={r.when} role="status">
            {ratingsSummary(list.length)}
          </p>
          <ul className={r.list} aria-label="Ratings, newest first">
            {list.map((rating) => {
              const comment = (rating.comment ?? "").trim();
              return (
                <li key={rating.id} className={r.item}>
                  <div className={r.meta}>
                    <Stars stars={rating.stars} />
                    <p className={r.when}>
                      {ratingDate(rating.created_at)} · {ratingSource(rating.source)}
                    </p>
                  </div>
                  {comment ? (
                    <>
                      <p className={`${r.comment} ${rating.hidden ? r.hiddenComment : ""}`}>{comment}</p>
                      <div className={r.row}>
                        <span className="tag">
                          {rating.hidden ? "Hidden from your site" : "On your site"}
                        </span>
                        <button
                          type="button"
                          className="btn ghost small"
                          disabled={busy !== null}
                          aria-busy={busy === rating.id || undefined}
                          aria-label={`${rating.hidden ? "Show" : "Hide"} comment from ${ratingDate(rating.created_at)}`}
                          onClick={() => void toggle(rating)}
                        >
                          {rating.hidden ? "Show comment" : "Hide comment"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className={r.noComment}>No comment, stars only.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
