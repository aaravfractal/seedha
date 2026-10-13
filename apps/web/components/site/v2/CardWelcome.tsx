"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, postJson } from "@/lib/api";
import {
  BOOKING_REF_MAX,
  FEEDBACK_MAX,
  NAME_MAX,
  WHATSAPP_MAX,
  bookAgainHref,
  bookAgainLine,
  cleanBookingRef,
  feedbackBody,
  rewardAllowed,
  rewardChoices,
  stayPrefill,
} from "@/lib/cardWelcome";
import type { FeedbackField } from "@/lib/cardWelcome";
import type { CardVerify, FeedbackOut, RewardId, ScanCard, SiteReward } from "@/lib/types-hotel-site";
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

type Sent = { verified: boolean; reward: FeedbackOut["reward"]; asked: RewardId | "none"; consent: boolean };

const STARS = [1, 2, 3, 4, 5] as const;

function errorText(err: unknown, t: CardCopy): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return t.offline;
    if (err.status === 429) return t.tooMany;
    if (err.status === 422) return t.invalid;
  }
  return t.failed;
}

/** A 1 to 5 star radio group (each star a 48px target, the group named by its legend). */
function StarGroup({
  legend,
  name,
  value,
  invalid,
  describedBy,
  t,
  onPick,
}: {
  legend: string;
  name: string;
  value: number;
  invalid: boolean;
  describedBy?: string;
  t: CardCopy;
  onPick: (n: number) => void;
}) {
  return (
    <fieldset
      className={s.stars}
      role="radiogroup"
      aria-labelledby={`${name}-legend`}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <legend id={`${name}-legend`}>{legend}</legend>
      <div className={s.starRow}>
        {STARS.map((n) => (
          <label key={n} className={`${s.star} ${value >= n ? s.on : ""}`}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onPick(n)} />
            <span aria-hidden="true">★</span>
            <span className={s.srOnly}>{t.star(n)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A small "Sample" label for the sample hotel's perk (rule 11). */
function SampleTag({ text }: { text: string }) {
  return <span className={s.sample}>{text}</span>;
}

/**
 * The card welcome panel (docs/CARD_PAGE.md, PART 2): a guest who scanned a
 * printed card sees thanks, sends one feedback form (name, stars, review, a
 * reward picked from the owner's list, WhatsApp consent unticked; the hotel
 * approves any code before it is sent), and can book again on Seedha Link at
 * the public rate (the owner's own perk words only; never a price).
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
  rewards,
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
  /** The rewards the owner turned on (site payload `rewards`). */
  rewards?: SiteReward[];
  gate: boolean;
  preview?: boolean;
}) {
  const uid = useId();
  const id = (part: string) => `${uid}-${part}`;
  const base = `public/site/${encodeURIComponent(slug)}`;

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [ref, setRef] = useState("");
  const [last4, setLast4] = useState("");
  const [askLast4, setAskLast4] = useState(false);
  const [overall, setOverall] = useState(0);
  const [food, setFood] = useState(0);
  const [review, setReview] = useState("");
  const [reward, setReward] = useState<RewardId | "none">("none");
  const [consent, setConsent] = useState(false);
  const [bad, setBad] = useState<FeedbackField[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  // C2's verify: asks for the phone digits when the hotel has them, and fills Book again.
  const [verified, setVerified] = useState<CardVerify | null>(null);
  const [checkedRef, setCheckedRef] = useState("");

  const choices = rewardChoices(rewards);
  const hasRef = Boolean(cleanBookingRef(ref));
  const line = bookAgainLine(perk, lang);
  const code = stayPrefill(verified).code;
  const bookHref = bookAgainHref({ bookingUrl, verify: verified, firstRoom, here });
  const reviewLeft = FEEDBACK_MAX - [...review.trim()].length;
  const is = (field: FeedbackField) => bad.includes(field);
  const clear = (field: FeedbackField) => {
    setBad((b) => b.filter((f) => f !== field));
    setError("");
  };

  const fieldText: Record<FeedbackField, string> = {
    name: t.nameBad,
    whatsapp: t.whatsappBad,
    ref: t.refBad,
    last4: t.last4Bad,
    overall: t.pick,
    review: t.reviewBad,
    reward: t.rewardBad,
  };

  /**
   * C2's verify, once per reference and digits: true when the API wants the
   * phone's last 4 first (the field then shows). A verified stay fills Book again.
   */
  async function needsLast4(cleanRef: string, clean4: string | null): Promise<boolean> {
    const key = `${cleanRef}|${clean4 ?? ""}`;
    if (checkedRef === key) return false;
    setCheckedRef(key);
    try {
      const out = await postJson<CardVerify>(
        `${base}/card/verify`,
        clean4 ? { booking_ref: cleanRef, phone_last4: clean4 } : { booking_ref: cleanRef },
      );
      if (out?.state === "verified") setVerified(out);
      if (out?.state !== "needs_phone" || clean4) return false;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status === 429)) throw err;
      return false; // The feedback call checks the stay itself.
    }
    setAskLast4(true);
    setBad(["last4"]);
    setError(t.last4Ask);
    return true;
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sent) return;
    const form = event.currentTarget;
    const out = feedbackBody({
      name,
      whatsapp,
      ref,
      last4,
      askLast4,
      overall,
      food,
      review,
      reward,
      consent,
    });
    setBad(out.problems);
    if (!out.body) {
      setError(fieldText[out.problems[0] ?? "name"]);
      const first = out.problems[0];
      const radios = first === "overall" || first === "reward";
      const target = radios
        ? form.querySelector<HTMLElement>(`input[name="${CSS.escape(id(first))}"]:not(:disabled)`)
        : document.getElementById(id(first ?? "name"));
      target?.focus();
      return;
    }
    setError("");
    if (preview) return;
    setBusy(true);
    try {
      const { booking_ref: cleanRef, phone_last4: clean4 } = out.body;
      if (
        typeof cleanRef === "string" &&
        (await needsLast4(cleanRef, typeof clean4 === "string" ? clean4 : null))
      )
        return;
      const res = await postJson<FeedbackOut>(`${base}/feedback`, out.body);
      setSent({ verified: res?.verified === true, reward: res?.reward ?? reward, asked: reward, consent });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && /phone|last4/i.test(err.code) && !askLast4) {
        setAskLast4(true);
        setBad(["last4"]);
        setError(t.last4Ask);
      } else setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  const help = (field: FeedbackField, normal: string) => (is(field) ? fieldText[field] : normal);

  const formBody = sent ? (
    <div className={s.done} role="status">
      <p>{t.thanksSent}</p>
      <p>{sent.verified ? t.verifiedYes : t.verifiedNo}</p>
      {sent.reward !== sent.asked ? <p>{t.rewardChanged(sent.reward)}</p> : null}
      {sent.reward !== "none" ? <p>{sent.consent ? t.codeLater : t.codeNoConsent}</p> : null}
    </div>
  ) : (
    <form onSubmit={send} noValidate>
      <label className={s.label} htmlFor={id("name")}>
        {t.name}
      </label>
      <input
        id={id("name")}
        className={s.input}
        value={name}
        maxLength={NAME_MAX}
        autoComplete="name"
        onChange={(e) => {
          setName(e.target.value);
          clear("name");
        }}
        aria-invalid={is("name") || undefined}
        aria-describedby={is("name") ? id("name-help") : undefined}
      />
      {is("name") ? (
        <p id={id("name-help")} className={`${s.help} ${s.bad}`}>
          {t.nameBad}
        </p>
      ) : null}

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
        onChange={(e) => {
          setRef(e.target.value);
          clear("ref");
          if (!cleanBookingRef(e.target.value) && reward !== "none" && reward !== "breakfast")
            setReward("none");
        }}
        aria-invalid={is("ref") || undefined}
        aria-describedby={id("ref-help")}
      />
      <p id={id("ref-help")} className={`${s.help} ${is("ref") ? s.bad : ""}`}>
        {help("ref", t.refHelp)}
      </p>
      {askLast4 ? (
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
              clear("last4");
            }}
            aria-invalid={is("last4") || undefined}
            aria-describedby={id("last4-help")}
          />
          <p id={id("last4-help")} className={`${s.help} ${is("last4") ? s.bad : ""}`}>
            {help("last4", t.last4Help)}
          </p>
        </>
      ) : null}

      <StarGroup
        legend={t.overall}
        name={id("overall")}
        value={overall}
        invalid={is("overall")}
        describedBy={is("overall") ? id("overall-help") : undefined}
        t={t}
        onPick={(n) => {
          setOverall(n);
          clear("overall");
        }}
      />
      {is("overall") ? (
        <p id={id("overall-help")} className={`${s.help} ${s.bad}`}>
          {t.pick}
        </p>
      ) : null}
      <StarGroup legend={t.food} name={id("food")} value={food} invalid={false} t={t} onPick={setFood} />

      <label className={s.label} htmlFor={id("review")}>
        {t.review}
      </label>
      <textarea
        id={id("review")}
        className={s.input}
        rows={4}
        value={review}
        maxLength={FEEDBACK_MAX}
        onChange={(e) => {
          setReview(e.target.value);
          clear("review");
        }}
        aria-invalid={is("review") || undefined}
        aria-describedby={id("review-help")}
      />
      <p id={id("review-help")} className={`${s.help} ${is("review") ? s.bad : ""}`}>
        {help("review", t.left(Math.max(0, reviewLeft)))}
      </p>

      {choices.length ? (
        <fieldset
          className={s.choices}
          role="radiogroup"
          aria-labelledby={id("reward-legend")}
          aria-invalid={is("reward") || undefined}
          aria-describedby={hasRef ? undefined : id("reward-note")}
        >
          <legend id={id("reward-legend")}>{t.reward}</legend>
          {[...choices, null].map((r) => {
            const value = r ? r.id : "none";
            const off = !rewardAllowed(value, hasRef);
            return (
              <label key={value} className={`${s.choice} ${off ? s.off : ""}`}>
                <input
                  type="radio"
                  name={id("reward")}
                  value={value}
                  checked={reward === value}
                  disabled={off}
                  onChange={() => {
                    setReward(value);
                    clear("reward");
                  }}
                />
                <span>{r ? (lang === "hi" ? r.hi || r.en : r.en) : t.noReward}</span>
              </label>
            );
          })}
          {hasRef ? null : (
            <p id={id("reward-note")} className={s.help}>
              {t.rewardNote}
            </p>
          )}
        </fieldset>
      ) : null}

      <label className={s.consent}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            clear("whatsapp");
          }}
        />
        <span>{t.consent}</span>
      </label>
      <p className={s.help}>
        <a className={s.textLink} href="/privacy">
          {t.privacy}
        </a>
      </p>

      <label className={s.label} htmlFor={id("whatsapp")}>
        {t.whatsapp}
      </label>
      <input
        id={id("whatsapp")}
        className={s.input}
        type="tel"
        value={whatsapp}
        maxLength={WHATSAPP_MAX}
        inputMode="tel"
        autoComplete="tel"
        aria-required={consent || undefined}
        onChange={(e) => {
          setWhatsapp(e.target.value);
          clear("whatsapp");
        }}
        aria-invalid={is("whatsapp") || undefined}
        aria-describedby={id("whatsapp-help")}
      />
      <p id={id("whatsapp-help")} className={`${s.help} ${is("whatsapp") ? s.bad : ""}`}>
        {help("whatsapp", t.whatsappHelp)}
      </p>

      {error ? (
        <p role="alert" className={s.error}>
          {error}
        </p>
      ) : null}
      <button type="submit" className={s.primary} disabled={busy} aria-busy={busy || undefined}>
        {busy ? t.sending : t.send}
      </button>
    </form>
  );

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
            <div className={s.block} data-feedback-form="">
              <h3 className={s.h3}>{t.formTitle}</h3>
              <p className={s.help}>{t.formWho}</p>
              {formBody}
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
        </div>
      </section>
    </>
  );
}
