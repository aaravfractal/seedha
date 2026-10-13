"use client";

import { useApi } from "@/lib/api";
import { SCAN_LABELS, dayName, monthName, scanBars } from "@/lib/siteDetails";
import type { ScanCard, SiteScans } from "@/lib/types-site-v2-owner";
import { ErrorState, Loading } from "@/components/States";
import c from "./cards.module.css";

const CARDS: readonly ScanCard[] = ["wallet", "room", "desk"];

/** "Card scans this month": counts only (no cookies, IP or device data), by the hotel's calendar. */
export function ScansPanel() {
  const scans = useApi<SiteScans>("site/scans");
  const s = scans.data;
  const bars = s ? scanBars(s.by_day) : [];
  return (
    <section className={c.section} aria-labelledby="scans-title">
      <div className={c.sectionHead}>
        <h3 id="scans-title" className={c.title}>
          Card scans this month
        </h3>
        {s ? <span className={c.hint}>{monthName(s.month)}</span> : null}
      </div>
      {scans.error && !s ? (
        <ErrorState message={scans.error.message} code={scans.error.code} onRetry={scans.reload} />
      ) : !s ? (
        <Loading rows={1} label="Loading card scans" />
      ) : s.total === 0 ? (
        <p className={c.empty}>
          No scans yet this month. When a guest scans the QR on a printed card, it is counted here.
        </p>
      ) : (
        <>
          <p className={c.total}>
            {s.total}
            <span className={c.hint} style={{ display: "block", marginTop: 6, letterSpacing: 0 }}>
              {s.total === 1 ? "scan" : "scans"} in total
            </span>
          </p>
          <dl className={c.byCard}>
            {CARDS.map((card) => (
              <div key={card}>
                <dt>{SCAN_LABELS[card]}</dt>
                <dd>{s.by_card[card] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <ul className={c.days} aria-label="Scans per day">
            {bars.map((b) => (
              <li key={b.day}>
                <span>{dayName(b.day)}</span>
                <span className={c.bar} aria-hidden="true">
                  <i style={{ width: `${b.percent}%` }} />
                </span>
                <span>{b.total}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={c.hint}>
        Only a count per card per day. No cookies, IP addresses or phone details are kept.
      </p>
    </section>
  );
}
