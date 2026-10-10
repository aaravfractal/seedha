"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Loadable } from "@/lib/api";
import { count, inr, pctTenths } from "@/lib/format";
import type { Sample } from "@/lib/types-website";
import { flipToast, periodLabel } from "@/lib/website";
import styles from "./site.module.css";

const WORDS = ["Know", "what", "you", "really", "keep."];
const SPRING = [0.22, 1, 0.36, 1] as const;
const MARQUEE = ["ROOM NIGHTS", "NET ADR", "NIGHT AUDIT", "FOLIO", "FRONT DESK", "CLOSE SLIP 9 PM"];

/** Eyebrow, blur-in headline, lede, buttons, marquee and the product window. */
export function Hero({ sample }: { sample: Loadable<Sample> }) {
  const reduce = useReducedMotion();
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <div className={`${styles.container} ${styles.heroInner}`}>
        <p className={styles.eyebrow}>FOR HOTELS, HOMESTAYS AND MOUNTAIN STAYS</p>
        <h1 id="hero-title" className={styles.h1}>
          {WORDS.map((word, i) => (
            <span key={word}>
              <motion.span
                className={`${styles.word}${word === "keep." ? ` ${styles.shine}` : ""}`}
                initial={reduce ? false : { opacity: 0, filter: "blur(14px)", y: 28, scale: 0.96 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0, scale: 1 }}
                transition={{ duration: 0.9, delay: i * 0.15, ease: SPRING }}
              >
                {word}
              </motion.span>
              {i < WORDS.length - 1 ? " " : null}
            </span>
          ))}
        </h1>
        <p className={styles.heroLede}>
          Every booking channel, after discount, commission and GST. On one screen.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/demo" className={`${styles.pill} ${styles.pillLg}`}>
            Try the live demo
          </Link>
          <Link href="/contact" className={`${styles.pillOutline} ${styles.pillLg}`}>
            Talk to us on WhatsApp
          </Link>
        </div>
      </div>
      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.marqueeTrack}>
          {[...MARQUEE, ...MARQUEE].map((w, i) => (
            <span key={`${w}-${i}`}>{w} ·</span>
          ))}
        </div>
      </div>
      <div id="product" className={styles.container} style={{ scrollMarginTop: 80 }}>
        <ProductWindow sample={sample} />
      </div>
    </section>
  );
}

const ROW_H = 60;
const GAP = 10;

/** The product window: KPI tiles and the live flip, tilting flat as you scroll. */
function ProductWindow({ sample }: { sample: Loadable<Sample> }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const rotateX = useTransform(scrollY, [0, 600], [18, 0]);
  const scale = useTransform(scrollY, [0, 600], [0.92, 1]);
  const data = sample.data;

  return (
    <div className={styles.windowWrap}>
      <motion.div className={styles.window} style={reduce ? undefined : { rotateX, scale }}>
        <div className={styles.winBar}>
          <div className={styles.dots} aria-hidden="true">
            <span style={{ background: "#FF5F57" }} />
            <span style={{ background: "#FEBC2E" }} />
            <span style={{ background: "#28C840" }} />
          </div>
          <span className={styles.winChip}>{data ? `${data.hotel} · ${data.city}` : "Sample hotel"}</span>
          <span className={styles.winPeriod}>{data ? periodLabel(data.start, data.end) : ""}</span>
        </div>
        <div className={styles.winBody}>
          {data ? (
            <Flip data={data} />
          ) : sample.error ? (
            <div className={styles.errorBox} role="alert">
              <span>The sample figures could not load. {sample.error.message}</span>
              <button type="button" className={styles.pillOutline} onClick={sample.reload}>
                Try again
              </button>
            </div>
          ) : (
            <div role="status" aria-busy="true">
              <span className={styles.srOnly}>Loading sample figures</span>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={styles.skeleton} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Flip({ data }: { data: Sample }) {
  const [byMoney, setByMoney] = useState(false);
  const [toast, setToast] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const names = Object.fromEntries(data.channels.map((c) => [c.key, c.name]));
  const order = byMoney ? data.rank_by_money_kept : data.rank_by_bookings;
  const top = data.rank_by_bookings[0];
  const maxNights = Math.max(...data.channels.map((c) => c.room_nights), 1);
  const maxAdr = Math.max(...data.channels.map((c) => c.net_adr ?? 0), 1);
  const height = data.channels.length * (ROW_H + GAP) - GAP;
  const freeShare = data.commission_free_share_tenths;

  function choose(money: boolean) {
    if (money === byMoney) return;
    setByMoney(money);
    timers.current.forEach(clearTimeout);
    setToast("");
    const text = flipToast(data.rank_by_bookings, data.rank_by_money_kept, names);
    if (money && text) {
      timers.current = [setTimeout(() => setToast(text), 700), setTimeout(() => setToast(""), 700 + 2800)];
    }
  }

  return (
    <>
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>List revenue</div>
          <div className={`${styles.kpiValue} ${styles.money}`}>{inr(data.list_revenue)}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Net kept</div>
          <div className={`${styles.kpiValue} ${styles.money}`}>{inr(data.net_kept)}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Paid to channels</div>
          <div className={`${styles.kpiValue} ${styles.money} ${styles.loss}`}>
            {inr(-data.paid_to_channels)}
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Commission-free share</div>
          <div className={styles.kpiValue}>{freeShare === null ? "–" : pctTenths(freeShare)}</div>
          {data.direct_bookings_tenths !== null ? (
            <div className={styles.kpiSub}>Direct bookings {pctTenths(data.direct_bookings_tenths)}</div>
          ) : null}
        </div>
      </div>

      <div className={styles.flipHead}>
        <h2 className={styles.flipTitle}>Bookings are not money.</h2>
        <div className={styles.seg} role="group" aria-label="Rank channels">
          <span
            className={styles.segPill}
            aria-hidden="true"
            style={{ transform: byMoney ? "translateX(100%)" : "none" }}
          />
          <button
            type="button"
            className={styles.segBtn}
            aria-pressed={!byMoney}
            onClick={() => choose(false)}
          >
            By bookings
          </button>
          <button type="button" className={styles.segBtn} aria-pressed={byMoney} onClick={() => choose(true)}>
            By money kept
          </button>
        </div>
      </div>

      <ol className={styles.rows} style={{ height, listStyle: "none", margin: 0, padding: 0 }}>
        {data.channels.map((c) => {
          const rank = order.indexOf(c.key);
          const share = byMoney ? (c.net_adr ?? 0) / maxAdr : c.room_nights / maxNights;
          const ring = byMoney && c.key === top;
          return (
            <li
              key={c.key}
              className={`${styles.row}${ring ? ` ${styles.rowRing}` : ""}`}
              style={{ transform: `translateY(${rank * (ROW_H + GAP)}px)` }}
              aria-setsize={data.channels.length}
              aria-posinset={rank + 1}
            >
              <span className={styles.rank}>{rank + 1}</span>
              <span className={styles.rowName}>{c.name}</span>
              <span className={styles.bar} aria-hidden="true">
                <span
                  className={styles.barFill}
                  style={{ display: "block", transform: `scaleX(${share})` }}
                />
              </span>
              <span className={`${styles.rowValue} ${styles.money}`}>
                {byMoney ? (c.net_adr === null ? "–" : inr(c.net_adr)) : count(c.room_nights)}
                <span className={styles.rowCaption}>{byMoney ? "kept per room night" : "room nights"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className={styles.calc}>Calculated from sample statements. All data is fictional.</p>
      <div
        className={`${styles.winToast}${toast ? ` ${styles.winToastShow}` : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </>
  );
}
