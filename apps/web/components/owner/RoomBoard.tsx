"use client";

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { channelColour } from "@/lib/channels";
import {
  EMPTY_KEY,
  dayLabel,
  fromLastNight,
  gridMove,
  legendChips,
  nightSummary,
  readNights,
  tileCode,
  tileLabel,
  tileMatches,
} from "@/lib/rooms";
import type { Overview } from "@/lib/types-overview";
import type { RoomTile } from "@/lib/types-rooms";
import type { Slip } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { NightScrubber } from "./NightScrubber";
import { RoomSheet } from "./RoomSheet";
import s from "./roomBoard.module.css";

const GRID_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

/** Columns in the rendered grid: tiles sharing the first tile's top edge. */
function columns(tiles: (HTMLButtonElement | null)[]): number {
  const top = tiles[0]?.offsetTop;
  if (top === undefined) return 1;
  return Math.max(1, tiles.filter((t) => t?.offsetTop === top).length);
}

/**
 * Last night's rooms, and the six nights before: a scrubber, channel chips
 * that filter the grid, and a sheet per room. Room nights come from
 * GET /rooms/nights; until it answers (or if it fails) the board shows the
 * Overview's own last night.
 */
export function RoomBoard({ fallback }: { fallback: Overview["last_night"] }) {
  const toast = useToast();
  const loaded = useApi<unknown>("rooms/nights");
  const board = useMemo(() => {
    const read = loaded.data ? readNights(loaded.data) : null;
    return read && read.nights.length > 0 ? read : fromLastNight(fallback);
  }, [loaded.data, fallback]);

  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [focusAt, setFocusAt] = useState(0);
  const [open, setOpen] = useState<RoomTile | null>(null);
  const [busy, setBusy] = useState(false);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const night = board.nights.find((n) => n.night === picked) ?? board.nights.at(-1);
  if (!night) return null;
  const chips = legendChips(night);
  const isLast = night.night === board.nights.at(-1)?.night;
  const focusIndex = Math.min(focusAt, Math.max(0, night.tiles.length - 1));

  async function printClose() {
    setBusy(true);
    try {
      await postJson<Slip>("desk/close-slip");
      toast("Close slip sent to the Desk printer.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "The close slip did not print. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!GRID_KEYS.includes(e.key)) return;
    e.preventDefault();
    const next = gridMove(focusIndex, e.key, night?.tiles.length ?? 0, columns(tileRefs.current));
    setFocusAt(next);
    tileRefs.current[next]?.focus();
  }

  function closeSheet() {
    setOpen(null);
    // Back to the tile that opened the sheet (a mouse click may not focus it).
    const at = focusIndex;
    requestAnimationFrame(() => tileRefs.current[at]?.focus());
  }

  return (
    <section className={s.card} aria-labelledby="night-title" data-testid="room-board">
      <div className={s.head}>
        <h2 id="night-title" className={s.title}>
          {isLast ? "Last night" : `Night of ${dayLabel(night.night)}`}
        </h2>
      </div>

      <div className={s.bar}>
        <p className={s.summary} aria-live="polite" data-testid="night-summary">
          <span key={night.night} className={s.fadeIn}>
            {nightSummary(night)}
          </span>
        </p>
        <button type="button" className="btn ghost small" onClick={printClose} disabled={busy}>
          {busy ? "Sending" : "Print close slip on Desk"}
        </button>
      </div>

      {board.nights.length > 1 ? (
        <NightScrubber
          nights={board.nights.map((n) => n.night)}
          value={night.night}
          onChange={(n) => setPicked(n)}
        />
      ) : null}

      <div className={s.chips} role="group" aria-label="Show rooms by channel">
        {chips.map((c) => {
          const on = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              className={`${s.chip} ${on ? s.chipOn : ""}`}
              aria-pressed={on}
              onClick={() => setFilter(on ? null : c.key)}
              data-ch={c.key}
            >
              <i
                style={c.key === EMPTY_KEY ? undefined : { background: channelColour(c.key) }}
                className={c.key === EMPTY_KEY ? s.swatchEmpty : undefined}
                aria-hidden="true"
              />
              {c.name}
              <span className={s.chipCount}>{c.rooms}</span>
            </button>
          );
        })}
      </div>

      <div
        key={night.night}
        className={s.grid}
        role="group"
        aria-label={`Rooms on ${dayLabel(night.night)}. Arrow keys move between rooms.`}
        onKeyDown={onGridKey}
        data-testid="room-grid"
      >
        {night.tiles.map((tile, i) => {
          const match = tileMatches(tile, filter);
          return (
            <button
              key={tile.room}
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              type="button"
              className={`${s.tile} ${match ? "" : s.dim}`}
              data-ch={tile.sold && tile.channel_key ? tile.channel_key : "empty"}
              data-dim={match ? undefined : "true"}
              style={{
                animationDelay: `${i * 30}ms`,
                ...(tile.sold && tile.channel_key ? { background: channelColour(tile.channel_key) } : {}),
              }}
              tabIndex={i === focusIndex ? 0 : -1}
              aria-label={tileLabel(tile, night.by_channel)}
              onFocus={() => setFocusAt(i)}
              onClick={() => {
                setFocusAt(i);
                setOpen(tile);
              }}
            >
              <b>{tile.room}</b>
              <span>{tileCode(tile.sold ? tile.channel_key : null)}</span>
            </button>
          );
        })}
      </div>

      {open ? <RoomSheet night={night.night} tile={open} onClose={closeSheet} /> : null}
    </section>
  );
}
