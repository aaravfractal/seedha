"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { type CostInputs, myPlacePath, profitTone, signedInr } from "@/lib/myplace";
import type { MyPlace } from "@/lib/types-myplace";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { CalcNote, Chip, SampleChip, Screen, Segmented } from "@/components/owner/ui";
import { CostForm } from "@/components/myplace/CostForm";
import { FloorBars, MonthSummary, RoomTable } from "@/components/myplace/Panels";
import { type ColourMode, RoomMap } from "@/components/myplace/RoomMap";
import s from "@/components/myplace/myplace.module.css";

const TITLE = "My Place";
const SUB = "What each room keeps in a month, and what is left after your costs.";

const MODES: { value: ColourMode; label: string }[] = [
  { value: "profit", label: "Profit" },
  { value: "channel", label: "Channel" },
];

export default function MyPlacePage() {
  const [month, setMonth] = useState("season");
  const [costs, setCosts] = useState<CostInputs>({ costPerNight: null, fixedMonthly: null });
  const [mode, setMode] = useState<ColourMode>("profit");
  const [selected, setSelected] = useState<number | null>(null);
  const place = useApi<MyPlace>(myPlacePath(month, costs));
  const data = place.data;

  if (place.error && !data) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <ErrorState message={place.error.message} code={place.error.code} onRetry={place.reload} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <Loading rows={3} label="Laying out your rooms" />
      </Screen>
    );
  }
  if (!data.available || !data.kpis || !data.summary) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <EmptyState
          title="No rooms to show yet"
          action={
            <Link className="btn small" href="/upload">
              Upload statements
            </Link>
          }
        >
          {data.reason ?? "No statement rows yet"}. My Place uses your channel mix and what each channel left
          you per room night.
        </EmptyState>
      </Screen>
    );
  }

  const { kpis, summary } = data;
  const sampleCosts =
    data.inputs.cost_per_night_source === "sample" || data.inputs.fixed_monthly_source === "sample";
  const breakEven =
    kpis.break_even_rooms === null
      ? "Not reached"
      : kpis.break_even_rooms > kpis.rooms_count
        ? `${kpis.break_even_rooms} rooms`
        : `${kpis.break_even_rooms} of ${kpis.rooms_count}`;
  const breakEvenNote =
    kpis.break_even_rooms === null
      ? "Rooms do not cover their nightly cost at these figures"
      : kpis.break_even_rooms > kpis.rooms_count
        ? "More rooms than you have, at this occupancy"
        : "Rooms needed to cover fixed costs";

  return (
    <Screen title={TITLE} sub={SUB}>
      <div className={s.labels}>
        <Chip tone="ok">Illustration</Chip>
        {data.is_sample || sampleCosts ? <SampleChip /> : null}
        <span className={s.kpiNote}>{data.label}</span>
        <label className={s.monthField}>
          Month
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setSelected(null);
            }}
          >
            {data.months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={s.kpis} aria-busy={place.loading}>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>Net kept per month</span>
          <b className={s.kpiValue}>{inr(kpis.net_kept)}</b>
          <span className={s.kpiNote}>After commission, GST and fees</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>Profit</span>
          <b className={`${s.kpiValue} ${s[profitTone(kpis.profit)] ?? ""}`}>{signedInr(kpis.profit)}</b>
          <span className={s.kpiNote}>After room and fixed costs</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>Rooms in profit</span>
          <b className={s.kpiValue}>
            {kpis.rooms_in_profit} of {kpis.rooms_count}
          </b>
          <span className={s.kpiNote}>Each room carries an equal share of fixed costs</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>Break-even rooms</span>
          <b className={s.kpiValue}>{breakEven}</b>
          <span className={s.kpiNote}>{breakEvenNote}</span>
        </div>
      </div>

      <div className={s.cols}>
        <section className={s.card} aria-labelledby="mp-map-title">
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle} id="mp-map-title">
                Your rooms
              </h2>
              <p className={s.cardSub}>Tap a room for its month.</p>
            </div>
            <div className={s.modeSwitch}>
              <Segmented options={MODES} value={mode} onChange={setMode} label="Colour rooms by" />
            </div>
          </div>
          <RoomMap
            rooms={data.rooms}
            floors={data.floors}
            channels={data.channels}
            mode={mode}
            selected={selected}
            onSelect={setSelected}
          />
          <p className={s.soon}>
            <span>
              <b>3D view coming soon.</b> The same rooms and figures as a miniature hotel. This 2D map shows
              everything the 3D view will.
            </span>
          </p>
        </section>

        <div className={s.side}>
          <section className={s.card} aria-labelledby="mp-sum-title">
            <div className={s.cardHead}>
              <h2 className={s.cardTitle} id="mp-sum-title">
                Month summary
              </h2>
            </div>
            <MonthSummary
              month={data.month}
              summary={summary}
              channels={data.channels}
              rooms={kpis.rooms_count}
            />
          </section>
          <section className={s.card} aria-labelledby="mp-floor-title">
            <div className={s.cardHead}>
              <h2 className={s.cardTitle} id="mp-floor-title">
                Profit by floor
              </h2>
            </div>
            <FloorBars floors={data.floors} />
          </section>
          <section className={s.card} aria-labelledby="mp-cost-title">
            <div className={s.cardHead}>
              <h2 className={s.cardTitle} id="mp-cost-title">
                Your costs
              </h2>
            </div>
            {data.sample_note ? (
              <p className={s.cardSub} style={{ margin: "0 0 12px" }}>
                {data.sample_note}
              </p>
            ) : null}
            <CostForm
              key={`${data.inputs.cost_per_night}-${data.inputs.fixed_monthly}-${data.inputs.cost_per_night_source}-${data.inputs.fixed_monthly_source}`}
              inputs={data.inputs}
              busy={place.loading}
              onApply={(next) => {
                if (myPlacePath(month, next) === myPlacePath(month, costs)) place.reload();
                else setCosts(next);
              }}
            />
          </section>
        </div>
      </div>

      <section className={s.card} style={{ marginTop: 16 }} aria-labelledby="mp-table-title">
        <div className={s.cardHead}>
          <div>
            <h2 className={s.cardTitle} id="mp-table-title">
              Room by room
            </h2>
            <p className={s.cardSub}>Tap a column to sort. The selected room is marked on the map too.</p>
          </div>
        </div>
        <RoomTable rooms={data.rooms} selected={selected} onSelect={setSelected} />
      </section>

      <CalcNote>
        Illustration: each room gets a main channel in proportion to your statements mix, sells{" "}
        {summary.nights_per_room} nights (30 × occupancy) and keeps that channel&apos;s net per room night.
        Statements do not say which room a guest slept in.
        {sampleCosts ? " Costs marked Sample are sample figures until you enter your own." : ""}
      </CalcNote>
    </Screen>
  );
}
