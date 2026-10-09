"use client";

import { useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import type { SiteData } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";

/** A printable rate card for travel agents, from the same prices as the site. */
export default function RateCardPage() {
  const site = useApi<SiteData>("site");
  if (site.error)
    return <ErrorState message={site.error.message} code={site.error.code} onRetry={site.reload} />;
  if (!site.data) return <Loading rows={3} label="Preparing the rate card" />;
  const s = site.data;
  return (
    <section className="view" style={{ maxWidth: 720, margin: "0 auto" }}>
      <p className="tag no-print">Sample hotel · prices from your rooms and packages</p>
      <h1 className="display" style={{ fontSize: 44 }}>
        {s.hotel}
      </h1>
      <p className="lede">{s.location}</p>
      <div className="card">
        <h3 className="sub-title">Rooms</h3>
        {s.rooms.map((r) => (
          <div className="item" key={r.room_type}>
            <span>{r.room_type}</span>
            <b className="num">{inr(r.nightly_rate)} a night</b>
          </div>
        ))}
      </div>
      {s.packages.some((p) => p.approved) ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="sub-title">Packages</h3>
          {s.packages
            .filter((p) => p.approved)
            .map((p) => (
              <div className="item" key={p.key}>
                <span>
                  {p.name}
                  <br />
                  <span className="meta">{p.includes}</span>
                </span>
                <b className="num">{inr(p.price)}</b>
              </div>
            ))}
        </div>
      ) : null}
      <p className="calc">Nearby: {s.nearby}</p>
      <button type="button" className="btn no-print" onClick={() => window.print()}>
        Print or save as PDF
      </button>
    </section>
  );
}
