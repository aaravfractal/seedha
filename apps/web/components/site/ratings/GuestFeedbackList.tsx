"use client";

import { useState } from "react";
import { ApiError, api, useApi } from "@/lib/api";
import { ratingDate } from "@/lib/siteDetails";
import type { GuestFeedback, SendRewardResult } from "@/lib/types-site-v2-owner";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Stars } from "./RatingsPanel";
import o from "../owner.module.css";
import r from "./ratings.module.css";

const REWARD_LABELS: Record<string, string> = {
  breakfast: "Free breakfast",
  pct5: "5% off next direct stay",
  flat100: "₹100 off next direct stay",
};

function rewardLabel(reward: string): string {
  return REWARD_LABELS[reward] ?? (reward ? reward : "No reward");
}

function isGuestFeedback(value: unknown): value is GuestFeedback {
  return typeof value === "object" && value !== null && typeof (value as GuestFeedback).id === "number";
}

function newestFirst(list: readonly GuestFeedback[]): GuestFeedback[] {
  return [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/** Why "Send reward code" is off for this feedback, or null when it can be sent. */
function sendBlocked(f: GuestFeedback): string | null {
  if (f.status === "reward_sent") return "Reward code already sent.";
  if (f.status === "hidden") return "Hidden. Show it to send a reward.";
  if (!f.consent) return "The guest did not agree to WhatsApp messages.";
  if (!f.has_phone) return "No WhatsApp number on file.";
  return null;
}

/** The send result in plain words, honest about simulated sends. */
function resultText(out: SendRewardResult): string {
  if (out.sent === "whatsapp") return `Code ${out.code} sent on WhatsApp.`;
  if (out.sent === "simulated")
    return `Simulated send. Code ${out.code} was logged, no WhatsApp message left Seedha.`;
  return `Not sent. ${out.reason ?? "The message could not be sent."} Code ${out.code} is saved.`;
}

/**
 * Feedback guests left on the card page form (docs/CARD_PAGE.md). Private to
 * the hotel. The owner approves every reward code send; nothing goes out on
 * its own, and the phone number never reaches the browser.
 */
export function GuestFeedbackList() {
  const toast = useToast();
  const feedback = useApi<GuestFeedback[]>("site/guest-feedback");
  const [busy, setBusy] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, string>>({});
  const list = feedback.data ? newestFirst(feedback.data) : null;

  function replace(next: GuestFeedback) {
    if (!feedback.data) return;
    feedback.setData(feedback.data.map((x) => (x.id === next.id ? next : x)));
  }

  async function patch(f: GuestFeedback, body: { read?: boolean; hidden?: boolean }, done: string) {
    if (busy !== null) return;
    setBusy(f.id);
    try {
      const out = await api<unknown>(`site/guest-feedback/${f.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const fallback: GuestFeedback = {
        ...f,
        read: body.read ?? f.read,
        status: body.hidden === true ? "hidden" : body.hidden === false ? "new" : f.status,
      };
      replace(isGuestFeedback(out) ? out : fallback);
      toast(done);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function sendReward(f: GuestFeedback) {
    if (busy !== null) return;
    setBusy(f.id);
    setConfirming(null);
    try {
      const out = await api<SendRewardResult>(`site/guest-feedback/${f.id}/send-reward`, { method: "POST" });
      const text = resultText(out);
      setResults((prev) => ({ ...prev, [f.id]: text }));
      if (out.sent !== "not_sent") replace({ ...f, status: "reward_sent" });
      toast(text);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not send the reward code. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={r.stack} aria-labelledby="guest-feedback-title" data-guest-feedback="">
      <div className={o.reviewHead}>
        <div>
          <h2 id="guest-feedback-title" className={o.h2}>
            Guest feedback
          </h2>
          <p className={o.sub}>
            Feedback from the card page form. Only you see it. You approve every reward code before it goes
            out.
          </p>
        </div>
      </div>

      {feedback.error && !list ? (
        <ErrorState message={feedback.error.message} code={feedback.error.code} onRetry={feedback.reload} />
      ) : !list ? (
        <Loading rows={2} label="Loading guest feedback" />
      ) : list.length === 0 ? (
        <p className={`${o.card} ${r.noComment}`} role="status">
          No guest feedback yet
        </p>
      ) : (
        <ul className={r.list} aria-label="Guest feedback, newest first">
          {list.map((f) => {
            const blocked = sendBlocked(f);
            const hidden = f.status === "hidden";
            const who = `${f.name} on ${ratingDate(f.created_at)}`;
            return (
              <li key={f.id} className={r.item} data-unread={f.read ? undefined : ""}>
                <div className={r.meta}>
                  <h3 className={r.name}>{f.name}</h3>
                  <p className={r.when}>{ratingDate(f.created_at)}</p>
                </div>
                <div className={r.tags}>
                  <span className="tag">{f.verified ? "Verified" : "Not verified"}</span>
                  {f.read ? null : (
                    <span className="tag">
                      <span aria-hidden="true">● </span>Unread
                    </span>
                  )}
                  {hidden ? <span className="tag">Hidden</span> : null}
                  {f.status === "reward_sent" ? <span className="tag">Reward sent</span> : null}
                </div>
                <dl className={r.facts}>
                  <div>
                    <dt>Overall</dt>
                    <dd>
                      <Stars stars={f.overall} />
                    </dd>
                  </div>
                  <div>
                    <dt>Food</dt>
                    <dd>{f.food === null ? "Not rated" : <Stars stars={f.food} />}</dd>
                  </div>
                  <div>
                    <dt>Reward chosen</dt>
                    <dd>{rewardLabel(f.reward)}</dd>
                  </div>
                  <div>
                    <dt>WhatsApp consent</dt>
                    <dd>{f.consent ? "Yes" : "No"}</dd>
                  </div>
                  {f.booking_ref ? (
                    <div>
                      <dt>Booking</dt>
                      <dd>{f.booking_ref}</dd>
                    </div>
                  ) : null}
                </dl>
                {f.review.trim() ? (
                  <p className={`${r.comment} ${hidden ? r.hiddenComment : ""}`}>{f.review}</p>
                ) : (
                  <p className={r.noComment}>No review, stars only.</p>
                )}
                {results[f.id] ? (
                  <p className={r.when} role="status">
                    {results[f.id]}
                  </p>
                ) : null}
                {confirming === f.id ? (
                  <div className={r.row} role="group" aria-label={`Approve reward code for ${f.name}`}>
                    <p className={r.when}>
                      Send a one-time {rewardLabel(f.reward)} code to {f.name} on WhatsApp?
                    </p>
                    <div className={r.actions}>
                      <button
                        type="button"
                        className="btn small"
                        disabled={busy !== null}
                        onClick={() => void sendReward(f)}
                      >
                        Approve and send
                      </button>
                      <button type="button" className="btn ghost small" onClick={() => setConfirming(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={r.actions}>
                    <button
                      type="button"
                      className="btn small"
                      disabled={busy !== null || blocked !== null}
                      aria-busy={busy === f.id || undefined}
                      aria-describedby={blocked ? `gf-why-${f.id}` : undefined}
                      aria-label={`Send reward code to ${who}`}
                      onClick={() => setConfirming(f.id)}
                    >
                      Send reward code
                    </button>
                    {f.read ? null : (
                      <button
                        type="button"
                        className="btn ghost small"
                        disabled={busy !== null}
                        aria-label={`Mark as read: feedback from ${who}`}
                        onClick={() => void patch(f, { read: true }, "Marked as read.")}
                      >
                        Mark as read
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn ghost small"
                      disabled={busy !== null}
                      aria-label={`${hidden ? "Show" : "Hide"} feedback from ${who}`}
                      onClick={() =>
                        void patch(
                          f,
                          { hidden: !hidden },
                          hidden ? "Feedback shown again." : "Feedback hidden.",
                        )
                      }
                    >
                      {hidden ? "Show" : "Hide"}
                    </button>
                  </div>
                )}
                {blocked && confirming !== f.id ? (
                  <p className={r.noComment} id={`gf-why-${f.id}`}>
                    {blocked}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
