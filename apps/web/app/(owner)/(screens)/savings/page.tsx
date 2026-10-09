"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api";
import { count, inr, pctTenths } from "@/lib/format";
import type { Savings } from "@/lib/types";
import { EmptyState, ErrorState, Loading } from "@/components/States";

/** Counts up to the value once, unless the viewer prefers reduced motion. */
function CountUp({ paise }: { paise: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = paise;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jump straight to the value
      setShown(paise);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (paise - start) * eased));
      if (p < 1) frame = requestAnimationFrame(step);
      else from.current = paise;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [paise]);
  return (
    <div className="big num" aria-hidden="true">
      {inr(shown)}
    </div>
  );
}

export default function SavingsPage() {
  const savings = useApi<Savings>("savings");
  const header = (
    <>
      <h2 className="title">Saved by booking direct.</h2>
      <p className="sub">Counted only when a perk code is used. No code, no saving claimed.</p>
    </>
  );
  if (savings.error) {
    return (
      <>
        {header}
        <ErrorState message={savings.error.message} code={savings.error.code} onRetry={savings.reload} />
      </>
    );
  }
  if (!savings.data) {
    return (
      <>
        {header}
        <Loading rows={2} label="Loading savings" />
      </>
    );
  }
  const s = savings.data;
  return (
    <>
      {header}
      <div className="card">
        <CountUp paise={s.total_net_saving} />
        <span className="sr-only-text">{inr(s.total_net_saving)} saved</span>
        <p className="sub" style={{ margin: "10px 0 0" }}>
          {s.count
            ? `${count(s.count)} coded direct booking${s.count > 1 ? "s" : ""}. ${inr(s.total_avoided)} commission and GST avoided, after UPI fees.`
            : "No coded direct bookings yet."}
        </p>
      </div>
      <div style={{ marginTop: 16 }}>
        {s.count === 0 ? (
          <EmptyState
            title="The ledger is empty"
            action={
              <Link className="btn small" href="/desk">
                Go to Desk
              </Link>
            }
          >
            Complete the loop: Desk, Approvals, then Seedha Link.
          </EmptyState>
        ) : (
          <div className="card">
            {s.items.map((item) => (
              <div className="item" key={`${item.code}-${item.booked_at}`}>
                <div>
                  <b>{item.guest_name}</b>
                  <div className="meta">
                    Code {item.code} · {inr(item.amount)} booked direct
                  </div>
                  <div className="meta">
                    {`Would have gone via ${item.original_channel} at ${pctTenths(item.commission_rate_used / 10)}: ${inr(item.commission_avoided)} commission + ${inr(item.gst_avoided)} GST \u2212 ${inr(item.upi_fee)} UPI fee`}
                  </div>
                </div>
                <b className="num" style={{ color: "var(--gain)" }}>
                  +{inr(item.net_saving)}
                </b>
              </div>
            ))}
            <p className="calc">
              Saving = the commission and GST the guest&apos;s original channel would have taken on this
              booking, at that channel&apos;s contract rate, minus the UPI fee paid instead.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
