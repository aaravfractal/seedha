"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import type { OwnerSite } from "@/lib/types-site";
import { Photo } from "@/components/site/HotelSite";
import { WorldBMessage } from "@/components/site/WorldBMessage";
import p from "@/components/site/print.module.css";
import s from "@/components/site/worldb.module.css";

const TITLES = ["Cover", "Rooms", "Packages", "Groups and weddings", "How to reach", "Book with us"];
const ROOM_PHOTOS = [
  "linear-gradient(160deg,#8E7D6A,#A89A86)",
  "linear-gradient(160deg,#5B7A5A,#9BAF94)",
  "linear-gradient(160deg,#C9C1B4,#9A938C)",
];

function Slide({
  index,
  current,
  className,
  children,
}: {
  index: number;
  current: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`${p.slide} ${className ?? ""}`}
      data-current={index === current}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${TITLES.length}: ${TITLES[index]}`}
    >
      {children}
    </section>
  );
}

/** Six slides for travel agents, companies and wedding groups. Arrow keys move; prints one slide per page. */
export default function AgentDeckPage() {
  const site = useApi<OwnerSite>("site");
  const [current, setCurrent] = useState(0);
  const last = TITLES.length - 1;
  const go = useCallback((n: number) => setCurrent(Math.max(0, Math.min(last, n))), [last]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea")) return;
      const moves: Record<string, () => void> = {
        ArrowRight: () => setCurrent((c) => Math.min(last, c + 1)),
        PageDown: () => setCurrent((c) => Math.min(last, c + 1)),
        ArrowLeft: () => setCurrent((c) => Math.max(0, c - 1)),
        PageUp: () => setCurrent((c) => Math.max(0, c - 1)),
        Home: () => setCurrent(0),
        End: () => setCurrent(last),
      };
      const move = moves[e.key];
      if (move) {
        e.preventDefault();
        move();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  if (site.error)
    return (
      <WorldBMessage title="The agent deck did not load." body={site.error.message} onRetry={site.reload} />
    );
  if (!site.data) return <WorldBMessage title="Preparing the agent deck" loading />;
  const d = site.data;
  const packages = d.packages.filter((x) => x.approved);

  return (
    <div className={p.deck}>
      <div className={p.deckBar}>
        <Link href="/site" aria-label="Back to Website">
          ‹ Website
        </Link>
        <button
          type="button"
          aria-label="Previous slide"
          disabled={current === 0}
          onClick={() => go(current - 1)}
        >
          ‹
        </button>
        <span className={p.count} aria-live="polite">
          {current + 1} / {TITLES.length}
          <span className="sr-only-text">: {TITLES[current]}</span>
        </span>
        <button
          type="button"
          aria-label="Next slide"
          disabled={current === last}
          onClick={() => go(current + 1)}
        >
          ›
        </button>
        <button type="button" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <div
        className={`${s.wb} ${p.slides}`}
        style={{ background: "transparent" }}
        data-mood={d.mood}
        lang="en"
        aria-roledescription="slide deck"
        role="region"
        aria-label={`${d.hotel} agent deck`}
      >
        <Slide index={0} current={current}>
          <span className={p.slideChip}>Sample photo · valley view</span>
          <div className={`${p.slidePad} ${p.cover}`}>
            <p>{d.location.en}</p>
            <h1 className={s.display}>{d.hotel}</h1>
            <p>
              {d.tagline.en} {d.rooms_count} rooms. For travel agents, companies and wedding groups.
            </p>
          </div>
        </Slide>

        <Slide index={1} current={current}>
          <div className={p.slidePad}>
            <h2 className={s.display}>Rooms</h2>
            <div className={p.cards}>
              {d.rooms.map((r, i) => (
                <div key={r.room_type}>
                  <Photo background={ROOM_PHOTOS[i % ROOM_PHOTOS.length] ?? ""} />
                  <b>{r.room_type}</b>
                  <p className={s.muted}>{r.detail.en}</p>
                  <p>
                    <b style={{ display: "inline" }}>{inr(r.nightly_rate)}</b> a night
                  </p>
                </div>
              ))}
            </div>
            <p className={p.small}>
              Sample photos. Prices per night, from the hotel&apos;s public room rates.
            </p>
          </div>
        </Slide>

        <Slide index={2} current={current} className={p.dark}>
          <div className={p.slidePad}>
            <h2 className={s.display}>Packages</h2>
            {packages.length ? (
              <div className={p.cards}>
                {packages.map((x) => (
                  <div key={x.key}>
                    <h3 className={s.display}>{x.name.en}</h3>
                    <p>{x.includes.en}</p>
                    <p style={{ marginTop: "2cqw" }}>
                      <b>{inr(x.price)}</b>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "2.6cqw", margin: 0 }}>Packages coming soon. Ask us on WhatsApp.</p>
            )}
            <p className={p.small} style={{ color: "inherit", opacity: 0.9 }}>
              Packages add value. Room prices stay as listed.
            </p>
          </div>
        </Slide>

        <Slide index={3} current={current}>
          <div className={p.split}>
            <Photo background="linear-gradient(160deg,#E9B58A,#6E4A5E)" chip="Sample photo" />
            <div className={p.slidePad} style={{ position: "relative" }}>
              <h2 className={s.display}>Groups and weddings</h2>
              <ul className={p.rows}>
                <li>
                  <span>Rooms</span>
                  <span>{d.rooms_count}</span>
                </li>
                <li>
                  <span>Meals</span>
                  <span>Veg and non-veg buffets</span>
                </li>
                <li>
                  <span>Quotes</span>
                  <span>WhatsApp {d.contact.phone}</span>
                </li>
              </ul>
              <p className={p.small}>Meal options are placeholders. Sample data.</p>
            </div>
          </div>
        </Slide>

        <Slide index={4} current={current}>
          <div className={p.split}>
            <div className={p.slidePad} style={{ position: "relative" }}>
              <div className={p.map} style={{ flex: 1 }}>
                Map · {d.location.en}
              </div>
            </div>
            <div className={p.slidePad} style={{ position: "relative", paddingLeft: "2cqw" }}>
              <h2 className={s.display}>How to reach</h2>
              <ul className={p.rows}>
                {d.nearby.map((n) => (
                  <li key={n.place.en}>
                    <span>{n.place.en}</span>
                    <span>{n.distance.en}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Slide>

        <Slide index={5} current={current} className={p.graphite}>
          <div className={p.slidePad}>
            <h2 className={s.display}>Book with us</h2>
            <p>WhatsApp or call {d.contact.phone}</p>
            <p>Advance by UPI to {d.contact.upi}</p>
            <p>{d.address}</p>
            <div className={p.slideFoot}>
              <span>
                {d.contact.placeholder ? "Contact, UPI and website are placeholders. Sample data." : ""}
              </span>
              <span>Made with Seedha</span>
            </div>
          </div>
        </Slide>
      </div>
    </div>
  );
}
