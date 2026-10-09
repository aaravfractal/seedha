"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { postJson, useApi } from "@/lib/api";
import { count, inr, pctTenths } from "@/lib/format";
import type { Ledger, LedgerChannel } from "@/lib/types";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";

type Sort = "bookings" | "kept";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Apr to Sep 2026" from ISO dates. */
function rangeLabel(start: string, end: string): string {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const s = MONTHS[(sm ?? 1) - 1];
  const e = MONTHS[(em ?? 1) - 1];
  return sy === ey ? `${s} to ${e} ${ey}` : `${s} ${sy} to ${e} ${ey}`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function FlipPage() {
  const ledger = useApi<Ledger>("ledger/channels");
  const toast = useToast();
  const [sort, setSort] = useState<Sort>("bookings");
  const [hindi, setHindi] = useState(true);
  const seen = useRef(false);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const before = useRef(new Map<string, number>());

  const data = ledger.data;
  const hasData = (data?.totals.room_nights ?? 0) > 0;

  useEffect(() => {
    if (hasData && !seen.current) {
      seen.current = true;
      void postJson("pipeline/flip/seen").catch(() => undefined);
    }
  }, [hasData]);

  const ordered = useMemo(() => {
    if (!data) return [];
    const byKey = new Map(data.channels.map((c) => [c.key, c]));
    const order = sort === "bookings" ? data.rank_by_bookings : data.rank_by_money_kept;
    return order.map((k) => byKey.get(k)).filter((c): c is LedgerChannel => c !== undefined);
  }, [data, sort]);

  // FLIP: remember where each row was, re-order, then animate from old to new.
  useLayoutEffect(() => {
    const previous = before.current;
    if (previous.size === 0) return;
    before.current = new Map();
    if (prefersReducedMotion()) return;
    rowRefs.current.forEach((el, key) => {
      const top = previous.get(key);
      if (top === undefined) return;
      const dy = top - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], {
        duration: 700,
        easing: "cubic-bezier(.22,1,.36,1)",
      });
    });
  }, [sort]);

  function changeSort(next: Sort) {
    if (next === sort || !data) return;
    const tops = new Map<string, number>();
    rowRefs.current.forEach((el, key) => tops.set(key, el.getBoundingClientRect().top));
    before.current = tops;
    setSort(next);
    if (next === "kept" && data.insight?.move_en) toast(data.insight.move_en);
  }

  if (ledger.error) {
    return (
      <>
        <h2 className="title">Bookings are not money.</h2>
        <ErrorState message={ledger.error.message} code={ledger.error.code} onRetry={ledger.reload} />
      </>
    );
  }
  if (ledger.loading && !data) {
    return (
      <>
        <h2 className="title">Bookings are not money.</h2>
        <Loading rows={6} label="Working out what each channel left you" />
      </>
    );
  }
  if (!data || !hasData) {
    return (
      <>
        <h2 className="title">Bookings are not money.</h2>
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
      </>
    );
  }

  const topKey = data.rank_by_bookings[0];
  const period = rangeLabel(data.start, data.end);

  return (
    <>
      <h2 className="title">Bookings are not money.</h2>
      {data.insight ? (
        <>
          <p className="insight" lang={hindi ? "hi-Latn" : "en"} aria-live="polite">
            {hindi ? data.insight.hi : data.insight.en}
          </p>
          <button
            type="button"
            className="link"
            style={{ fontSize: 14, marginBottom: 12 }}
            onClick={() => setHindi(!hindi)}
          >
            {hindi ? "Show in English" : "Hindi mein dikhao"}
          </button>
          <br />
        </>
      ) : null}
      <div className="toggle" role="group" aria-label="Rank channels by">
        <button type="button" aria-pressed={sort === "bookings"} onClick={() => changeSort("bookings")}>
          By bookings
        </button>
        <button type="button" aria-pressed={sort === "kept"} onClick={() => changeSort("kept")}>
          By money kept
        </button>
      </div>

      <ol
        className="rows"
        aria-label={sort === "bookings" ? "Channels by room nights" : "Channels by money kept per room"}
      >
        {ordered.map((c, i) => (
          <ChannelRow
            key={c.key}
            channel={c}
            rank={i + 1}
            highlight={sort === "kept" && c.key === topKey}
            refCallback={(el) => {
              if (el) rowRefs.current.set(c.key, el);
              else rowRefs.current.delete(c.key);
            }}
          />
        ))}
      </ol>

      <div className="stats">
        <div className="stat">
          <b className="num" style={{ color: "var(--loss)" }}>
            {inr(data.totals.paid_to_channels)}
          </b>
          <span>paid to channels, {period}</span>
          <small>Lost vs list price {inr(data.totals.lost_vs_list_price)}</small>
        </div>
        <div className="stat">
          <b className="num">
            {data.paid_to_channels_share_tenths !== null
              ? pctTenths(data.paid_to_channels_share_tenths)
              : "—"}
          </b>
          <span>of list revenue paid to channels</span>
        </div>
        <div className="stat">
          <b className="num">
            {data.direct_bookings_tenths !== null ? pctTenths(data.direct_bookings_tenths) : "—"}
          </b>
          <span>Direct bookings</span>
          <small>
            Commission-free share{" "}
            {data.commission_free_share_tenths !== null ? pctTenths(data.commission_free_share_tenths) : "—"}
          </small>
        </div>
        <div className="stat">
          <b className="num">
            {inr(data.revpar_list)} &rarr; {inr(data.revpar_net)}
          </b>
          <span>RevPAR, list vs net</span>
        </div>
      </div>
      <p className="calc">
        Calculated from your statements: {count(data.counted_rows)} rows for {period}
        {data.excluded_rows ? `, ${count(data.excluded_rows)} kept out until you review them` : ""}. Net =
        list revenue minus hotel-funded discount, commission, GST on commission and payment fees. TDS is a tax
        credit and is not counted as a cost.
      </p>
    </>
  );
}

function ChannelRow({
  channel: c,
  rank,
  highlight,
  refCallback,
}: {
  channel: LedgerChannel;
  rank: number;
  highlight: boolean;
  refCallback: (el: HTMLLIElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const kept = c.kept_share_tenths !== null ? c.kept_share_tenths / 10 : 0;
  const lost = c.lost_vs_list_price;
  const detailsId = `detail-${c.key}`;
  return (
    <li ref={refCallback} className={`row${highlight ? " hl" : ""}`} data-k={c.key}>
      <span className="rank num" aria-label={`Rank ${rank}`}>
        {rank}
      </span>
      <div>
        <div className="nm">{c.name}</div>
        <div className="meta num">{count(c.room_nights)} room nights</div>
      </div>
      <div className="kv hide-s">
        <b className="num" style={{ color: lost ? "var(--loss)" : "var(--ink3)" }}>
          {lost ? `−${inr(lost)}` : inr(0)}
        </b>
        <small>lost vs list price</small>
      </div>
      <div className="kv">
        <b className="num">{c.net_adr !== null ? inr(c.net_adr) : "—"}</b>
        <small>kept per room</small>
      </div>
      <div className="split" aria-hidden="true">
        <i style={{ width: `${kept}%` }} />
      </div>
      <button
        type="button"
        className="more"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide the maths" : "Show the maths"}
      </button>
      {open ? (
        <dl className="breakdown num" id={detailsId}>
          <dt>List revenue</dt>
          <dd>{inr(c.list_revenue)}</dd>
          <dt>Hotel-funded discount</dt>
          <dd>{c.discount ? `−${inr(c.discount)}` : inr(0)}</dd>
          <dt>Commission</dt>
          <dd>{c.commission ? `−${inr(c.commission)}` : inr(0)}</dd>
          <dt>GST on commission</dt>
          <dd>{c.gst_on_commission ? `−${inr(c.gst_on_commission)}` : inr(0)}</dd>
          <dt>Payment fees</dt>
          <dd>{c.fees ? `−${inr(c.fees)}` : inr(0)}</dd>
          <dt className="net">Net kept</dt>
          <dd className="net">{inr(c.net_kept)}</dd>
          <dt>Kept per room ({count(c.room_nights)} room nights)</dt>
          <dd>{c.net_adr !== null ? inr(c.net_adr) : "—"}</dd>
        </dl>
      ) : null}
    </li>
  );
}
