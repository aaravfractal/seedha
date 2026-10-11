"use client";

import Link from "next/link";
import { useState } from "react";
import { count, inr, pctTenths } from "@/lib/format";
import { channelColour } from "@/lib/channels";
import { compactInr, monthRange, wholePct } from "@/lib/format";
import type { Overview, OverviewItem, OverviewKpis } from "@/lib/types-overview";
import { RoomBoard } from "@/components/owner/RoomBoard";
import { Icon } from "@/components/shell/Icons";
import type { IconName } from "@/components/shell/Icons";
import styles from "./overview.module.css";

const colour = channelColour;

const share = (tenths: number | null) => (tenths === null ? "0.0%" : pctTenths(tenths));

/** Dark insight banner with the HI / EN switch. Hindi is Roman-script Hinglish. */
export function InsightBanner({ insight }: { insight: { en: string; hi: string } }) {
  const [lang, setLang] = useState<"hi" | "en">("hi");
  return (
    <div className={styles.insight}>
      <span className={styles.sparkle} aria-hidden="true">
        <Icon name="sparkle" size={22} />
      </span>
      <p aria-live="polite" lang={lang === "hi" ? "hi-Latn" : "en"}>
        {lang === "hi" ? insight.hi : insight.en}
      </p>
      <button type="button" onClick={() => setLang(lang === "hi" ? "en" : "hi")}>
        {lang === "hi" ? "Show in English" : "Hindi mein dekhein"}
      </button>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "gain" | "loss" | "gold";
}) {
  return (
    <div className={`${styles.tile} ${tone === "gold" ? styles.gold : ""}`}>
      <span className={styles.tileLabel}>{label}</span>
      <b
        className={`${styles.tileValue} ${tone === "gain" ? styles.gain : tone === "loss" ? styles.loss : ""}`}
      >
        {value}
      </b>
      <span className={styles.tileSub}>{sub}</span>
    </div>
  );
}

/** The six KPI tiles and the "Calculated from your statements" line. */
export function KpiTiles({
  kpis,
  savings,
  period,
}: {
  kpis: OverviewKpis;
  savings: Overview["savings"];
  period: Overview["period"];
}) {
  const coded =
    savings.count === 0
      ? "No coded direct bookings yet"
      : `${count(savings.count)} coded direct booking${savings.count === 1 ? "" : "s"}`;
  return (
    <>
      <div className={styles.tiles}>
        <Tile
          label="Net kept"
          value={`${kpis.net_kept > 0 ? "+" : ""}${inr(kpis.net_kept)}`}
          sub={`${pctTenths(kpis.net_kept_share_tenths)} of ${inr(kpis.list_revenue)} list revenue`}
          tone="gain"
        />
        <Tile label="Net ADR" value={inr(kpis.net_adr)} sub={`List ADR ${inr(kpis.list_adr)}`} />
        <Tile label="Net RevPAR" value={inr(kpis.revpar_net)} sub={`List RevPAR ${inr(kpis.revpar_list)}`} />
        <Tile
          label="Paid to channels"
          value={inr(-kpis.paid_to_channels)}
          sub={`${share(kpis.paid_to_channels_share_tenths)} of list revenue`}
          tone="loss"
        />
        <Tile
          label="Commission-free share"
          value={share(kpis.commission_free_share_tenths)}
          sub={`Direct bookings ${share(kpis.direct_bookings_tenths)}`}
        />
        <Tile label="Saved with codes" value={inr(savings.total_net_saving)} sub={coded} tone="gold" />
      </div>
      <p className={styles.calc}>
        Calculated from your statements · {monthRange(period.start, period.end)} · {count(period.days)} days ·{" "}
        {count(period.available_room_nights)} available room nights
      </p>
    </>
  );
}

type Bar = {
  key: string;
  label: string;
  amount: number;
  low: number;
  high: number;
  kind: "list" | "drop" | "net";
};

/** Bar extents in paise: list revenue from zero, each drop hanging from the
 * running total, net kept from zero (it equals what is left). */
function waterfallBars(steps: Overview["waterfall"]): Bar[] {
  const list = steps[0]?.amount ?? 0;
  const drops = steps.slice(1, -1);
  const tops = drops.map((_, i) => list + drops.slice(0, i).reduce((sum, d) => sum + d.amount, 0));
  const net = steps.at(-1);
  return [
    ...(steps[0] ? [{ ...steps[0], low: 0, high: list, kind: "list" as const }] : []),
    ...drops.map((d, i) => ({
      ...d,
      low: (tops[i] ?? 0) + d.amount,
      high: tops[i] ?? 0,
      kind: "drop" as const,
    })),
    ...(net && steps.length > 1 ? [{ ...net, low: 0, high: net.amount, kind: "net" as const }] : []),
  ];
}

const BAR_TONE = { list: styles.barList, drop: styles.barDrop, net: styles.barNet };
const BAR_TEXT = { list: "", drop: styles.loss, net: styles.gain };

/** "Where ₹63,05,000 went": list revenue down to net kept. */
export function Waterfall({ steps, period }: { steps: Overview["waterfall"]; period: Overview["period"] }) {
  const list = steps[0]?.amount ?? 0;
  if (list <= 0) return null;
  const bars = waterfallBars(steps);
  return (
    <section className={styles.card} aria-labelledby="where-title">
      <h2 id="where-title" className={styles.cardTitle}>
        Where {inr(list)} went
      </h2>
      <p className={styles.cardSub}>List revenue to net kept, {monthRange(period.start, period.end)}</p>
      <ol className={styles.fall}>
        {bars.map((b) => (
          <li key={b.key}>
            <span className={styles.fallPlot} aria-hidden="true">
              <i
                className={BAR_TONE[b.kind]}
                style={{ bottom: `${(b.low / list) * 100}%`, height: `${((b.high - b.low) / list) * 100}%` }}
              />
            </span>
            <b className={`${styles.fallValue} ${BAR_TEXT[b.kind]}`}>
              <span aria-hidden="true">{compactInr(b.amount)}</span>
              <span className="sr-only-text">{inr(b.amount)}</span>
            </b>
            <span className={styles.fallLabel}>{b.label}</span>
          </li>
        ))}
      </ol>
      <p className={styles.calc}>Calculated from your statements. TDS is a tax credit and is not counted.</p>
    </section>
  );
}

/** Channel mix donut (room nights) with occupancy in the centre. */
export function ChannelMix({ mix, kpis }: { mix: Overview["channel_mix"]; kpis: OverviewKpis }) {
  const total = mix.reduce((sum, m) => sum + m.room_nights, 0);
  const r = 80;
  const c = 2 * Math.PI * r;
  const shown = mix.filter((m) => m.room_nights > 0);
  const lengths = shown.map((m) => (total ? (m.room_nights / total) * c : 0));
  const arcs = shown.map((m, i) => {
    const len = lengths[i] ?? 0;
    const start = lengths.slice(0, i).reduce((sum, l) => sum + l, 0);
    return { key: m.key, dash: `${len} ${c - len}`, offset: -start };
  });
  return (
    <section className={styles.card} aria-labelledby="mix-title">
      <h2 id="mix-title" className={styles.cardTitle}>
        Channel mix
      </h2>
      <p className={styles.cardSub}>Share of {count(total)} room nights</p>
      <div className={styles.mix}>
        <div className={styles.donut}>
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <g transform="rotate(-90 100 100)">
              {arcs.map((a) => (
                <circle
                  key={a.key}
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  stroke={colour(a.key)}
                  strokeWidth="34"
                  strokeDasharray={a.dash}
                  strokeDashoffset={a.offset}
                />
              ))}
            </g>
          </svg>
          <span className={styles.donutCentre}>
            <b>{wholePct(kpis.occupancy_tenths)}</b>
            <span>occupancy</span>
          </span>
        </div>
        <table className={styles.legend}>
          <caption className="sr-only-text">
            Room nights by channel. Occupancy {wholePct(kpis.occupancy_tenths)}.
          </caption>
          <thead className="sr-only-text">
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Room nights</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {mix.map((m) => (
              <tr key={m.key}>
                <th scope="row">
                  <i style={{ background: colour(m.key) }} aria-hidden="true" />
                  {m.name}
                </th>
                <td className={styles.legendCount}>{count(m.room_nights)}</td>
                <td className={styles.legendShare}>{pctTenths(m.share_tenths)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Last night's rooms and the six nights before, as a room board (POLISH_BUILD A). */
export function LastNight({ night }: { night: Overview["last_night"] }) {
  return <RoomBoard fallback={night} />;
}

/** Things only the owner can do, each linking to its screen. */
export function NeedsYou({ items }: { items: OverviewItem[] }) {
  return (
    <section className={styles.card} aria-labelledby="needs-title">
      <h2 id="needs-title" className={styles.cardTitle}>
        Needs you
      </h2>
      {items.length === 0 ? (
        <p className={styles.cardSub}>Nothing waits for you right now.</p>
      ) : (
        <ul className={styles.needs}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className={styles.need}>
                <span className={`${styles.needTile} ${item.id === "approvals" ? styles.needTileOk : ""}`}>
                  <Icon name={item.icon as IconName} size={20} />
                </span>
                <span className={styles.needText}>
                  <b>
                    {item.title}
                    {item.amount !== null ? (
                      <>
                        : <span className={styles.gain}>+{inr(item.amount)}</span>
                      </>
                    ) : null}
                  </b>
                  <span>{item.detail}</span>
                </span>
                <span className={styles.chev} aria-hidden="true">
                  <Icon name="chevron" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
