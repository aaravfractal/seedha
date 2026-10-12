"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Lang, Mood, OwnerSite } from "@/lib/types-site";
import { worldBFonts } from "@/lib/fonts-worldb";
import { HotelSite } from "./HotelSite";
import PublishPanel from "./PublishPanel";
import o from "./owner.module.css";

const MOODS: ReadonlyArray<[Mood, string, string]> = [
  ["pine", "Pine", "#1F4D3A"],
  ["stone", "Stone", "#4A4540"],
  ["sky", "Sky", "#2F6FA8"],
];

/**
 * Shows a page laid out at `width` CSS pixels, scaled to fit the frame. The
 * page itself is inert (a picture of the site); the frame scrolls.
 */
function PreviewFrame({
  width,
  height,
  label,
  children,
}: {
  width: number;
  height: number;
  label: string;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0, height: 0 });

  useEffect(() => {
    const frame = outer.current;
    const page = inner.current;
    if (!frame || !page) return;
    const measure = () => setSize({ scale: frame.clientWidth / width, height: page.offsetHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outer} className={o.viewport} style={{ height }} tabIndex={0} role="region" aria-label={label}>
      <div style={{ height: size.height * size.scale, overflow: "hidden" }}>
        <div
          ref={inner}
          inert
          style={{
            width,
            transform: `scale(${size.scale})`,
            transformOrigin: "0 0",
            visibility: size.scale ? "visible" : "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Review before publish, and the live state after. Nothing is public until Publish site (rule 9). */
export function Review({
  site,
  busy,
  onLook,
  onChange,
  onPackages,
}: {
  site: OwnerSite;
  busy: boolean;
  onLook: (patch: { mood?: Mood; lang?: Lang }) => void;
  onPublish: () => void;
  onChange: () => void;
  onCopy: (url: string) => void;
  onPackages: () => void;
}) {
  const approved = site.packages.filter((p) => p.approved);
  const publicPath = `/h/${site.slug}`;
  const today = new Date().toISOString().slice(0, 10);
  const page = (
    <div className={worldBFonts}>
      <HotelSite site={site} packages={approved} lang={site.lang} mood={site.mood} today={today} preview />
    </div>
  );

  return (
    <div className={o.stack}>
      <div className={o.reviewHead}>
        <div>
          <h2 className={o.h2}>Your hotel, online.</h2>
          <p className={o.sub}>
            {site.live ? "Live now. Change anything and publish again." : "Check it, then publish."}
          </p>
        </div>
        <div className={o.switches}>
          <div className={o.seg} role="group" aria-label="Look">
            {MOODS.map(([key, label, colour]) => (
              <button
                key={key}
                type="button"
                aria-pressed={site.mood === key}
                disabled={busy}
                onClick={() => onLook({ mood: key })}
              >
                <span className={o.dot} style={{ background: colour }} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div className={o.seg} role="group" aria-label="Language">
            <button
              type="button"
              aria-pressed={site.lang === "en"}
              disabled={busy}
              onClick={() => onLook({ lang: "en" })}
            >
              English
            </button>
            <button
              type="button"
              lang="hi"
              className={o.deva}
              aria-pressed={site.lang === "hi"}
              disabled={busy}
              onClick={() => onLook({ lang: "hi" })}
            >
              हिंदी
            </button>
          </div>
        </div>
      </div>

      {site.live ? null : (
        <p className={o.notice}>
          Not live yet. Only you can see this preview. Nothing goes online until you tap Publish site.
        </p>
      )}

      <div className={o.previews}>
        <div>
          <div className={o.phoneMock}>
            <PreviewFrame width={390} height={560} label="Phone preview of your site. Scroll to see more.">
              {page}
            </PreviewFrame>
          </div>
          <p className={o.previewLabel}>Phone</p>
        </div>
        <div>
          <div className={o.browser}>
            <div className={o.browserBar} aria-hidden="true">
              <i style={{ background: "#FF5F57" }} />
              <i style={{ background: "#FEBC2E" }} />
              <i style={{ background: "#28C840" }} />
              <span className={o.url}>{site.address}</span>
            </div>
            <PreviewFrame width={1280} height={560} label="Desktop preview of your site. Scroll to see more.">
              {page}
            </PreviewFrame>
          </div>
          <p className={o.previewLabel}>Computer</p>
        </div>
      </div>

      <div className={o.card}>
        <h3 className={o.cardTitle}>{site.live ? "On your site" : "Before you publish"}</h3>
        <ul className={o.checklist}>
          <li>
            <span>Photos</span>
            <span className={o.muted}>Sample photos, replace with your own</span>
          </li>
          <li>
            <span>Rooms and prices</span>
            <span className={o.muted}>{site.rooms.length} room types</span>
          </li>
          <li>
            <span>Nearby places</span>
            <span className={o.muted}>{site.nearby.length} places</span>
          </li>
          <li>
            <span>Contact and UPI</span>
            <span className={o.muted}>{site.contact.placeholder ? "Placeholders" : "Added"}</span>
          </li>
          <li data-optional={approved.length === 0}>
            <span>Packages</span>
            <button type="button" className="link" onClick={onPackages}>
              {approved.length} of {site.packages.length} approved
            </button>
          </li>
        </ul>
        <div className={o.actions}>
          {site.live ? (
            <>
              <Link className="btn" href={publicPath} target="_blank">
                Open my site
              </Link>
              <Link className="btn ghost" href="/rate-card">
                Rate card
              </Link>
              <Link className="btn ghost" href="/agent-deck">
                Agent deck
              </Link>
            </>
          ) : null}
          <button type="button" className="btn ghost" disabled={busy} onClick={onChange}>
            Change something
          </button>
        </div>
      </div>
      <PublishPanel hotelName={site.hotel} />
    </div>
  );
}
