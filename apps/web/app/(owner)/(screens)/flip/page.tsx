"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { postJson, useApi } from "@/lib/api";
import { count, inr, pctTenths } from "@/lib/format";
import type { Ledger, LedgerChannel } from "@/lib/types";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { CalcNote, Screen, Segmented, ui } from "@/components/owner/ui";
import { useReducedMotion } from "@/components/owner/motion";
import f from "./flip.module.css";

type Sort = "bookings" | "kept";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FLIP_MS = 700;
const ROW_GAP = 10;
const CHANNEL_COLOUR: Record<string, string> = {
  mmt: "var(--ch-mmt)",
  bcom: "var(--ch-bcom)",
  agoda: "var(--ch-agoda)",
  ta: "var(--ch-agent)",
  walkin: "var(--ch-walkin)",
  direct: "var(--ch-direct)",
};

/** "Apr to Sep 2026" from ISO dates. */
function rangeLabel(start: string, end: string): string {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const s = MONTHS[(sm ?? 1) - 1];
  const e = MONTHS[(em ?? 1) - 1];
  return sy === ey ? `${s} to ${e} ${ey}` : `${s} ${sy} to ${e} ${ey}`;
}

/** "−₹9,07,358" for a cost, "₹0" when there is none. */
function minus(paise: number): string {
  return paise ? `−${inr(paise)}` : inr(0);
}

export default function FlipPage() {
  const ledger = useApi<Ledger>("ledger/channels");
  const toast = useToast();
  const reduced = useReducedMotion();
  const [sort, setSort] = useState<Sort>("bookings");
  const [hindi, setHindi] = useState(true);
  const seen = useRef(false);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const shownRank = useRef(new Map<string, number>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = ledger.data;
  const hasData = (data?.totals.room_nights ?? 0) > 0;

  useEffect(() => {
    if (hasData && !seen.current) {
      seen.current = true;
      void postJson("pipeline/flip/seen").catch(() => undefined);
    }
  }, [hasData]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const ordered = useMemo(() => {
    if (!data) return [];
    const byKey = new Map(data.channels.map((c) => [c.key, c]));
    const order = sort === "bookings" ? data.rank_by_bookings : data.rank_by_money_kept;
    return order.map((k) => byKey.get(k)).filter((c): c is LedgerChannel => c !== undefined);
  }, [data, sort]);

  // Each row glides from its old slot to its new one. The DOM order follows
  // the rank too, so screen readers and tests read the list in rank order.
  useLayoutEffect(() => {
    const previous = shownRank.current;
    const next = new Map(ordered.map((c, i) => [c.key, i]));
    shownRank.current = next;
    if (reduced || previous.size === 0) return;
    rowRefs.current.forEach((el, key) => {
      const from = previous.get(key);
      const to = next.get(key);
      if (from === undefined || to === undefined || from === to) return;
      const step = el.offsetHeight + ROW_GAP;
      el.animate(
        [{ transform: `translateY(${from * step}px)` }, { transform: `translateY(${to * step}px)` }],
        { duration: FLIP_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
  }, [ordered, reduced]);

  function changeSort(next: Sort) {
    if (next === sort || !data) return;
    setSort(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const move = data.insight?.move_en;
    if (next === "kept" && move) toastTimer.current = setTimeout(() => toast(move), FLIP_MS);
  }

  if (ledger.error) {
    return (
      <Screen title="Bookings are not money.">
        <ErrorState message={ledger.error.message} code={ledger.error.code} onRetry={ledger.reload} />
      </Screen>
    );
  }
  if (ledger.loading && !data) {
    return (
      <Screen title="Bookings are not money.">
        <Loading rows={6} label="Working out what each channel left you" />
      </Screen>
    );
  }
  if (!data || !hasData) {
    return (
      <Screen title="Bookings are not money.">
        <EmptyState
          title="No statements yet"
          action={
            <Link className="btn small" href="/upload">
              Upload statements
            </Link>
          }
        >
          Upload your payouts to see what each channel leaves you.
        </EmptyState>
      </Screen>
    );
  }

  const topKey = data.rank_by_bookings[0];
  const period = rangeLabel(data.start, data.end);
  const direct = data.channels.find((c) => c.kind === "direct" && c.room_nights > 0) ?? null;
  const valueLabel = sort === "bookings" ? "Room nights" : "Net ADR";

  return (
    <Screen title="Bookings are not money.">
      {data.insight ? (
        <div className={f.insightRow}>
          <p className={f.insight} lang={hindi ? "hi-Latn" : "en"} aria-live="polite">
            {hindi ? data.insight.hi : data.insight.en}
          </p>
          <button type="button" className={ui.linkBtn} onClick={() => setHindi(!hindi)}>
            {hindi ? "Show in English" : "Hindi mein dikhao"}
          </button>
        </div>
      ) : null}

      <div className={f.controls}>
        <Segmented<Sort>
          label="Rank channels by"
          markerClass="toggle"
          value={sort}
          onChange={changeSort}
          options={[
            { value: "bookings", label: "By bookings" },
            { value: "kept", label: "By money kept" },
          ]}
        />
        <span className={f.period}>
          {period} · {count(data.totals.room_nights)} room nights
        </span>
      </div>

      <div className={f.colHead} aria-hidden="true">
        <span>#</span>
        <span>Channel</span>
        <span className={f.barHead}>Kept and lost vs list price</span>
        <span className={f.right}>{valueLabel}</span>
      </div>
      <ol
        className={f.list}
        style={{ "--n": ordered.length } as CSSProperties}
        aria-label={sort === "bookings" ? "Channels by room nights" : "Channels by money kept per room night"}
      >
        {ordered.map((c, i) => (
          <ChannelRow
            key={c.key}
            channel={c}
            rank={i}
            mode={sort}
            ringed={sort === "kept" && c.key === topKey}
            refCallback={(el) => {
              if (el) rowRefs.current.set(c.key, el);
              else rowRefs.current.delete(c.key);
            }}
          />
        ))}
      </ol>

      <details className={f.maths}>
        <summary>Show the maths for each channel</summary>
        <div className={f.tableWrap}>
          <table className={f.table}>
            <caption className="sr-only-text">Line items per channel, {period}</caption>
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">List revenue</th>
                <th scope="col">Discount</th>
                <th scope="col">Commission</th>
                <th scope="col">GST on commission</th>
                <th scope="col">Fees</th>
                <th scope="col">Net kept</th>
                <th scope="col">Net ADR</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c) => (
                <tr key={c.key}>
                  <th scope="row">{c.name}</th>
                  <td>{inr(c.list_revenue)}</td>
                  <td>{minus(c.discount)}</td>
                  <td>{minus(c.commission)}</td>
                  <td>{minus(c.gst_on_commission)}</td>
                  <td>{minus(c.fees)}</td>
                  <td>{inr(c.net_kept)}</td>
                  <td>{c.net_adr !== null ? inr(c.net_adr) : "None sold"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className={`${ui.tiles} ${ui.quad} ${f.stats}`}>
        <div className={ui.tile}>
          <b className={`${ui.value} ${ui.loss}`}>{inr(data.totals.paid_to_channels)}</b>
          <span className={ui.label}>Paid to channels</span>
          <span className={ui.note}>
            {data.paid_to_channels_share_tenths !== null
              ? `${pctTenths(data.paid_to_channels_share_tenths)} of list revenue`
              : "No list revenue yet"}
          </span>
        </div>
        <div className={ui.tile}>
          <b className={ui.value}>{inr(data.totals.net_kept)}</b>
          <span className={ui.label}>Net kept</span>
          <span className={ui.note}>Lost vs list price {minus(data.totals.lost_vs_list_price)}</span>
        </div>
        <div className={ui.tile}>
          <b className={ui.value}>
            {data.direct_bookings_tenths !== null ? pctTenths(data.direct_bookings_tenths) : "None yet"}
          </b>
          <span className={ui.label}>Direct bookings</span>
          <span className={ui.note}>
            Commission-free share{" "}
            {data.commission_free_share_tenths !== null
              ? pctTenths(data.commission_free_share_tenths)
              : "none yet"}
          </span>
        </div>
        <div className={ui.tile}>
          <b className={ui.value}>{inr(data.revpar_net)}</b>
          <span className={ui.label}>Net RevPAR</span>
          <span className={ui.note}>List RevPAR {inr(data.revpar_list)}</span>
        </div>
      </div>
      <CalcNote>
        {count(data.counted_rows)} rows for {period}
        {data.excluded_rows ? `, ${count(data.excluded_rows)} kept out until you review them` : ""}. Net kept
        = list revenue − hotel-funded discount − commission − GST on commission − payment fees. TDS is a tax
        credit, so it is never counted as a cost.
      </CalcNote>

      {direct ? <DirectCard direct={direct} /> : null}
    </Screen>
  );
}

function ChannelRow({
  channel: c,
  rank,
  mode,
  ringed,
  refCallback,
}: {
  channel: LedgerChannel;
  rank: number;
  mode: Sort;
  ringed: boolean;
  refCallback: (el: HTMLLIElement | null) => void;
}) {
  const keptPct = c.kept_share_tenths !== null ? c.kept_share_tenths / 10 : 0;
  const lost = c.lost_vs_list_price;
  const value =
    mode === "bookings" ? count(c.room_nights) : c.net_adr !== null ? inr(c.net_adr) : "None sold";
  const caption =
    mode === "bookings" ? `room nights · ${inr(c.list_revenue)} list` : "net ADR, kept per room";
  return (
    <li
      ref={refCallback}
      className={`row ${f.r}${ringed ? ` ${f.ringed}` : ""}`}
      style={{ "--rank": rank } as CSSProperties}
      data-k={c.key}
    >
      <span className={f.rankNo} aria-label={`Rank ${rank + 1}`}>
        {rank + 1}
      </span>
      <div className={f.nameCell}>
        <div className={f.name}>
          <i
            className={f.swatch}
            style={{ background: CHANNEL_COLOUR[c.key] ?? "var(--ch-agoda)" }}
            aria-hidden="true"
          />
          <span className="nm">{c.name}</span>
        </div>
        <div className={`${f.lost}${lost ? "" : ` ${f.none}`}`}>{minus(lost)} lost vs list price</div>
      </div>
      <div className={f.barCell}>
        <div className={f.bar} aria-hidden="true">
          <i className={f.kept} style={{ width: `${keptPct}%` }} />
          <i className={f.away} style={{ width: `${100 - keptPct}%` }} />
        </div>
        <span className={f.barNote}>
          {c.kept_share_tenths !== null ? `${pctTenths(c.kept_share_tenths)} kept` : "No sales"}
        </span>
      </div>
      <div className={f.valueCell}>
        <b className={f.value}>{value}</b>
        <span className={f.valueCap}>{caption}</span>
        <span className="sr-only-text">{mode === "bookings" ? " room nights" : " kept per room night"}</span>
      </div>
    </li>
  );
}

function DirectCard({ direct }: { direct: LedgerChannel }) {
  const keptPct = direct.list_revenue ? Math.max(0, (direct.net_kept / direct.list_revenue) * 100) : 0;
  return (
    <div className={`${ui.card} ${f.directCard}`}>
      <h2 className={ui.sectionTitle}>Direct keeps almost everything.</h2>
      <p className={ui.sub}>Before and after costs on your direct bookings. Only the UPI fee comes off.</p>
      <div className={f.compare}>
        <div className={f.compareRow}>
          <span className={f.compareLabel}>Before · list price</span>
          <span className={f.track} aria-hidden="true">
            <i className={f.fillList} style={{ width: "100%" }} />
          </span>
          <span className={f.compareValue}>{inr(direct.list_revenue)}</span>
        </div>
        <div className={f.compareRow}>
          <span className={f.compareLabel}>After · kept</span>
          <span className={f.track} aria-hidden="true">
            <i className={f.fillKept} style={{ width: `${keptPct}%` }} />
          </span>
          <span className={f.compareValue}>{inr(direct.net_kept)}</span>
        </div>
      </div>
      <CalcNote>
        {count(direct.room_nights)} direct room nights, fees {minus(direct.fees)}.
      </CalcNote>
      <p className={f.build}>
        <Link className={ui.linkBtn} href="/site">
          No website means few direct guests. Build one ›
        </Link>
      </p>
    </div>
  );
}
