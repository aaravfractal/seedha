"use client";

import { inr, pctTenths } from "@/lib/format";
import type { Sample } from "@/lib/types-website";
import { useCountUp, useSeenOnce } from "./hooks";
import styles from "./site.module.css";

type Metric = { target: number; format: (n: number) => string; label: string; sub: string };

/** Paise to whole rupees for counting (the figure is whole rupees already). */
const rupees = (paise: number) => Math.round(paise / 100);

function Counter({ metric, active }: { metric: Metric; active: boolean }) {
  const value = useCountUp(metric.target, active);
  return (
    <div className={styles.metric}>
      <div className={`${styles.metricValue} ${styles.money}`}>
        <span aria-hidden="true">{metric.format(value)}</span>
        <span className={styles.srOnly}>{metric.format(metric.target)}</span>
      </div>
      <div className={styles.metricLabel}>{metric.label}</div>
      <div className={styles.metricSub}>{metric.sub}</div>
    </div>
  );
}

/** Four headline figures that count up when first visible (D14). */
export function Metrics({ data }: { data: Sample }) {
  const [ref, seen] = useSeenOnce<HTMLDivElement>();
  const metrics: Metric[] = [
    {
      target: rupees(data.paid_to_channels),
      format: (n) => inr(n * 100),
      label: "Paid to channels",
      sub: "Commission, GST on commission and fees",
    },
    {
      target: data.paid_to_channels_share_tenths ?? 0,
      format: pctTenths,
      label: "Of list revenue",
      sub: "Lost to channel cost",
    },
    {
      target: rupees(data.paid_twice),
      format: (n) => inr(n * 100),
      label: "Commission paid twice",
      sub: `${data.repeat_guests} guests who came back through an OTA`,
    },
  ];
  if (data.saturday) {
    const s = data.saturday;
    metrics.push({
      target: rupees(s.extra_per_saturday),
      format: (n) => `+${inr(n * 100)}`,
      label: "Extra per Saturday",
      sub: `Hold ${s.rooms} rooms off ${s.channel_name} if they sell direct`,
    });
  }
  return (
    <section className={styles.section} aria-labelledby="metrics-title">
      <div className={styles.container}>
        <h2 id="metrics-title" className={styles.h2} style={{ maxWidth: "22ch" }}>
          Six months. One {data.rooms_count}-room hotel. Every rupee accounted for.
        </h2>
        <div ref={ref} className={styles.metrics}>
          {metrics.map((m) => (
            <Counter key={m.label} metric={m} active={seen} />
          ))}
        </div>
        <p className={styles.footnote}>
          Calculated from sample statements for {data.hotel}. All data is fictional.
        </p>
      </div>
    </section>
  );
}
