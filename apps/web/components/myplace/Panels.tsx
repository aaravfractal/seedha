"use client";

import { useState } from "react";
import { channelColour } from "@/lib/channels";
import { count, inr, pctTenths } from "@/lib/format";
import {
  barPct,
  floorName,
  nextSort,
  profitTone,
  roomCosts,
  signedInr,
  sortRooms,
  type SortDir,
  type SortKey,
} from "@/lib/myplace";
import type { PlaceChannel, PlaceFloor, PlaceMonth, PlaceRoom, PlaceSummary } from "@/lib/types-myplace";
import s from "./myplace.module.css";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "number", label: "Room" },
  { key: "channel", label: "Main channel" },
  { key: "nights", label: "Nights" },
  { key: "net", label: "Net kept" },
  { key: "costs", label: "Costs" },
  { key: "profit", label: "Profit" },
];

/** Sortable room table; the selected room is highlighted and shared with the map. */
export function RoomTable({
  rooms,
  selected,
  onSelect,
}: {
  rooms: PlaceRoom[];
  selected: number | null;
  onSelect: (room: number) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "number", dir: "asc" });
  const sorted = sortRooms(rooms, sort.key, sort.dir);
  return (
    <div className={s.tableWrap} role="region" aria-label="Rooms table" tabIndex={0}>
      <table className={s.table}>
        <caption className="sr-only-text">
          Rooms with their month figures. Sorted by {COLUMNS.find((c) => c.key === sort.key)?.label ?? "room"}
          , {sort.dir === "asc" ? "low to high" : "high to low"}.
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  <button
                    type="button"
                    className={s.sortBtn}
                    data-active={active}
                    onClick={() => setSort((cur) => nextSort(cur, col.key))}
                  >
                    {col.label}
                    <span aria-hidden="true">{active ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((room) => {
            const isSel = selected === room.number;
            return (
              <tr key={room.number} className={isSel ? s.rowSel : undefined}>
                <th scope="row">
                  <button
                    type="button"
                    className={s.rowBtn}
                    aria-pressed={isSel}
                    aria-label={`Select room ${room.number}`}
                    onClick={() => onSelect(room.number)}
                  >
                    {room.number}
                  </button>
                </th>
                <td>
                  <i
                    className={s.chDot}
                    style={{ background: channelColour(room.channel_key) }}
                    aria-hidden="true"
                  />
                  {room.channel_name}
                </td>
                <td>{room.nights}</td>
                <td>{inr(room.net)}</td>
                <td>{inr(-roomCosts(room))}</td>
                <td className={s[profitTone(room.profit)]}>{signedInr(room.profit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Profit by floor: a bar per floor, length by size, colour and sign by direction. */
export function FloorBars({ floors }: { floors: PlaceFloor[] }) {
  const maxAbs = Math.max(0, ...floors.map((f) => Math.abs(f.profit)));
  return (
    <ul className={s.bars}>
      {floors.map((f) => {
        const tone = profitTone(f.profit);
        return (
          <li key={f.floor} className={s.barRow}>
            <div className={s.barTop}>
              <span>{floorName(f.floor)}</span>
              <b className={s[tone]}>{signedInr(f.profit)}</b>
            </div>
            <div className={s.barTrack} aria-hidden="true">
              <div
                className={`${s.bar} ${tone === "loss" ? s.barLoss : s.barGain}`}
                style={{ width: `${barPct(f.profit, maxAbs)}%` }}
              />
            </div>
            <span className={s.barNote}>
              {f.rooms_in_profit} of {f.rooms} rooms in profit
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The month in one card: occupancy to nights, net, costs, profit. */
export function MonthSummary({
  month,
  summary,
  channels,
  rooms,
}: {
  month: PlaceMonth;
  summary: PlaceSummary;
  channels: PlaceChannel[];
  rooms: number;
}) {
  return (
    <div>
      <p className={s.cardSub} style={{ margin: "0 0 12px" }}>
        {month.label}. Occupancy {pctTenths(summary.occupancy_tenths)}, so each room sells{" "}
        {summary.nights_per_room} of {summary.nights_basis} nights.
      </p>
      <dl className={s.sum}>
        <dt>Room nights ({rooms} rooms)</dt>
        <dd>{count(summary.room_nights)}</dd>
        <dt>Net kept after channels</dt>
        <dd>{inr(summary.net_kept)}</dd>
        <dt>Room costs</dt>
        <dd>{inr(-summary.variable_costs)}</dd>
        <dt>Fixed monthly costs</dt>
        <dd>{inr(-summary.fixed_costs)}</dd>
        <dt className={s.total}>Profit</dt>
        <dd className={`${s.total} ${s[profitTone(summary.profit)] ?? ""}`}>{signedInr(summary.profit)}</dd>
      </dl>
      <h3 className={s.mixTitle}>Main channel by room</h3>
      <ul className={s.mix}>
        {channels
          .filter((c) => c.rooms > 0)
          .map((c) => (
            <li key={c.key}>
              <i className={s.chDot} style={{ background: channelColour(c.key) }} aria-hidden="true" />
              <span>
                {c.name} · {c.rooms} {c.rooms === 1 ? "room" : "rooms"}
              </span>
              <span className={s.mixNote}>
                {pctTenths(c.nights_share_tenths)} of nights · {inr(c.net_adr)} a night
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
