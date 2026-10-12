"use client";

import { useEffect, useId, useRef } from "react";
import { inr } from "@/lib/format";
import { MAX_ROOMS, MIN_ROOMS, paiseToRupeeText, roomRowError, rupeesToPaise } from "@/lib/siteBuild";
import type { BuildRoom } from "@/lib/types-site-build";
import b from "./build.module.css";

/** One row as typed: the price stays text until it is saved as integer paise. */
export type RoomRow = { key: number; name: string; price: string };

let rowKey = 0;
/** Fresh editor rows from the saved rooms (one empty row when there are none). */
export function roomRows(rooms: BuildRoom[]): RoomRow[] {
  const rows = rooms.map((r) => ({ key: rowKey++, name: r.name, price: paiseToRupeeText(r.price_paise) }));
  return rows.length ? rows : [{ key: rowKey++, name: "", price: "" }];
}

/**
 * Step 3: 1 to 10 room types with the nightly price the owner types in
 * rupees. The price shown on the site is exactly this number; AI never
 * writes a price. `showErrors` turns on the per-row messages after a save try.
 */
export function RoomsEditor({
  rows,
  onRows,
  showErrors,
}: {
  rows: RoomRow[];
  onRows: (rows: RoomRow[]) => void;
  showErrors: boolean;
}) {
  const base = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  // After Remove, focus the next row's name (or Add a room type) instead of the page.
  const focusAfter = useRef<number | "add" | null>(null);
  useEffect(() => {
    const want = focusAfter.current;
    if (want === null) return;
    focusAfter.current = null;
    if (want === "add") addButton.current?.focus();
    else document.getElementById(`${base}-name-${want}`)?.focus();
  }, [rows, base]);
  const change = (key: number, patch: Partial<RoomRow>) =>
    onRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className={b.flow}>
      <ol className={b.rooms} aria-label="Room types">
        {rows.map((row, i) => {
          const err = showErrors ? roomRowError(row.name, row.price) : null;
          const paise = rupeesToPaise(row.price);
          const nameId = `${base}-name-${row.key}`;
          const priceId = `${base}-price-${row.key}`;
          const errId = `${base}-err-${row.key}`;
          const shownId = `${base}-shown-${row.key}`;
          return (
            <li key={row.key} className={b.room}>
              <div className={b.field}>
                <label className={b.label} htmlFor={nameId}>
                  Room {i + 1} name
                </label>
                <input
                  id={nameId}
                  className={b.input}
                  type="text"
                  maxLength={60}
                  value={row.name}
                  placeholder="For example, Deluxe Valley View"
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? errId : undefined}
                  onChange={(e) => change(row.key, { name: e.target.value })}
                />
              </div>
              <div className={b.field}>
                <label className={b.label} htmlFor={priceId}>
                  Price for one night (₹)
                </label>
                <input
                  id={priceId}
                  className={b.input}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={12}
                  value={row.price}
                  placeholder="4500"
                  aria-invalid={err ? true : undefined}
                  aria-describedby={`${shownId}${err ? ` ${errId}` : ""}`}
                  onChange={(e) => change(row.key, { price: e.target.value })}
                />
                <span id={shownId} className={b.hint}>
                  {paise !== null ? `Shown as ${inr(paise)} a night` : "In rupees, up to 1,00,000"}
                </span>
              </div>
              <button
                type="button"
                className="btn ghost small"
                disabled={rows.length <= MIN_ROOMS}
                aria-label={`Remove room ${i + 1}${row.name ? `, ${row.name}` : ""}`}
                onClick={() => {
                  focusAfter.current = rows[i + 1]?.key ?? "add";
                  onRows(rows.filter((r) => r.key !== row.key));
                }}
              >
                Remove
              </button>
              {err ? (
                <p id={errId} className={b.error} style={{ gridColumn: "1 / -1" }}>
                  {err}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div>
        <button
          ref={addButton}
          type="button"
          className="btn ghost"
          disabled={rows.length >= MAX_ROOMS}
          onClick={() => onRows([...rows, { key: rowKey++, name: "", price: "" }])}
        >
          Add a room type
        </button>
        <p className={b.hint} style={{ marginTop: 8 }}>
          {rows.length} of {MAX_ROOMS} room types.
        </p>
      </div>
    </div>
  );
}
