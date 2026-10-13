"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { RATING_COMMENT_MAX, ratingCommentError } from "@/lib/hotelSiteV2";
import type { Lang } from "@/lib/types-site";
import type { RatePage } from "@/lib/types-hotel-site";
import s from "./rate.module.css";

const COPY = {
  en: {
    language: "Language",
    title: "Rate your stay",
    at: (hotel: string) => `at ${hotel}`,
    legend: "How was your stay?",
    star: (n: number) => (n === 1 ? "1 star" : `${n} stars`),
    comment: "A short comment (optional)",
    left: (n: number) => `${n} characters left`,
    tooLong: `Keep it to ${RATING_COMMENT_MAX} characters.`,
    badChars: "Please leave out the < and > signs.",
    pick: "Choose from 1 to 5 stars.",
    send: "Send rating",
    sending: "Sending",
    once: "You can rate once. The hotel can hide a comment but cannot change your stars.",
    thanks: "Thank you. Your rating is saved.",
    used: "This link has already been used.",
    usedSub: "Each stay can be rated once.",
    invalid: "This rating link does not work.",
    invalidSub: "Check the link from your booking or checkout slip.",
    loading: "Opening",
    failed: "That did not load.",
    retry: "Try again",
    offline: "No connection. Try again.",
  },
  hi: {
    language: "भाषा",
    title: "अपने ठहराव को रेटिंग दें",
    at: (hotel: string) => hotel,
    legend: "आपका ठहराव कैसा रहा?",
    star: (n: number) => `${n} स्टार`,
    comment: "छोटी टिप्पणी (वैकल्पिक)",
    left: (n: number) => `${n} अक्षर बाकी`,
    tooLong: `${RATING_COMMENT_MAX} अक्षरों के अंदर लिखें।`,
    badChars: "कृपया < और > चिह्न न लिखें।",
    pick: "1 से 5 स्टार चुनें।",
    send: "रेटिंग भेजें",
    sending: "भेज रहे हैं",
    once: "आप एक बार रेटिंग दे सकते हैं। होटल टिप्पणी छिपा सकता है, पर आपके स्टार नहीं बदल सकता।",
    thanks: "धन्यवाद। आपकी रेटिंग सहेज ली गई है।",
    used: "यह लिंक पहले ही इस्तेमाल हो चुका है।",
    usedSub: "हर ठहराव को एक बार रेटिंग दी जा सकती है।",
    invalid: "यह रेटिंग लिंक काम नहीं करता।",
    invalidSub: "अपनी बुकिंग या चेक-आउट पर्ची वाला लिंक देखें।",
    loading: "खुल रहा है",
    failed: "यह लोड नहीं हुआ।",
    retry: "फिर कोशिश करें",
    offline: "कनेक्शन नहीं है। फिर कोशिश करें।",
  },
} as const;

type Done = "none" | "saved" | "used";

/** The rating form: a 1 to 5 star radio group, an optional comment, sent once. */
export function RateForm({ token }: { token: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = COPY[lang];
  const page = useApi<RatePage>(`public/rate/${encodeURIComponent(token)}`);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done>("none");
  const problem = ratingCommentError(comment);
  const left = RATING_COMMENT_MAX - [...comment].length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (stars < 1) return setError(t.pick);
    if (problem) return setError(problem === "too_long" ? t.tooLong : t.badChars);
    setBusy(true);
    setError("");
    try {
      const text = comment.trim();
      await postJson(`public/rate/${encodeURIComponent(token)}`, text ? { stars, comment: text } : { stars });
      setDone("saved");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setDone("used");
      else setError(err instanceof ApiError && err.status !== 0 ? err.message : t.offline);
    } finally {
      setBusy(false);
    }
  }

  const switcher = (
    <div className={s.lang} role="group" aria-label={t.language}>
      {(["en", "hi"] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {code === "en" ? "EN" : "हि"}
          <span className={s.srOnly}>{code === "en" ? " English" : " हिन्दी"}</span>
        </button>
      ))}
    </div>
  );

  let body;
  const state = page.data?.state ?? (page.error?.status === 404 ? "invalid" : null);
  if (page.loading && !page.data) {
    body = (
      <p className={s.sub} role="status">
        {t.loading}
      </p>
    );
  } else if (done === "saved") {
    body = (
      <div role="status" aria-live="polite">
        <h1 className={s.title}>{t.thanks}</h1>
      </div>
    );
  } else if (done === "used" || state === "used") {
    body = (
      <div role="status">
        <h1 className={s.title}>{t.used}</h1>
        <p className={s.sub}>{t.usedSub}</p>
      </div>
    );
  } else if (state === "invalid") {
    body = (
      <div role="alert">
        <h1 className={s.title}>{t.invalid}</h1>
        <p className={s.sub}>{t.invalidSub}</p>
      </div>
    );
  } else if (!page.data) {
    body = (
      <div role="alert">
        <h1 className={s.title}>{t.failed}</h1>
        <button type="button" className={s.secondary} onClick={page.reload}>
          {t.retry}
        </button>
      </div>
    );
  } else {
    body = (
      <form onSubmit={submit} noValidate>
        <h1 className={s.title}>{t.title}</h1>
        <p className={s.sub}>{t.at(page.data.hotel)}</p>
        <fieldset className={s.stars}>
          <legend>{t.legend}</legend>
          <div className={s.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={`${s.star} ${stars >= n ? s.on : ""}`}>
                <input
                  type="radio"
                  name="stars"
                  value={n}
                  checked={stars === n}
                  onChange={() => {
                    setStars(n);
                    setError("");
                  }}
                />
                <span aria-hidden="true">★</span>
                <span className={s.srOnly}>{t.star(n)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className={s.label} htmlFor="rate-comment">
          {t.comment}
        </label>
        <textarea
          id="rate-comment"
          className={s.textarea}
          rows={3}
          value={comment}
          maxLength={RATING_COMMENT_MAX}
          onChange={(e) => setComment(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby="rate-comment-help"
        />
        <p id="rate-comment-help" className={`${s.help} ${problem ? s.bad : ""}`}>
          {problem === "bad_chars"
            ? t.badChars
            : problem === "too_long"
              ? t.tooLong
              : t.left(Math.max(0, left))}
        </p>
        {error ? (
          <p role="alert" className={s.error}>
            {error}
          </p>
        ) : null}
        <button type="submit" className={s.primary} disabled={busy}>
          {busy ? t.sending : t.send}
        </button>
        <p className={s.help}>{t.once}</p>
      </form>
    );
  }

  return (
    <main id="main" className={s.shell} lang={lang}>
      <div className={s.top}>
        <span className={s.brand}>Seedha</span>
        {switcher}
      </div>
      <div className={s.card}>{body}</div>
    </main>
  );
}
