"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { AmenityId } from "@/lib/amenities";
import { isAmenityId } from "@/lib/amenityIcons";
import { hotelFonts } from "@/lib/fonts-hotel";
import { inr } from "@/lib/format";
import {
  AMENITIES_SHOWN,
  cardPerk,
  langFrom,
  mapsHref,
  photoSources,
  pick,
  scanCardFrom,
  searchWithoutSrc,
  serviceWorkerScope,
  telHref,
  whatsappHref,
} from "@/lib/hotelSiteV2";
import { addDays } from "@/lib/linkPrefill";
import { seedhaHomeHref, shortHotelName } from "@/lib/cardWelcome";
import { HOTEL_SW_PATH, bookingLink } from "@/lib/siteHost";
import type { Availability, Lang, SitePhoto } from "@/lib/types-site";
import { GLOBE_BOX } from "@/lib/siteGlobe";
import type { HotelSitePayload, RoomDetail, ScanCard } from "@/lib/types-hotel-site";
import { COPY, defaultCheckIn, linkHref, nightsLabel } from "../copy";
import { AmenityIcon, ReachIcon } from "./AmenityIcon";
import { AtAGlance } from "./AtAGlance";
import { CardWelcome } from "./CardWelcome";
import { Ratings } from "./Ratings";
import { RoomCards } from "./RoomCards";
import { SeedhaBar } from "./SeedhaBar";
import { V2_COPY } from "./copy";
import s from "./hotel.module.css";

// The globe and the local map are V2-GLOBE's. Both load lazily, only once
// the Location section comes near the screen; the globe's box is reserved so
// nothing moves when it arrives.
const LocationGlobe = dynamic(() => import("@/components/site/v2/LocationGlobe"), {
  ssr: false,
  loading: () => <div style={GLOBE_BOX} aria-hidden="true" />,
});
const LocalMap = dynamic(() => import("@/components/site/v2/LocalMap"));

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

type Status = { kind: "idle" } | { kind: "checking" } | { kind: "open" } | { kind: "closed"; reason: string };
type Here = { protocol: string; hostname: string; port: string };

const noSubscribe = () => () => {};
const noSearch = () => "";
// The address as the page first loaded, read once: the scan source is then
// removed from the bar, and the perk stays for this visit.
let firstSearch: string | null = null;
function readFirstSearch(): string {
  if (firstSearch === null) firstSearch = window.location.search;
  return firstSearch;
}
function readHere(): string {
  const { protocol, hostname, port } = window.location;
  return `${protocol}|${hostname}|${port}`;
}
const pinged = new Set<string>();

let canvasOk: boolean | null = null;
/**
 * True when this browser gives a canvas a 2D context (checked once). Without
 * one the globe draws nothing, so its box is dropped and the static map is
 * the whole location view. The server assumes yes, so the box is reserved
 * from the first paint in the normal case (no layout shift).
 */
function hasCanvas2d(): boolean {
  if (canvasOk === null) {
    try {
      canvasOk = Boolean(document.createElement("canvas").getContext("2d"));
    } catch {
      canvasOk = false;
    }
  }
  return canvasOk;
}
const yes = () => true;
const no = () => false;

/** One count of the printed card that brought the guest. No cookies, nothing about the guest. */
function pingScan(slug: string, card: ScanCard): void {
  const key = `${slug}:${card}`;
  if (pinged.has(key)) return;
  pinged.add(key);
  void fetch(`/api/public/site/${encodeURIComponent(slug)}/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ card }),
    credentials: "omit",
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined);
}

/** The offline page's service worker, scoped to this hotel's page only. */
function registerOffline(slug: string): void {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const scope = serviceWorkerScope(window.location.pathname, slug);
  navigator.serviceWorker
    .register(`${HOTEL_SW_PATH}?slug=${encodeURIComponent(slug)}`, { scope })
    .catch(() => undefined);
}

/** A photo's caption in the page language (Hindi falls back to English). */
function caption(photo: SitePhoto, lang: Lang): string {
  return pick(photo.caption_en, photo.caption_hi, lang);
}

/**
 * A hotel photo as <picture>: AVIF, then WebP, then JPEG, each at the
 * widths the public photo route serves, so a phone downloads a phone-sized
 * file (review R3-1). A photo not on the public route (the owner's preview)
 * is shown as it is.
 */
function Picture({
  photo,
  alt,
  sizes,
  className,
  eager = false,
}: {
  photo: SitePhoto;
  alt: string;
  sizes: string;
  className?: string;
  eager?: boolean;
}) {
  const set = photoSources(photo.url, photo.width);
  return (
    <picture className={className}>
      {set ? <source type="image/avif" srcSet={set.avif} sizes={sizes} /> : null}
      {set ? <source type="image/webp" srcSet={set.webp} sizes={sizes} /> : null}
      <img
        src={set ? set.src : photo.url}
        srcSet={set ? set.jpeg : undefined}
        sizes={set ? sizes : undefined}
        alt={alt}
        width={photo.width}
        height={photo.height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding={eager ? undefined : "async"}
      />
    </picture>
  );
}

function OwnerPhoto({
  photo,
  lang,
  label,
  sizes,
}: {
  photo: SitePhoto;
  lang: Lang;
  label?: string;
  sizes: string;
}) {
  return (
    <div className={s.photo}>
      <Picture className={s.photoPic} photo={photo} alt={caption(photo, lang)} sizes={sizes} />
      {label ? (
        <span className={s.photoLabel} aria-hidden="true">
          {label}
        </span>
      ) : null}
    </div>
  );
}

function SamplePhoto({ background, label, chip }: { background: string; label?: string; chip?: string }) {
  return (
    <div className={s.photo} style={{ background }}>
      {chip ? <span className={s.chip}>{chip}</span> : null}
      {label ? <span className={s.photoLabel}>{label}</span> : null}
    </div>
  );
}

/** True once the element comes within a screen of the viewport (then stays true). */
function useNearViewport<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near];
}

function Section({
  id,
  title,
  children,
  aside,
}: {
  id: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={s.section} aria-labelledby={id}>
      {aside ? (
        <div className={s.headRow}>
          <h2 id={id} className={`${s.display} ${s.h2}`}>
            {title}
          </h2>
          {aside}
        </div>
      ) : (
        <h2 id={id} className={`${s.display} ${s.h2}`}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export type HotelSiteV2Props = {
  site: HotelSitePayload;
  /**
   * Owner preview (the Website screen's Review): no scan count, no service
   * worker, no address-bar or title changes, no API calls, no navigation
   * (links and the booking form do nothing), the header and the mobile bar
   * stay in the flow instead of sticking to the window, the page's own
   * background stays off the owner app, and no <main> landmark is added
   * (the owner screen has its own). `?lang` and `?src` in the owner's
   * address are ignored.
   */
  preview?: boolean;
  /** Controlled language (for the preview's EN/HI switch); the page's own switch then calls onLangChange. */
  lang?: Lang;
  onLangChange?: (lang: Lang) => void;
  /** Preview only: show the card welcome panel as a guest from this card would see it (nothing is sent). */
  previewCard?: ScanCard | null;
};

/**
 * The hotel's own website, V2 (docs/HOTEL_SITE_V2.md). Rooms and packages
 * exactly as the API prices them; booking goes to Seedha Link. A guest who
 * scanned a printed card (?src=card-wallet|card-room|card-desk) first sees
 * the card welcome panel (CardWelcome: thanks, rate your stay, a private note,
 * Book again with the owner's own perk words only), and the scan is counted
 * once, with nothing stored about them. Never calls AI.
 */
export function HotelSiteV2({
  site,
  preview = false,
  lang: langProp,
  onLangChange,
  previewCard = null,
}: HotelSiteV2Props) {
  const search = useSyncExternalStore(noSubscribe, preview ? noSearch : readFirstSearch, noSearch);
  const hereKey = useSyncExternalStore(noSubscribe, readHere, () => "");
  const here = useMemo<Here | undefined>(() => {
    if (!hereKey) return undefined;
    const [protocol = "", hostname = "", port = ""] = hereKey.split("|");
    return { protocol, hostname, port };
  }, [hereKey]);
  const [chosenLang, setChosenLang] = useState<Lang | null>(null);
  const lang: Lang = langProp ?? chosenLang ?? langFrom(search) ?? (site.lang === "hi" ? "hi" : "en");
  const chooseLang = (code: Lang) => (onLangChange ? onLangChange(code) : setChosenLang(code));
  const card = preview ? previewCard : scanCardFrom(search);

  const t = V2_COPY[lang];
  const c = COPY[lang];
  const seedhaHome = seedhaHomeHref(site.booking_url, here);
  const d = site.details;
  const uid = useId();
  const id = (part: string) => `${uid}-${part}`;
  const name = lang === "hi" ? site.hotel_hi || site.hotel : site.hotel;
  const photos = site.photos ?? [];
  const hero = photos[0];
  const points = site.text?.why_book_direct[lang].filter(Boolean) ?? [];
  const about = site.text?.description[lang] ?? "";

  // Contact: the owner's details first; the older contact field for the sample hotel.
  const phone = d.contact.phone || site.contact.phone;
  const whatsapp = d.contact.whatsapp || site.contact.phone;
  const waLink = whatsappHref(whatsapp);
  const telLink = telHref(phone);
  const address = pick(d.contact.address_en, d.contact.address_hi, lang);
  const maps = mapsHref(d.geo);

  // Booking: Seedha Link books only rooms it charges at the shown price.
  const bookable = site.rooms.filter((r) => r.bookable);
  const canBook = bookable.length > 0;
  const firstRoom = bookable[0]?.room_type ?? "";
  const [checkIn, setCheckIn] = useState(() => defaultCheckIn(site.today));
  const [nights, setNights] = useState(2);
  const [room, setRoom] = useState(firstRoom);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const asked = useRef(0);
  const href = (type: string, day: string, n: number) =>
    bookingLink(site.booking_url ?? "/link", linkHref(type, day, n), here);
  const roomName = (r: HotelSitePayload["rooms"][number]) =>
    lang === "hi" ? r.name_hi || r.room_type : r.room_type;

  const amenities = d.amenity_labels.filter((a): a is typeof a & { id: AmenityId } => isAmenityId(a.id));
  const [allAmenities, setAllAmenities] = useState(false);
  const shownAmenities = allAmenities ? amenities : amenities.slice(0, AMENITIES_SHOWN);
  const [locationRef, locationNear] = useNearViewport<HTMLDivElement>();
  const formRef = useRef<HTMLFormElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const perk = cardPerk(d, lang);
  // False on the server and while hydrating, true after: before then the card
  // panel is rendered hidden and shown by CSS on a card visit (no layout shift).
  const hydrated = useSyncExternalStore(noSubscribe, yes, no);
  const showCard = preview ? Boolean(card) : Boolean(card) || !hydrated;
  const isSample = site.sample || d.sample;
  const hasLocation = Boolean(d.geo) || d.nearby.length > 0;
  // Reduced motion hides the globe's box in CSS (hotel.module.css), from the first paint.
  const canvas = useSyncExternalStore(noSubscribe, hasCanvas2d, yes);
  const showGlobe = Boolean(d.geo) && canvas;
  const showBar = Boolean(telLink || waLink || canBook);

  // Once per visit: count the card scan, drop ?src from the address (a reload
  // or a shared link does not count again), and register the offline page.
  useEffect(() => {
    if (preview) return;
    const scanned = scanCardFrom(window.location.search);
    if (scanned) {
      pingScan(site.slug, scanned);
      const { pathname, hash } = window.location;
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}${searchWithoutSrc(window.location.search)}${hash}`,
      );
    }
    registerOffline(site.slug);
  }, [site.slug, preview]);

  useEffect(() => {
    if (preview) return;
    const sample = site.sample ? (lang === "hi" ? " (नमूना)" : " (sample)") : "";
    document.title = `${name}${sample} · ${site.location[lang] || site.location.en}`;
  }, [name, site.location, site.sample, lang, preview]);

  /** "Book directly" and the Book buttons: to the booking form, with the check-in date focused (R2-8). */
  function goToBooking(event: MouseEvent<HTMLAnchorElement>) {
    const form = formRef.current;
    if (!form) return;
    event.preventDefault();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    form.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    dateRef.current?.focus({ preventScroll: true });
  }

  /** Preview: links lead nowhere (the in-page Book buttons still move to the form). */
  function stayInPreview(event: MouseEvent<HTMLElement>) {
    const link = (event.target as Element | null)?.closest("a");
    if (link && !(link.getAttribute("href") ?? "").startsWith("#")) event.preventDefault();
  }

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
    if (preview || status.kind === "closed") return;
    if (await check(checkIn, nights, room)) window.location.assign(href(room, checkIn, nights));
  }

  const closedReason = status.kind === "closed" ? (status.reason as keyof typeof c.closed) : null;
  const message =
    status.kind === "checking"
      ? c.checking
      : status.kind === "open"
        ? c.open
        : closedReason
          ? (c.closed[closedReason] ?? c.closed.full)
          : "";
  const bookAnchor = `#${id("book")}`;

  /** The owner's chosen photo for the room, else the usual photo order, else a labelled sample. */
  const roomPhoto = (_room: unknown, i: number, detail: RoomDetail | null) => {
    const chosen = detail?.photo_id != null ? photos.find((p) => p.id === detail.photo_id) : undefined;
    const photo = chosen ?? (photos.length ? photos[(i + 1) % photos.length] : undefined);
    return photo ? (
      <OwnerPhoto photo={photo} lang={lang} sizes="(min-width: 720px) 360px, 100vw" />
    ) : (
      <SamplePhoto background={ROOM_PHOTOS[i % ROOM_PHOTOS.length] ?? ""} chip={c.samplePhoto} />
    );
  };

  const Main = preview ? "div" : "main";

  return (
    <div
      className={`${s.root} ${hotelFonts} ${showBar ? s.withBar : ""} ${preview ? s.preview : ""}`}
      lang={lang}
      onClickCapture={preview ? stayInPreview : undefined}
    >
      <header className={s.head}>
        {site.hide_branding ? null : <SeedhaBar hotel={shortHotelName(name)} home={seedhaHome} t={t} />}
        <span className={`${s.brand} ${s.display}`}>{name}</span>
        <div className={s.langSwitch} role="group" aria-label={t.language}>
          {(["en", "hi"] as const).map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={lang === code}
              onClick={() => chooseLang(code)}
            >
              {/* The accessible name starts with the visible label (WCAG 2.5.3, review R3-10). */}
              {code === "en" ? "EN" : "हि"}
              <span className={s.srOnly}>{code === "en" ? " English" : " हिन्दी"}</span>
            </button>
          ))}
        </div>
        {canBook ? (
          <a className={`${s.pill} ${s.headBook}`} href={bookAnchor} onClick={goToBooking}>
            {c.book}
          </a>
        ) : waLink ? (
          <a className={`${s.pill} ${s.headBook}`} href={waLink} rel="noopener noreferrer">
            {t.askHotel}
          </a>
        ) : null}
      </header>

      <Main id={preview ? undefined : "main"} className={s.main}>
        {showCard ? (
          <CardWelcome
            slug={site.slug}
            hotel={name}
            lang={lang}
            t={t.card}
            sampleText={t.sample}
            perk={perk}
            isSample={isSample}
            bookingUrl={site.booking_url}
            firstRoom={firstRoom}
            here={here}
            card={card}
            rewards={site.rewards}
            gate={!preview && !hydrated}
            preview={preview}
          />
        ) : null}
        <section className={s.hero} aria-labelledby={id("hotel-name")}>
          {hero ? (
            <Picture className={s.heroPic} photo={hero} alt={caption(hero, lang)} sizes="100vw" eager />
          ) : (
            <span className={s.chip}>{c.samplePhoto}</span>
          )}
          <div className={s.heroText}>
            {site.location[lang] ? <p className={s.place}>{site.location[lang]}</p> : null}
            <h1 id={id("hotel-name")} className={`${s.display} ${s.h1}`}>
              {name}
            </h1>
            {site.tagline[lang] ? <p className={s.tagline}>{site.tagline[lang]}</p> : null}
            <div className={s.heroActions}>
              {canBook ? (
                <a className={s.pillLight} href={bookAnchor} onClick={goToBooking}>
                  {t.bookDirectly}
                </a>
              ) : null}
              {waLink ? (
                <a className={s.pillGhost} href={waLink} rel="noopener noreferrer">
                  {t.whatsapp}
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {canBook ? (
          <form
            ref={formRef}
            id={id("book")}
            className={s.bar}
            onSubmit={submit}
            noValidate
            aria-labelledby={id("book-title")}
          >
            <div className={s.barInner}>
              <h2 id={id("book-title")} className={`${s.display} ${s.barTitle}`}>
                {t.bookYourStay}
              </h2>
              <label className={s.field}>
                <span>{c.checkIn}</span>
                <input
                  ref={dateRef}
                  type="date"
                  value={checkIn}
                  min={addDays(site.today, 1)}
                  max={addDays(site.today, 365)}
                  required
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    void check(e.target.value, nights, room);
                  }}
                />
              </label>
              <label className={s.field}>
                <span>{c.nights}</span>
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
                <span>{c.room}</span>
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
                  t.bookDirect
                ) : (
                  <>
                    {t.bookDirect} <span className={s.powered}>· {t.powered}</span>
                  </>
                )}
              </button>
              <p className={`${s.barNote} ${closedReason ? s.closed : ""}`} role="status" aria-live="polite">
                {message}
              </p>
            </div>
          </form>
        ) : null}

        <AtAGlance site={site} t={t} titleId={id("glance")} />

        {about ? (
          <Section id={id("about")} title={t.about}>
            <p className={s.about}>{about}</p>
          </Section>
        ) : null}

        <Section id={id("why")} title={c.why}>
          <div className={s.why}>
            {points.length
              ? points.map((point) => (
                  <div key={point}>
                    <h3>{point}</h3>
                  </div>
                ))
              : c.whyItems.map(([title, body]) => (
                  <div key={title}>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                ))}
          </div>
        </Section>

        <Section id={id("rooms")} title={c.rooms}>
          <RoomCards
            rooms={site.rooms}
            details={d.rooms}
            lang={lang}
            t={t}
            aNight={c.aNight}
            bookShort={c.bookShort}
            roomName={roomName}
            photo={roomPhoto}
            bookHref={(r) => href(r.room_type, checkIn, nights)}
            waLink={waLink}
          />
        </Section>

        <Section id={id("packages")} title={c.packages}>
          {site.packages.length ? (
            <>
              <div className={s.packages}>
                {site.packages.map((p) => (
                  <article key={p.key} className={s.pkg}>
                    <h3 className={s.display}>{p.name[lang]}</h3>
                    <p className={s.muted}>{p.includes[lang]}</p>
                    <p className={`${s.pkgPrice} ${s.num}`}>{inr(p.price)}</p>
                  </article>
                ))}
              </div>
              <p className={s.note}>{c.packagesNote}</p>
            </>
          ) : (
            <div className={s.soon}>
              <p className={s.soonTitle}>{c.comingSoon}</p>
              <p className={s.muted}>{c.comingSoonSub}</p>
            </div>
          )}
        </Section>

        {amenities.length ? (
          <Section id={id("amenities")} title={t.amenities}>
            <ul className={s.amenities} id={id("amenity-list")}>
              {shownAmenities.map((a) => (
                <li key={a.id} data-amenity={a.id}>
                  <AmenityIcon id={a.id} className={s.icon} />
                  <span>{lang === "hi" ? a.hi : a.en}</span>
                </li>
              ))}
            </ul>
            {amenities.length > AMENITIES_SHOWN ? (
              <button
                type="button"
                className={s.more}
                aria-expanded={allAmenities}
                aria-controls={id("amenity-list")}
                onClick={() => setAllAmenities((v) => !v)}
              >
                {allAmenities ? t.showFewer : t.showAll(amenities.length)}
              </button>
            ) : null}
          </Section>
        ) : null}

        <Section
          id={id("photos")}
          title={t.gallery}
          aside={photos.length ? null : <span className={s.chipQuiet}>{c.samplePhotos}</span>}
        >
          <div className={s.gallery}>
            {photos.length
              ? photos.map((p) => (
                  <OwnerPhoto
                    key={p.id}
                    photo={p}
                    lang={lang}
                    label={caption(p, lang)}
                    sizes="(min-width: 720px) 33vw, 50vw"
                  />
                ))
              : site.gallery.map((g, i) => (
                  <SamplePhoto
                    key={g.en}
                    background={GALLERY_PHOTOS[i % GALLERY_PHOTOS.length] ?? ""}
                    label={g[lang]}
                  />
                ))}
          </div>
        </Section>

        <Ratings ratings={site.ratings} lang={lang} t={t} titleId={id("ratings")} waLink={waLink} />

        {hasLocation ? (
          <Section id={id("location")} title={t.location}>
            <div className={`${s.locationGrid} ${showGlobe ? "" : s.noGlobe}`} ref={locationRef}>
              {showGlobe && d.geo ? (
                <div className={s.globeCell} data-globe-cell="">
                  {locationNear ? (
                    <LocationGlobe geo={d.geo} nearby={d.nearby} hotel={name} lang={lang} />
                  ) : (
                    <div style={GLOBE_BOX} aria-hidden="true" />
                  )}
                </div>
              ) : null}
              {d.nearby.length ? (
                <div className={s.mapCard} data-map-card="">
                  {locationNear ? <LocalMap geo={d.geo} nearby={d.nearby} hotel={name} lang={lang} /> : null}
                </div>
              ) : null}
            </div>
            {/* LocalMap carries "Open in Maps" when there are nearby places; without them, it is here. */}
            {maps && !d.nearby.length ? (
              <p className={s.mapsRow}>
                <a className={s.link} href={maps} target="_blank" rel="noopener noreferrer">
                  {t.openInMaps}
                  <span className={s.srOnly}> ({t.mapsNote})</span>
                </a>
              </p>
            ) : null}
          </Section>
        ) : null}

        {d.how_to_reach.length ? (
          <Section id={id("reach")} title={t.howToReach}>
            <div className={s.cards}>
              {d.how_to_reach.map((r, i) => (
                <div key={`${r.mode}-${i}`} className={s.card}>
                  <ReachIcon mode={r.mode} className={s.icon} />
                  <div>
                    <h3>{t.reach[r.mode]}</h3>
                    <p>{pick(r.text_en, r.text_hi, lang)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <Section id={id("know")} title={t.houseRules}>
          <div className={s.times}>
            <p>
              {t.checkIn} <b className={s.num}>{d.check_in}</b>
              {lang === "hi" ? ` ${t.from}` : ""}
            </p>
            <p>
              {t.checkOut} <b className={s.num}>{d.check_out}</b>
              {lang === "hi" ? ` ${t.until}` : ""}
            </p>
          </div>
          {d.good_to_know.length ? (
            <ul className={s.notes}>
              {d.good_to_know.map((n, i) => (
                <li key={i}>{pick(n.text_en, n.text_hi, lang)}</li>
              ))}
            </ul>
          ) : null}
        </Section>

        {telLink || waLink || d.contact.email || address || site.contact.upi ? (
          <Section id={id("contact")} title={t.contact}>
            <ul className={s.list}>
              {telLink ? (
                <li>
                  <span>{t.phone}</span>
                  <a className={s.link} href={telLink}>
                    <span className={s.num}>{phone}</span>
                  </a>
                </li>
              ) : null}
              {waLink ? (
                <li>
                  <span>{t.whatsapp}</span>
                  <a className={s.link} href={waLink} rel="noopener noreferrer">
                    <span className={s.num}>{whatsapp}</span>
                  </a>
                </li>
              ) : null}
              {d.contact.email ? (
                <li>
                  <span>{t.email}</span>
                  <a className={s.link} href={`mailto:${d.contact.email}`}>
                    {d.contact.email}
                  </a>
                </li>
              ) : null}
              {address ? (
                <li>
                  <span>{t.address}</span>
                  <span className={s.muted}>{address}</span>
                </li>
              ) : null}
              {site.contact.upi ? (
                <li>
                  <span>{t.upi}</span>
                  <span className={s.num}>{site.contact.upi}</span>
                </li>
              ) : null}
            </ul>
            {d.sample || site.contact.placeholder ? <p className={s.note}>{t.sampleContact}</p> : null}
          </Section>
        ) : null}
      </Main>

      <footer className={s.foot}>
        {site.sample ? <p>{t.sampleHotel}</p> : null}
        {site.hide_branding ? null : (
          <p>
            <a className={s.footLink} href={seedhaHome}>
              {t.built}
            </a>
          </p>
        )}
      </footer>

      {showBar ? (
        <nav className={s.mobileBar} aria-label={t.quickActions}>
          {telLink ? <a href={telLink}>{t.call}</a> : null}
          {waLink ? (
            <a href={waLink} rel="noopener noreferrer">
              {t.whatsapp}
            </a>
          ) : null}
          {canBook ? (
            <a className={s.barPrimary} href={bookAnchor} onClick={goToBooking}>
              {c.bookShort}
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
