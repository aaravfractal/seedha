"use client";

import Link from "next/link";
import { useMemo } from "react";
import { longDate } from "@/lib/format";
import { StepTracker } from "@/components/StepTracker";
import { ReadinessCard } from "@/components/owner/ReadinessCard";
import { ErrorState } from "@/components/States";
import { useShell } from "@/components/shell/ShellData";
import { ChannelMix, InsightBanner, KpiTiles, LastNight, NeedsYou, Waterfall } from "./parts";
import styles from "./overview.module.css";

/** Overview (Home): every figure comes from GET /overview. */
export default function OverviewPage() {
  const { data, error, loading, reload } = useShell("/home");
  const done = useMemo(
    () => new Set((data?.checklist.steps ?? []).filter((s) => s.done).map((s) => s.key)),
    [data],
  );

  if (!data) {
    if (error) return <ErrorState message={error.message} code={error.code} onRetry={reload} />;
    return (
      <div role="status" aria-live="polite" aria-busy={loading} className={styles.stack}>
        <span className="sr-only-text">Loading your overview</span>
        <div className="skeleton" style={{ height: 96 }} />
        <div className="skeleton" style={{ height: 88, borderRadius: 28 }} />
        <div className={styles.tiles}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 150, borderRadius: 24 }} />
          ))}
        </div>
      </div>
    );
  }

  const allDone = data.checklist.done_count >= data.checklist.total;
  return (
    <div className={styles.stack}>
      <div className={styles.hello}>
        <div>
          <p className={styles.date}>{longDate(data.business_date)}</p>
          <h1 className={styles.h1}>Namaste, {data.owner.short_name} ji.</h1>
        </div>
        {data.has_statements ? (
          <Link href="/flip" className="btn">
            See the flip
          </Link>
        ) : null}
      </div>

      {data.has_statements && data.kpis ? (
        <>
          {data.insight ? <InsightBanner insight={data.insight} /> : null}
          <KpiTiles kpis={data.kpis} savings={data.savings} period={data.period} />
          <ReadinessCard
            inputs={{
              directTenths: data.kpis.direct_bookings_tenths,
              freeTenths: data.kpis.commission_free_share_tenths,
              codedBookings: data.savings.count,
            }}
          />
        </>
      ) : (
        <section className={styles.empty} aria-labelledby="start-title">
          <h2 id="start-title" className={styles.cardTitle}>
            Start with your statements
          </h2>
          <p className={styles.cardSub}>
            Add your MakeMyTrip, Booking.com and Agoda payouts with your hotel register. Seedha works out what
            each channel really leaves you.
          </p>
          <Link href="/upload" className="btn">
            Upload statements
          </Link>
        </section>
      )}

      {allDone ? null : <StepTracker done={done} />}

      {data.has_statements && data.kpis ? (
        <>
          <Waterfall steps={data.waterfall} period={data.period} />
          <ChannelMix mix={data.channel_mix} kpis={data.kpis} />
        </>
      ) : null}
      <LastNight night={data.last_night} />
      <NeedsYou items={data.needs_you} />
    </div>
  );
}
