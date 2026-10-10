"use client";

import { useState } from "react";
import { inr } from "@/lib/format";
import type { OwnerPackage, PackageState } from "@/lib/types-site";
import o from "./owner.module.css";

const MIN_NIGHTS = 1;
const MAX_NIGHTS = 7;
const STATE_LABEL: Record<PackageState, string> = {
  pending: "Needs your OK",
  approved: "On your site",
  skipped: "Skipped",
};

export type PackageChange = { state?: PackageState; nights?: number };

function PackageCard({
  p,
  busy,
  onApprove,
  onChange,
}: {
  p: OwnerPackage;
  busy: boolean;
  onApprove: () => void;
  onChange: (change: PackageChange) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nights, setNights] = useState(p.nights);
  const titleId = `pkg-${p.key}`;
  return (
    <article className={o.card} aria-labelledby={titleId}>
      <div className={o.pkgHead}>
        <span>✦ Suggested from your bookings</span>
        <span className={o.state} data-state={p.state}>
          {STATE_LABEL[p.state]}
        </span>
      </div>
      <h3 id={titleId} className={o.pkgTitle}>
        {p.name.en}
      </h3>
      <p className={o.muted} style={{ margin: "4px 0 0" }}>
        {p.includes.en}
      </p>
      <p className={o.pkgPrice}>{inr(p.price)}</p>
      <p className={o.reason}>
        <b>Reason:</b> {p.why}
      </p>
      {editing ? (
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Nights</p>
          <div className={o.stepperRow}>
            <button
              type="button"
              aria-label="One night fewer"
              disabled={nights <= MIN_NIGHTS}
              onClick={() => setNights(nights - 1)}
            >
              −
            </button>
            <b aria-live="polite" style={{ fontSize: 20, minWidth: 24, textAlign: "center" }}>
              {nights}
            </b>
            <button
              type="button"
              aria-label="One night more"
              disabled={nights >= MAX_NIGHTS}
              onClick={() => setNights(nights + 1)}
            >
              +
            </button>
          </div>
          <p className={o.muted} style={{ margin: "0 0 6px", fontSize: 15 }}>
            How the price is worked out now. Save to see the new total.
          </p>
          <ul className={o.lines}>
            {p.lines.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <b>{inr(line.amount)}</b>
              </li>
            ))}
          </ul>
          <div className={o.actions}>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                onChange({ nights });
                setEditing(false);
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setNights(p.nights);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={o.actions}>
          {p.state === "approved" ? (
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => onChange({ state: "pending" })}
            >
              Take off site
            </button>
          ) : p.state === "skipped" ? (
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => onChange({ state: "pending" })}
            >
              Bring back
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={onApprove}>
              Approve
            </button>
          )}
          {p.state !== "skipped" ? (
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => {
                setNights(p.nights);
                setEditing(true);
              }}
            >
              Edit
            </button>
          ) : null}
          {p.state === "pending" ? (
            <button
              type="button"
              className={o.skipBtn}
              disabled={busy}
              onClick={() => onChange({ state: "skipped" })}
            >
              Skip
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}

/** Suggested packages; the owner approves each before it shows on the site. Prices from the API. */
export function PackagesTab({
  packages,
  busy,
  onApprove,
  onChange,
}: {
  packages: OwnerPackage[];
  busy: boolean;
  onApprove: (key: string) => void;
  onChange: (key: string, change: PackageChange) => void;
}) {
  return (
    <div className={o.stack}>
      <div>
        <h2 className={o.h2}>Packages for your guests.</h2>
        <p className={o.sub}>
          Seedha suggests packages from your own bookings. You approve each one before it shows on your site.
        </p>
      </div>
      <div className={o.grid2}>
        {packages.map((p) => (
          <PackageCard
            key={`${p.key}-${p.nights}-${p.state}`}
            p={p}
            busy={busy}
            onApprove={() => onApprove(p.key)}
            onChange={(change) => onChange(p.key, change)}
          />
        ))}
      </div>
      <p className={o.rule}>
        Packages add value. A package is never priced below your public room price: it is the room rate for
        each night plus the extras, worked out from your rooms.
      </p>
    </div>
  );
}
