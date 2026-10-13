"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { count, inr } from "@/lib/format";
import type { Sample } from "@/lib/types-website";
import { growth } from "@/lib/website";
import { useSeenOnce } from "./hooks";
import styles from "./site.module.css";

const SPRING = [0.22, 1, 0.36, 1] as const;

/* ---------- The flip explainer ---------- */

export function FlipExplainer({ data }: { data: Sample }) {
  const [ref, seen] = useSeenOnce<HTMLDivElement>();
  const byKey = Object.fromEntries(data.channels.map((c) => [c.key, c]));
  const rows = data.rank_by_money_kept.map((k) => byKey[k]).filter((c) => c && c.list_adr !== null);
  const max = Math.max(...rows.map((c) => c?.list_adr ?? 0), 1);
  return (
    <section id="flip" className={styles.section} aria-labelledby="flip-title">
      <div className={`${styles.container} ${styles.split}`}>
        <div>
          <p className={styles.kicker}>The flip</p>
          <h2 id="flip-title" className={styles.h2}>
            Your biggest channel can pay you the least.
          </h2>
          <p className={styles.lede}>
            List ADR is what the guest paid. Net ADR is what reached your bank after hotel-funded discount,
            commission, GST on commission and payment fees.
          </p>
          <div className={styles.stats2}>
            <div>
              <div className={`${styles.statNum} ${styles.money}`}>{inr(data.revpar_list)}</div>
              <div className={styles.statCap}>List RevPAR</div>
            </div>
            <div>
              <div className={`${styles.statNum} ${styles.money}`}>{inr(data.revpar_net)}</div>
              <div className={styles.statCap}>Net RevPAR</div>
            </div>
          </div>
        </div>
        <div ref={ref} className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>List ADR vs net ADR</h3>
            <span className={styles.statCap}>per room night</span>
          </div>
          {rows.map((c) =>
            c ? (
              <div key={c.key} className={styles.adrRow}>
                <div className={styles.adrTop}>
                  <span>{c.name}</span>
                  <span className={`${styles.adrVals} ${styles.money}`}>
                    <span className={styles.adrList}>
                      <span className={styles.srOnly}>List </span>
                      {inr(c.list_adr ?? 0)}
                    </span>
                    <span className={styles.adrNet}>
                      <span className={styles.srOnly}>Net </span>
                      {c.net_adr === null ? "–" : inr(c.net_adr)}
                    </span>
                  </span>
                </div>
                <div className={styles.adrTrack} aria-hidden="true">
                  <span
                    className={styles.adrListBar}
                    style={{ width: "100%", transform: `scaleX(${seen ? (c.list_adr ?? 0) / max : 0})` }}
                  />
                  <span
                    className={styles.adrNetBar}
                    style={{ width: "100%", transform: `scaleX(${seen ? (c.net_adr ?? 0) / max : 0})` }}
                  />
                </div>
              </div>
            ) : null,
          )}
          <p className={styles.calc}>Green is kept. Grey is the gap lost to channels.</p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */

const FEATURES = [
  [
    "Desk",
    "Seedha Desk",
    "A reception box. Guests tick consent by QR, the ring turns green, the slip prints.",
    "4-second consent",
  ],
  ["Link", "Seedha Link", "One-page direct booking with the perk code prefilled and UPI.", "Book direct"],
  [
    "Site",
    "Seedha Site",
    "No website? Add photos and a few lines, and get one with direct booking.",
    "Review before it goes online",
  ],
  [
    "Proof",
    "Seedha Proof",
    "Every guest yes is sealed nightly so you can prove consent later.",
    "Every yes provable",
  ],
  [
    "Pulse · Pro",
    "Seedha Pulse",
    "Festivals and long weekends turned into one channel decision each.",
    "Not a prediction",
  ],
  [
    "Audit · Pro",
    "Seedha Audit",
    "Flags commission overcharges and commission on cancelled stays.",
    "Money to claim back",
  ],
] as const;

export function Features() {
  return (
    <section className={styles.section} aria-labelledby="features-title">
      <div className={styles.container}>
        <h2 id="features-title" className={styles.h2}>
          Everything a hill hotel needs. Nothing it does not.
        </h2>
        <div className={styles.features}>
          {FEATURES.map(([kicker, title, body, outcome]) => (
            <article key={title} className={styles.feature}>
              <span className={styles.featKicker}>{kicker}</span>
              <h3 className={styles.featTitle}>{title}</h3>
              <p className={styles.featBody}>{body}</p>
              <span className={styles.featOutcome}>{outcome}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Growth calculator ---------- */

const W = 560;
const H = 280;
const PAD = 12;

export function GrowthCalculator({ data }: { data: Sample }) {
  const reduce = useReducedMotion();
  const [nights, setNights] = useState(20);
  const [hover, setHover] = useState<number | null>(null);
  const g = data.growth;
  if (!g) return null;
  const result = growth(nights, g.per_room_night);
  // A fixed scale at the slider's maximum, so the line visibly rises as you drag.
  const top = Math.max(growth(60, g.per_room_night).perYear, result.cost) * 1.05;
  const x = (m: number) => PAD + ((m - 1) / 11) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / top) * (H - PAD * 2);
  const line = result.months
    .map((p, i) => `${i ? "L" : "M"}${x(p.month).toFixed(1)},${y(p.kept).toFixed(1)}`)
    .join("");
  const area = `${line}L${x(12).toFixed(1)},${H - PAD}L${x(1).toFixed(1)},${H - PAD}Z`;
  const cost = result.months
    .map((p, i) => `${i ? "L" : "M"}${x(p.month).toFixed(1)},${y(p.cost).toFixed(1)}`)
    .join("");
  const tip = hover === null ? null : result.months[hover];
  const t = { duration: reduce ? 0 : 0.5, ease: SPRING };

  return (
    <section id="growth" className={styles.section} aria-labelledby="growth-title">
      <div className={styles.container}>
        <p className={styles.kicker}>Growth</p>
        <h2 id="growth-title" className={styles.h2}>
          Move a few nights direct. Watch what you keep.
        </h2>
        <p className={styles.lede}>
          Each room night moved from {g.from_channel} to direct keeps {inr(g.per_room_night)} more: net ADR{" "}
          {inr(g.direct_net_adr)} minus {inr(g.from_net_adr)}.
        </p>
        <div className={styles.growGrid}>
          <div className={styles.card}>
            <label htmlFor="growth-nights" className={styles.growLabel}>
              Room nights moved direct each month
            </label>
            <div className={styles.bigNum} aria-hidden="true">
              {nights}
            </div>
            <input
              id="growth-nights"
              className={styles.slider}
              type="range"
              min={0}
              max={60}
              step={1}
              value={nights}
              onChange={(e) => setNights(Number(e.target.value))}
              style={{ ["--pct" as string]: `${(nights / 60) * 100}%` }}
            />
            <div className={styles.growRows} aria-live="polite">
              <div className={styles.growRow}>
                <span>Extra kept per month</span>
                <span className={styles.money}>+{inr(result.perMonth)}</span>
              </div>
              <div className={styles.growRow}>
                <span>Extra kept in 12 months</span>
                <span className={styles.money}>+{inr(result.perYear)}</span>
              </div>
              <div className={styles.growRow}>
                <span>Seedha Base, 12 months</span>
                <span className={styles.money}>{inr(-result.cost)}</span>
              </div>
            </div>
            <div className={styles.keepBox}>
              <span>You keep after Seedha</span>
              <strong className={styles.money}>{inr(result.afterSeedha)}</strong>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHead} style={{ flexWrap: "wrap" }}>
              <h3 className={styles.cardTitle}>Cumulative extra kept</h3>
              <div className={styles.legend}>
                <span>
                  <i className={styles.legendLine} aria-hidden="true" />
                  Extra kept
                </span>
                <span>
                  <i className={styles.legendDash} aria-hidden="true" />
                  Seedha cost
                </span>
              </div>
            </div>
            <div className={styles.chartTip} aria-hidden="true">
              {tip ? `Month ${tip.month}: +${inr(tip.kept)} kept, ${inr(tip.cost)} Seedha cost` : ""}
            </div>
            <svg
              className={styles.chart}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-labelledby="growth-chart-desc"
            >
              <desc id="growth-chart-desc">
                Extra kept rises to {inr(result.perYear)} after 12 months. Seedha Base costs{" "}
                {inr(result.cost)} over the same 12 months.
              </desc>
              <defs>
                <linearGradient id="growth-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1={PAD}
                  x2={W - PAD}
                  y1={H - PAD - f * (H - PAD * 2)}
                  y2={H - PAD - f * (H - PAD * 2)}
                  stroke="var(--line)"
                />
              ))}
              <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="var(--line)" />
              <motion.path d={area} animate={{ d: area }} transition={t} fill="url(#growth-fill)" />
              <motion.path
                d={cost}
                animate={{ d: cost }}
                transition={t}
                fill="none"
                stroke="var(--ink2)"
                strokeWidth={2}
                strokeDasharray="6 6"
              />
              <motion.path
                d={line}
                animate={{ d: line }}
                transition={t}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
              />
              {result.months.map((p, i) => (
                <g key={p.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={x(p.month) - 20} y={0} width={40} height={H} fill="transparent" />
                  <motion.circle
                    cx={x(p.month)}
                    animate={{ cy: y(p.kept) }}
                    initial={false}
                    transition={t}
                    r={hover === i ? 6 : 4}
                    fill="var(--bg2)"
                    stroke="var(--accent)"
                    strokeWidth={2}
                  />
                </g>
              ))}
            </svg>
            <table className={styles.srOnly}>
              <caption>Cumulative extra kept and Seedha cost by month</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Extra kept</th>
                  <th scope="col">Seedha cost</th>
                </tr>
              </thead>
              <tbody>
                {result.months.map((p) => (
                  <tr key={p.month}>
                    <th scope="row">{p.month}</th>
                    <td>{inr(p.kept)}</td>
                    <td>{inr(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.calc}>
              Illustration, not a promise. Worked from sample net ADRs. Seedha counts a saving only when a
              perk code is used.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Guest map (2D, D13) ---------- */

export function GuestMap({ data }: { data: Sample }) {
  const max = Math.max(...data.guest_cities.map((c) => c.stays), 1);
  return (
    <section id="guest-map" className={styles.section} aria-labelledby="map-title">
      <div className={`${styles.container} ${styles.split}`}>
        <div>
          <p className={styles.kicker}>Guest map</p>
          <h2 id="map-title" className={styles.h2}>
            Know where your guests come from.
          </h2>
          <p className={styles.lede}>
            Home cities from your own statements, counted and never named. Use it to choose where a direct
            offer is worth sending.
          </p>
          <p className={styles.footnote}>
            Sample guest origins from the demo ledger. Your own map fills in after you upload statements. 3D
            view coming soon.
          </p>
        </div>
        <div className={styles.card}>
          <div className={styles.hillTown}>
            <span className={styles.hillDot} aria-hidden="true" />
            <span>
              <b>{data.city}</b>
              <span className={styles.statCap}> · hill town, {data.hotel}</span>
            </span>
          </div>
          <ul className={styles.cityList} aria-label="Guest home cities">
            {data.guest_cities.map((c) => (
              <li key={c.city} className={styles.cityRow}>
                <span className={styles.cityDot} aria-hidden="true" />
                <span>{c.city}</span>
                <span className={styles.cityBar} aria-hidden="true">
                  <span style={{ width: `${(c.stays / max) * 100}%` }} />
                </span>
                <span className={styles.cityCount}>
                  {count(c.stays)} {c.stays === 1 ? "stay" : "stays"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Seedha Desk ---------- */

export function DeskSection() {
  return (
    <section id="desk" className={styles.section} aria-labelledby="desk-title">
      <div className={`${styles.container} ${styles.split}`}>
        <div>
          <p className={styles.kicker}>Seedha Desk</p>
          <h2 id="desk-title" className={styles.h2}>
            One scan at check-in. One slip at checkout.
          </h2>
          <ol className={styles.deskSteps}>
            <li>The front desk taps the room. The Desk shows a QR code for that one booking.</li>
            <li>The guest scans it and ticks consent on their own phone. Nothing is ticked for them.</li>
            <li>
              The ring turns green. At checkout the slip prints what the hotel kept and a perk code for next
              time.
            </li>
          </ol>
          <div className={styles.ctaRow} style={{ justifyContent: "flex-start" }}>
            <Link href="/demo" className={styles.pillOutline}>
              Try it in the demo
            </Link>
          </div>
        </div>
        <div className={styles.deskStage}>
          <div
            className={styles.device}
            role="img"
            aria-label="Seedha Desk showing Thank you, Neha ji. Consent saved."
          >
            <div className={styles.deviceScreen}>
              <span className={styles.deviceCheck}>✓</span>
              <span className={styles.deviceText}>Thank you, Neha ji</span>
              <span className={styles.deviceSub}>Consent saved · Sample</span>
            </div>
            <div className={styles.ledBar} />
            <div className={styles.slot} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- No website yet ---------- */

export function NoWebsiteBand() {
  return (
    <section className={styles.section} aria-labelledby="site-title">
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.band}`}>
          <p className={styles.kicker}>Seedha Site</p>
          <h2 id="site-title" className={styles.h2}>
            No website yet?
          </h2>
          <p className={styles.lede}>
            Tap Build my site in the app and add 4 to 8 photos and a few lines, typed or spoken in Hindi. Get
            a site with direct booking, packages, a rate card and an agent deck. Nothing goes live until you
            publish. Coming soon: build on WhatsApp.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/h/deodar-view" className={`${styles.pillOutline} ${styles.pillLg}`}>
              See a sample site
            </Link>
            <Link href="/signup" className={`${styles.pill} ${styles.pillLg}`}>
              Build mine
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Trust ---------- */

const TRUST = [
  [
    "Rupees by arithmetic",
    "Every rupee is plain arithmetic on your statement lines. AI never writes a figure.",
  ],
  ["Consent first", "Guests tick consent themselves, unticked by default. Every message says how to stop."],
  [
    "Perks not lower rates",
    "Returning guests get a perk such as free breakfast. Your public rate stays the same.",
  ],
  [
    "Your own data only",
    "Seedha reads the statements you upload. No scraping, and OTA guests are never messaged.",
  ],
  [
    "Every yes provable",
    "Each consent is sealed nightly as a salted fingerprint. No guest data goes into the proof.",
  ],
] as const;

export function Trust() {
  return (
    <section className={styles.section} aria-labelledby="trust-title">
      <div className={styles.container}>
        <h2 id="trust-title" className={styles.h2}>
          Built so you can trust every number.
        </h2>
        <div className={styles.trust}>
          {TRUST.map(([title, body]) => (
            <div key={title} className={styles.trustItem}>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
