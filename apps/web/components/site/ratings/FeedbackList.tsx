"use client";

import { useState } from "react";
import { ApiError, api, useApi } from "@/lib/api";
import { ratingDate } from "@/lib/siteDetails";
import type { SiteFeedback } from "@/lib/types-site-v2-owner";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import o from "../owner.module.css";
import r from "./ratings.module.css";

function isFeedback(value: unknown): value is SiteFeedback {
  return typeof value === "object" && value !== null && typeof (value as SiteFeedback).id === "number";
}

/** Newest first; ties keep the API's order. */
function newestFirst(list: readonly SiteFeedback[]): SiteFeedback[] {
  return [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/**
 * Private notes guests sent from the card page (docs/CARD_PAGE.md). Only the
 * owner sees them: they are never shown on the hotel's site and never count in
 * the rating. The owner can mark a note as read.
 */
export function FeedbackList() {
  const toast = useToast();
  const feedback = useApi<SiteFeedback[]>("site/feedback");
  const [busy, setBusy] = useState<number | null>(null);
  const list = feedback.data ? newestFirst(feedback.data) : null;
  const unread = list ? list.filter((f) => !f.read).length : 0;

  async function markRead(note: SiteFeedback) {
    if (busy !== null || !feedback.data) return;
    setBusy(note.id);
    try {
      const out = await api<unknown>(`site/feedback/${note.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      const next = isFeedback(out) ? out : { ...note, read: true };
      feedback.setData(feedback.data.map((x) => (x.id === note.id ? next : x)));
      toast("Marked as read.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={r.stack} aria-labelledby="feedback-title" data-feedback-list="">
      <div className={o.reviewHead}>
        <div>
          <h2 id="feedback-title" className={o.h2}>
            Private notes
          </h2>
          <p className={o.sub}>
            Notes guests send you from the card page. Only you see them: they are not on your site and do not
            count in your rating.
          </p>
        </div>
      </div>

      {feedback.error && !list ? (
        <ErrorState message={feedback.error.message} code={feedback.error.code} onRetry={feedback.reload} />
      ) : !list ? (
        <Loading rows={2} label="Loading private notes" />
      ) : list.length === 0 ? (
        <p className={`${o.card} ${r.noComment}`} role="status">
          No private notes yet
        </p>
      ) : (
        <>
          <p className={r.when} role="status">
            {list.length === 1 ? "1 note" : `${list.length} notes`}
            {unread ? `, ${unread} unread` : ", all read"}
          </p>
          <ul className={r.list} aria-label="Private notes, newest first">
            {list.map((note) => (
              <li key={note.id} className={r.item} data-unread={note.read ? undefined : ""}>
                <div className={r.meta}>
                  <p className={r.when}>{ratingDate(note.created_at)}</p>
                  {note.read ? (
                    <span className={r.when}>Read</span>
                  ) : (
                    <span className="tag">
                      <span aria-hidden="true">● </span>Unread
                    </span>
                  )}
                </div>
                <p className={r.comment}>{note.message}</p>
                {note.read ? null : (
                  <div className={r.row}>
                    <button
                      type="button"
                      className="btn ghost small"
                      disabled={busy !== null}
                      aria-busy={busy === note.id || undefined}
                      aria-label={`Mark as read: note from ${ratingDate(note.created_at)}`}
                      onClick={() => void markRead(note)}
                    >
                      Mark as read
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
