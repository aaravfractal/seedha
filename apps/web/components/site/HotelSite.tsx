"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import { inr } from "@/lib/format";
import { addDays } from "@/lib/linkPrefill";
import { bookingLink } from "@/lib/siteHost";
import type { Availability, Lang, Mood, PublicPackage, SiteContent, SitePhoto } from "@/lib/types-site";
import { COPY, defaultCheckIn, linkHref, nightsLabel, waNumber } from "./copy";
import s from "./worldb.module.css";

const ROOM_PHOTOS = [
  "linear-gradient(160deg,#4A6B4E,#33503B)",
  "linear-gradient(160deg,#7E7262,#9BAF94)",
  "linear-gradient(160deg,#BBA98A,#5E5A50)",
];
const GALLERY_PHOTOS = [
  "linear-gradient(160deg,#9DB59A,#D9CBA6)",
  "linear-gradient(160deg,#6E7A45,#2F4F38)",
  "linear-gradient(160deg,#A8B49A,#E3D7BC)",
  "linear-gradient(160deg,#5B5E4E,#3B5A40)",
  "linear-gradient(160deg,#6F9A72,#A9BFA0)",
  "linear-gradient(160deg,#8A6E5E,#5D5A63)",
];
const MAX_NIGHTS = 14;
// Seedha branding on hotel pages; a Pro setting (hide_branding) removes it.
const BRAND = {
  en: { book: "Book direct", powered: "Powered by Seedha", built: "Built with Seedha", about: "About us" },
  hi: {
    book: "सीधे बुक करें",
    powered: "Powered by Seedha",
    built: "Built with Seedha",
    about: "हमारे बारे में",
  },
} as const;

type Status = { kind: "idle" } | { kind: "checking" } | { kind: "open" } | { kind: "closed"; reason: string };

/** A gradient placeholder for one of the hotel's own photos, labelled as a sample. */
export function Photo({
  background,
  label,
  chip,
  className,
}: {
  background: string;
  label?: string;
  chip?: string;
  className?: string;
}) {
  return (
    <div className={`${s.photo} ${className ?? ""}`} style={{ background }}>
      {chip ? <span className={s.chip}>{chip}</span> : null}
      {label ? <span className={s.photoLabel}>{label}</span> : null}
    </div>
  );
}

/** A photo's caption in the page language (Hindi falls back to English). */
function caption(photo: SitePhoto, lang: Lang): string {
  return lang === "hi" ? photo.caption_hi || photo.caption_en : photo.caption_en;
}

/** One of the owner's own photos, sized up front so the page does not jump while it loads. */
export function OwnerPhoto({
  photo,
  lang,
  label,
  className,
  eager = false,
}: {
  photo: SitePhoto;
  lang: Lang;
  label?: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={`${s.photo} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin API photos, already resized and cached; next/image would re-encode them per host */}
      <img
        className={s.photoImg}
        src={photo.url}
        alt={caption(photo, lang)}
        width={photo.width}
        height={photo.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
      {label ? (
        <span className={s.photoLabel} aria-hidden="true">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/** Mood colours and fonts for a World B page. */
export function moodProps(mood: Mood, lang: Lang) {
  return { "data-mood": mood, lang: lang === "hi" ? "hi" : "en" } as const;
}

/**
 * The hotel's own website (World B). Rooms at public rates and approved
 * packages, all priced by the API. Booking goes to Seedha Link. In `preview`
 * (the owner's Website screen) nothing calls the API and the header does not stick.
 */
export function HotelSite({
  site,
  packages,
  lang,
  mood,
  today,
  onLang,
  preview = false,
}: {
  site: SiteContent;
  packages: PublicPackage[];
  lang: Lang;
  mood: Mood;
  today: string;
  onLang?: (lang: Lang) => void;
  preview?: boolean;
}) {
  const t = COPY[lang];
  const brand = BRAND[lang];
  const photos = site.photos ?? [];
  const points = site.text?.why_book_direct[lang].filter(Boolean) ?? [];
  const about = site.text?.description[lang] ?? "";
  const hero = photos[0];
  // Same-origin path on the server and first render; the hotel-host fix-up runs after hydration.
  const [here, setHere] = useState<{ protocol: string; hostname: string; port: string } | undefined>();
  useEffect(() => {
    const { protocol, hostname, port } = window.location;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of the host after hydration
    setHere({ protocol, hostname, port });
  }, []);
  const href = (type: string, day: string, n: number) =>
    bookingLink(site.booking_url ?? "/link", linkHref(type, day, n), here);
  // Seedha Link books only rooms it charges at the shown price; the rest say "Ask the hotel".
  const bookable = site.rooms.filter((r) => r.bookable);
  const canBook = bookable.length > 0;
  const phone = site.contact.phone;
  const askHref = phone ? `https://wa.me/${waNumber(phone)}` : "";
  const firstRoom = bookable[0]?.room_type ?? "";
  const [checkIn, setCheckIn] = useState(() => defaultCheckIn(today));
  const [nights, setNights] = useState(2);
  const [room, setRoom] = useState(firstRoom);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const asked = useRef(0);
  const uid = useId();
  const id = (part: string) => `${uid}-${part}`;
  const name = lang === "hi" ? site.hotel_hi : site.hotel;
  const roomName = (r: SiteContent["rooms"][number]) => (lang === "hi" ? r.name_hi : r.room_type);

  async function check(day: string, n: number, type: string): Promise<boolean> {
    if (preview || !day || !type) return true;
    const ticket = ++asked.current;
    setStatus({ kind: "checking" });
    const q = new URLSearchParams({ check_in: day, nights: String(n), room_type: type });
    try {
      const res = await api<Availability>(`public/site/${encodeURIComponent(site.slug)}/availability?${q}`);
      if (ticket === asked.current) {
        setStatus(res.open ? { kind: "open" } : { kind: "closed", reason: res.reason ?? "full" });
      }
      return res.open;
    } catch {
      // Seedha Link checks again when booking; do not block the guest here.
      if (ticket === asked.current) setStatus({ kind: "idle" });
      return true;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview) return;
    if (status.kind === "closed") return;
    if (await check(checkIn, nights, room)) window.location.assign(href(room, checkIn, nights));
  }

  const closedReason = status.kind === "closed" ? (status.reason as keyof typeof t.closed) : null;
  const message =
    status.kind === "checking"
      ? t.checking
      : status.kind === "open"
        ? t.open
        : closedReason
          ? (t.closed[closedReason] ?? t.closed.full)
          : "";

  return (
    <div className={`${s.wb} ${preview ? s.preview : ""}`} {...moodProps(mood, lang)}>
      <header className={s.head}>
        {preview ? (
          <span className={s.backBtn} aria-hidden="true">
            ‹
          </span>
        ) : (
          <button type="button" className={s.backBtn} aria-label={t.back} onClick={() => history.back()}>
            ‹
          </button>
        )}
        <span className={`${s.brand} ${s.display}`}>{name}</span>
        <div className={s.langSwitch} role="group" aria-label={t.language}>
          {(["en", "hi"] as const).map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={lang === code}
              onClick={() => onLang?.(code)}
            >
              {code === "en" ? "EN" : "हि"}
            </button>
          ))}
        </div>
        {canBook ? (
          <a className={`${s.pill} ${s.headBook}`} href={`#${id("book")}`}>
            {t.book}
          </a>
        ) : askHref ? (
          <a className={`${s.pill} ${s.headBook}`} href={askHref} rel="noopener noreferrer">
            {t.askHotel}
          </a>
        ) : null}
      </header>

      <section className={s.hero} aria-labelledby={id("hotel-name")}>
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element -- see OwnerPhoto
          <img
            className={s.photoImg}
            src={hero.url}
            alt={caption(hero, lang)}
            width={hero.width}
            height={hero.height}
            fetchPriority="high"
          />
        ) : (
          <span className={s.chip}>{t.samplePhoto}</span>
        )}
        <div className={s.heroText}>
          {site.location[lang] ? <p className={s.kicker}>{site.location[lang]}</p> : null}
          <h1 id={id("hotel-name")} className={`${s.display} ${s.h1}`}>
            {name}
          </h1>
          {site.tagline[lang] ? <p className={s.tagline}>{site.tagline[lang]}</p> : null}
          {canBook ? (
            <a className={`${s.pill} ${s.pillLight}`} href={`#${id("book")}`}>
              {t.book}
            </a>
          ) : askHref ? (
            <a className={`${s.pill} ${s.pillLight}`} href={askHref} rel="noopener noreferrer">
              {t.askHotel}
            </a>
          ) : null}
        </div>
      </section>

      {canBook ? (
        <form id={id("book")} className={s.bar} onSubmit={submit} noValidate>
          <label className={s.field}>
            <span>{t.checkIn}</span>
            <input
              type="date"
              value={checkIn}
              min={addDays(today, 1)}
              max={addDays(today, 365)}
              required
              onChange={(e) => {
                setCheckIn(e.target.value);
                void check(e.target.value, nights, room);
              }}
            />
          </label>
          <label className={s.field}>
            <span>{t.nights}</span>
            <select
              value={nights}
              onChange={(e) => {
                const n = Number(e.target.value);
                setNights(n);
                void check(checkIn, n, room);
              }}
            >
              {Array.from({ length: MAX_NIGHTS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {nightsLabel(n, lang)}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span>{t.room}</span>
            <select
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                void check(checkIn, nights, e.target.value);
              }}
            >
              {bookable.map((r) => (
                <option key={r.room_type} value={r.room_type}>
                  {roomName(r)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={s.barBook} aria-disabled={status.kind === "closed"}>
            {site.hide_branding ? (
              t.bookShort
            ) : (
              <>
                {brand.book} <span className={s.powered}>· {brand.powered}</span>
              </>
            )}
          </button>
          <p className={`${s.barNote} ${closedReason ? s.closed : ""}`} role="status" aria-live="polite">
            {message}
          </p>
        </form>
      ) : null}

      {about ? (
        <section className={s.section} aria-labelledby={id("about")}>
          <h2 id={id("about")} className={`${s.display} ${s.h2}`}>
            {brand.about}
          </h2>
          <p className={s.about}>{about}</p>
        </section>
      ) : null}

      <section className={s.section} aria-labelledby={id("why")}>
        <h2 id={id("why")} className={`${s.display} ${s.h2}`}>
          {t.why}
        </h2>
        <div className={s.why}>
          {points.length
            ? points.map((point) => (
                <div key={point}>
                  <h3>{point}</h3>
                </div>
              ))
            : t.whyItems.map(([title, body]) => (
                <div key={title}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
        </div>
      </section>

      <section className={s.section} aria-labelledby={id("rooms")}>
        <h2 id={id("rooms")} className={`${s.display} ${s.h2}`}>
          {t.rooms}
        </h2>
        <div className={s.rooms}>
          {site.rooms.map((r, i) => {
            const photo = photos.length ? photos[(i + 1) % photos.length] : undefined;
            return (
              <article key={r.room_type} className={s.room}>
                {photo ? (
                  <OwnerPhoto photo={photo} lang={lang} className={s.roomPhoto} />
                ) : (
                  <Photo
                    background={ROOM_PHOTOS[i % ROOM_PHOTOS.length] ?? ""}
                    chip={t.samplePhoto}
                    className={s.roomPhoto}
                  />
                )}
                <div className={s.roomBody}>
                  <h3 className={s.display}>{roomName(r)}</h3>
                  {r.detail[lang] ? <p className={s.muted}>{r.detail[lang]}</p> : null}
                  <div className={s.priceRow}>
                    <p className={s.price}>
                      <b className={s.num}>{inr(r.nightly_rate)}</b> <span>{t.aNight}</span>
                    </p>
                    {r.bookable ? (
                      <a
                        className={s.pill}
                        href={href(r.room_type, checkIn, nights)}
                        aria-label={`${t.bookShort}: ${roomName(r)}`}
                      >
                        {t.bookShort}
                      </a>
                    ) : askHref ? (
                      <a
                        className={s.pill}
                        href={askHref}
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
      </section>

      <section className={s.section} aria-labelledby={id("packages")}>
        <h2 id={id("packages")} className={`${s.display} ${s.h2}`}>
          {t.packages}
        </h2>
        {packages.length ? (
          <>
            <div className={s.packages}>
              {packages.map((p) => (
                <article key={p.key} className={s.pkg}>
                  <h3 className={s.display}>{p.name[lang]}</h3>
                  <p className={s.muted}>{p.includes[lang]}</p>
                  <p className={`${s.pkgPrice} ${s.num}`}>{inr(p.price)}</p>
                </article>
              ))}
            </div>
            <p className={s.note}>{t.packagesNote}</p>
          </>
        ) : (
          <div className={s.soon}>
            <p className={s.soonTitle}>{t.comingSoon}</p>
            <p className={s.muted}>{t.comingSoonSub}</p>
          </div>
        )}
      </section>

      <section className={s.section} aria-labelledby={id("photos")}>
        <div className={s.headRow}>
          <h2 id={id("photos")} className={`${s.display} ${s.h2}`}>
            {t.photos}
          </h2>
          {photos.length ? null : <span className={s.chipQuiet}>{t.samplePhotos}</span>}
        </div>
        <div className={s.gallery}>
          {photos.length
            ? photos.map((p) => <OwnerPhoto key={p.id} photo={p} lang={lang} label={caption(p, lang)} />)
            : site.gallery.map((g, i) => (
                <Photo
                  key={g.en}
                  background={GALLERY_PHOTOS[i % GALLERY_PHOTOS.length] ?? ""}
                  label={g[lang]}
                />
              ))}
        </div>
      </section>

      {site.nearby.length ? (
        <section className={s.section} aria-labelledby={id("nearby")}>
          <h2 id={id("nearby")} className={`${s.display} ${s.h2}`}>
            {t.nearby}
          </h2>
          <ul className={s.list}>
            {site.nearby.map((n) => (
              <li key={n.place.en}>
                <span>{n.place[lang]}</span>
                <span className={s.muted}>{n.distance[lang]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {phone || site.contact.upi ? (
        <section className={s.section} aria-labelledby={id("contact")}>
          <h2 id={id("contact")} className={`${s.display} ${s.h2}`}>
            {t.contact}
          </h2>
          <ul className={s.list}>
            {phone ? (
              <li>
                <span>{t.whatsapp}</span>
                <a className={s.link} href={askHref} rel="noopener noreferrer">
                  {phone}
                </a>
              </li>
            ) : null}
            {site.contact.upi ? (
              <li>
                <span>{t.upi}</span>
                <span className={s.num}>{site.contact.upi}</span>
              </li>
            ) : null}
          </ul>
          {site.contact.placeholder ? <p className={s.note}>{t.placeholders}</p> : null}
        </section>
      ) : null}

      <footer className={s.foot}>
        {site.sample ? <p>{t.sampleHotel}</p> : null}
        {site.hide_branding ? null : <p lang="en">{brand.built}</p>}
      </footer>
    </div>
  );
}
