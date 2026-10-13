"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, postJson } from "@/lib/api";
import {
  BOOKING_REF_MAX,
  FEEDBACK_MAX,
  bookAgainHref,
  bookAgainLine,
  cleanBookingRef,
  cleanLast4,
  feedbackError,
  stayPrefill,
} from "@/lib/cardWelcome";
import { RATING_COMMENT_MAX, ratingCommentError } from "@/lib/hotelSiteV2";
import type { CardVerify, ScanCard } from "@/lib/types-hotel-site";
import type { Lang } from "@/lib/types-site";
import type { V2Copy } from "./copy";
import s from "./CardWelcome.module.css";

type Here = { protocol: string; hostname: string; port: string };
type CardCopy = V2Copy["card"];

/**
 * Runs before the panel is parsed: on a card visit it marks <html>, and the
 * panel's CSS shows the server-rendered panel from the first paint, so the
 * page below it never moves (no layout shift). Same test as scanCardFrom().
 */
const GATE = `try{var c=new URLSearchParams(location.search).get("src");if(c==="card-wallet"||c==="card-room"||c==="card-desk")document.documentElement.setAttribute("data-hs-card","")}catch(e){}`;

type Rate =
  | { step: "ref"; ask4: boolean; note: "" | "not_found" | "not_ended" }
  | { step: "stars"; verify: CardVerify }
  | { step: "rated"; verify: CardVerify }
  | { step: "already" };

function errorText(err: unknown, t: CardCopy): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return t.offline;
    if (err.status === 429) return t.tooMany;
  }
  return t.failed;
}

/** A small "Sample" label for the sample hotel's perk (rule 11). */
function SampleTag({ text }: { text: string }) {
  return <span className={s.sample}>{text}</span>;
}

/**
 * The card welcome panel (docs/CARD_PAGE.md, PART 2): a guest who scanned a
 * printed card sees thanks, can rate the stay after the booking reference is
 * checked, can send a private note to the hotel, and can book again on Seedha
 * Link at the public rate (the owner's own perk words only; never a price).
 * `gate`: the first server-rendered pass, before the page knows the address;
 * the panel is then shown by CSS only on a card visit. Preview: nothing is sent.
 */
export function CardWelcome({
  slug,
  hotel,
  lang,
  t,
  sampleText,
  perk,
  isSample,
  bookingUrl,
  firstRoom,
  here,
  card,
  gate,
  preview = false,
}: {
  slug: string;
  hotel: string;
  lang: Lang;
  t: CardCopy;
  sampleText: string;
  /** The owner's card perk in the page language, as the API sent it ("" for none). */
  perk: string;
  isSample: boolean;
  bookingUrl: string | null | undefined;
  /** The first bookable room type, "" when none can be booked (Book again then hides). */
  firstRoom: string;
  here?: Here;
  card: ScanCard | null;
  gate: boolean;
  preview?: boolean;
}) {
  const uid = useId();
  const id = (part: string) => `${uid}-${part}`;
  const base = `public/site/${encodeURIComponent(slug)}/card`;

  // Rate your stay
  const [rate, setRate] = useState<Rate>({ step: "ref", ask4: false, note: "" });
  const [ref, setRef] = useState("");
  const [last4, setLast4] = useState("");
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState("");
  const commentProblem = ratingCommentError(comment);

  // Private note
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteSent, setNoteSent] = useState(false);

  const verified = rate.step === "stars" || rate.step === "rated" ? rate.verify : null;
  const line = bookAgainLine(perk, lang);
  const code = stayPrefill(verified).code;
  const bookHref = bookAgainHref({ bookingUrl, verify: verified, firstRoom, here });

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rateBusy || rate.step !== "ref") return;
    const cleanRef = cleanBookingRef(ref);
    if (!cleanRef) return setRateError(t.refBad);
    const clean4 = rate.ask4 ? cleanLast4(last4) : null;
    if (rate.ask4 && !clean4) return setRateError(t.last4Bad);
    setRateError("");
    if (preview) return;
    setRateBusy(true);
    try {
      const out = await postJson<CardVerify>(
        `${base}/verify`,
        clean4 ? { booking_ref: cleanRef, phone_last4: clean4 } : { booking_ref: cleanRef },
      );
      if (out?.state === "verified" && out.stay_token) setRate({ step: "stars", verify: out });
      else if (out?.state === "needs_phone") setRate({ step: "ref", ask4: true, note: "" });
      else if (out?.state === "already_rated") setRate({ step: "already" });
      else if (out?.state === "not_ended") setRate({ step: "ref", ask4: rate.ask4, note: "not_ended" });
      else setRate({ step: "ref", ask4: rate.ask4, note: "not_found" });
    } catch (err) {
      setRateError(errorText(err, t));
    } finally {
      setRateBusy(false);
    }
  }

  async function sendRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rateBusy || rate.step !== "stars") return;
    if (stars < 1 || stars > 5) return setRateError(t.pick);
    if (commentProblem) return setRateError(commentProblem === "too_long" ? t.tooLong : t.badChars);
    setRateError("");
    if (preview) return;
    setRateBusy(true);
    try {
      const text = comment.trim();
      await postJson(`${base}/rate`, {
        stay_token: rate.verify.stay_token,
        stars,
        ...(text ? { comment: text } : {}),
      });
      setRate({ step: "rated", verify: rate.verify });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setRate({ step: "already" });
      else setRateError(errorText(err, t));
    } finally {
      setRateBusy(false);
    }
  }

  async function sendNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (noteBusy || noteSent) return;
    const problem = feedbackError(note);
    if (problem) return setNoteError(problem === "empty" ? t.noteEmpty : t.noteTooLong);
    setNoteError("");
    if (preview) return;
    setNoteBusy(true);
    try {
      await postJson(`${base}/feedback`, { message: note.trim() });
      setNoteSent(true);
      setNote("");
    } catch (err) {
      setNoteError(errorText(err, t));
    } finally {
      setNoteBusy(false);
    }
  }

  let rateBody;
  if (rate.step === "rated") {
    rateBody = (
      <p className={s.done} role="status">
        {t.rated}
      </p>
    );
  } else if (rate.step === "already") {
    rateBody = (
      <p className={s.done} role="status">
        {t.alreadyRated}
      </p>
    );
  } else if (rate.step === "stars") {
    rateBody = (
      <form onSubmit={sendRating} noValidate>
        <fieldset className={s.stars}>
          <legend>{t.legend}</legend>
          <div className={s.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={`${s.star} ${stars >= n ? s.on : ""}`}>
                <input
                  type="radio"
                  name={id("stars")}
                  value={n}
                  checked={stars === n}
                  onChange={() => {
                    setStars(n);
                    setRateError("");
                  }}
                />
                <span aria-hidden="true">★</span>
                <span className={s.srOnly}>{t.star(n)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className={s.label} htmlFor={id("comment")}>
          {t.comment}
        </label>
        <textarea
          id={id("comment")}
          className={s.input}
          rows={3}
          value={comment}
          maxLength={RATING_COMMENT_MAX}
          onChange={(e) => setComment(e.target.value)}
          aria-invalid={commentProblem ? true : undefined}
          aria-describedby={id("comment-help")}
        />
        <p id={id("comment-help")} className={`${s.help} ${commentProblem ? s.bad : ""}`}>
          {commentProblem === "bad_chars"
            ? t.badChars
            : commentProblem === "too_long"
              ? t.tooLong
              : t.left(Math.max(0, RATING_COMMENT_MAX - [...comment].length))}
        </p>
        {rateError ? (
          <p role="alert" className={s.error}>
            {rateError}
          </p>
        ) : null}
        <button type="submit" className={s.primary} disabled={rateBusy} aria-busy={rateBusy || undefined}>
          {rateBusy ? t.sending : t.send}
        </button>
        <p className={s.help}>{t.once}</p>
      </form>
    );
  } else {
    const message = rate.note === "not_ended" ? t.notEnded : rate.note === "not_found" ? t.notFound : "";
    rateBody = (
      <form onSubmit={verify} noValidate>
        <label className={s.label} htmlFor={id("ref")}>
          {t.ref}
        </label>
        <input
          id={id("ref")}
          className={s.input}
          value={ref}
          maxLength={BOOKING_REF_MAX}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          onChange={(e) => {
            setRef(e.target.value);
            setRateError("");
          }}
          aria-describedby={id("ref-help")}
        />
        <p id={id("ref-help")} className={s.help}>
          {t.refHelp}
        </p>
        {rate.ask4 ? (
          <>
            <label className={s.label} htmlFor={id("last4")}>
              {t.last4}
            </label>
            <input
              id={id("last4")}
              className={`${s.input} ${s.short}`}
              value={last4}
              maxLength={4}
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{4}"
              onChange={(e) => {
                setLast4(e.target.value);
                setRateError("");
              }}
              aria-describedby={id("last4-help")}
            />
            <p id={id("last4-help")} className={s.help}>
              {t.last4Help}
            </p>
          </>
        ) : null}
        <div aria-live="polite">{message && !rateError ? <p className={s.notice}>{message}</p> : null}</div>
        {rateError ? (
          <p role="alert" className={s.error}>
            {rateError}
          </p>
        ) : null}
        <button type="submit" className={s.secondary} disabled={rateBusy} aria-busy={rateBusy || undefined}>
          {rateBusy ? t.checking : t.check}
        </button>
      </form>
    );
  }

  const noteLeft = FEEDBACK_MAX - [...note].length;

  return (
    <>
      {gate ? <script dangerouslySetInnerHTML={{ __html: GATE }} /> : null}
      <section
        className={s.panel}
        aria-labelledby={id("thanks")}
        data-card-welcome=""
        data-card={card ?? undefined}
        data-on={card ? "" : undefined}
      >
        <div className={s.inner}>
          <p className={s.kicker}>{t.label}</p>
          <h2 id={id("thanks")} className={s.title}>
            {t.thanks(hotel)}
          </h2>
          {preview ? <p className={s.help}>{t.previewNote}</p> : null}
          <div className={s.grid}>
            <div className={s.block}>
              <h3 className={s.h3}>{t.rateTitle}</h3>
              <p className={s.help}>{t.rateWho}</p>
              {rateBody}
            </div>
            {firstRoom ? (
              <div className={`${s.block} ${s.book}`} data-book-again="">
                <h3 className={s.h3}>{t.bookTitle}</h3>
                <p className={s.perkLine}>
                  {line.perk && isSample ? <SampleTag text={sampleText} /> : null}
                  {line.lead}
                  {line.perk ? <strong> {line.perk}</strong> : null}
                </p>
                {code ? <p className={s.help}>{t.bookCode(code)}</p> : null}
                <a className={s.primary} href={bookHref} rel="nofollow">
                  {t.bookOpen}
                </a>
                <p className={s.help}>{t.publicRate}</p>
              </div>
            ) : null}
          </div>
          <details className={s.note}>
            <summary className={s.summary}>{t.noteTitle}</summary>
            <p className={s.help}>{t.noteHonest}</p>
            {noteSent ? (
              <p className={s.done} role="status">
                {t.noteSent}
              </p>
            ) : (
              <form onSubmit={sendNote} noValidate>
                <label className={s.label} htmlFor={id("note")}>
                  {t.note}
                </label>
                <textarea
                  id={id("note")}
                  className={s.input}
                  rows={4}
                  value={note}
                  maxLength={FEEDBACK_MAX}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteError("");
                  }}
                  aria-describedby={id("note-help")}
                />
                <p id={id("note-help")} className={s.help}>
                  {t.noteLeft(Math.max(0, noteLeft))}
                </p>
                {noteError ? (
                  <p role="alert" className={s.error}>
                    {noteError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className={s.secondary}
                  disabled={noteBusy}
                  aria-busy={noteBusy || undefined}
                >
                  {noteBusy ? t.sending : t.noteSend}
                </button>
              </form>
            )}
          </details>
        </div>
      </section>
    </>
  );
}
