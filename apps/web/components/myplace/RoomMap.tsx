"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { channelColour } from "@/lib/channels";
import { inr } from "@/lib/format";
import { channelShort, floorName, profitTone, signedInr } from "@/lib/myplace";
import type { PlaceChannel, PlaceFloor, PlaceRoom } from "@/lib/types-myplace";
import s from "./myplace.module.css";

export type ColourMode = "profit" | "channel";

const ZOOMS = [68, 84, 104] as const;
const POP_WIDTH = 280;

type Props = {
  rooms: PlaceRoom[];
  floors: PlaceFloor[];
  channels: PlaceChannel[];
  mode: ColourMode;
  selected: number | null;
  onSelect: (room: number | null) => void;
};

/** Rooms by floor, coloured by profit or by main channel; tap a room for its figures. */
export function RoomMap({ rooms, floors, channels, mode, selected, onSelect }: Props) {
  const [zoom, setZoom] = useState(1);
  const [openState, setOpen] = useState<number | null>(null);
  // A selection made elsewhere (the table) closes a popover on another room.
  const open = openState !== null && openState === selected ? openState : null;
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<number, HTMLButtonElement>());
  const openRoom = open === null ? null : (rooms.find((r) => r.number === open) ?? null);

  const place = useCallback(() => {
    const map = mapRef.current;
    const tile = open === null ? undefined : tileRefs.current.get(open);
    if (!map || !tile) {
      setPos(null);
      return;
    }
    const m = map.getBoundingClientRect();
    const t = tile.getBoundingClientRect();
    const width = Math.min(POP_WIDTH, m.width);
    const centre = t.left - m.left + t.width / 2;
    const left = Math.max(0, Math.min(centre - width / 2, m.width - width));
    setPos({ left, top: t.bottom - m.top + 8 });
  }, [open]);

  useLayoutEffect(() => {
    place();
  }, [place, zoom]);

  useEffect(() => {
    if (open === null) return;
    const onResize = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const tile = tileRefs.current.get(open);
        setOpen(null);
        tile?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (mapRef.current && !mapRef.current.contains(target)) setOpen(null);
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, place]);

  function tap(number: number) {
    if (open === number) {
      setOpen(null);
      return;
    }
    onSelect(number);
    setOpen(number);
  }

  return (
    <div>
      <div className={s.tools} style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <span className={s.kpiNote}>Zoom</span>
        <div className={s.zoom} role="group" aria-label="Zoom the room map">
          <button
            type="button"
            className={s.zoomBtn}
            aria-label="Zoom out"
            disabled={zoom === 0}
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
          >
            −
          </button>
          <button
            type="button"
            className={s.zoomBtn}
            aria-label="Zoom in"
            disabled={zoom === ZOOMS.length - 1}
            onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
          >
            +
          </button>
        </div>
      </div>
      <div className={s.map} ref={mapRef} style={{ ["--tile" as string]: `${ZOOMS[zoom]}px` }}>
        {[...floors].reverse().map((floor) => (
          <section key={floor.floor} className={s.floor} aria-label={floorName(floor.floor)}>
            <h3 className={s.floorName}>
              {floorName(floor.floor)} · {floor.rooms_in_profit} of {floor.rooms} rooms in profit
            </h3>
            <ul className={s.rooms}>
              {rooms
                .filter((r) => r.floor === floor.floor)
                .map((room) => {
                  const tone = profitTone(room.profit);
                  const isSel = selected === room.number;
                  return (
                    <li key={room.number}>
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) tileRefs.current.set(room.number, el);
                          else tileRefs.current.delete(room.number);
                        }}
                        className={`${s.room}${isSel ? ` ${s.selected}` : ""}`}
                        data-tone={mode === "profit" ? tone : undefined}
                        data-ch={mode === "channel" ? room.channel_key : undefined}
                        style={
                          mode === "channel" ? { background: channelColour(room.channel_key) } : undefined
                        }
                        aria-expanded={open === room.number}
                        aria-controls={open === room.number ? "room-pop" : undefined}
                        aria-label={`Room ${room.number}, ${room.channel_name}, profit ${signedInr(room.profit)}`}
                        onClick={() => tap(room.number)}
                      >
                        <b>{room.number}</b>
                        <span>
                          {mode === "profit"
                            ? signedInr(room.profit)
                            : channelShort(room.channel_key, room.channel_name)}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
        {openRoom && pos ? (
          <div
            id="room-pop"
            className={s.pop}
            role="dialog"
            aria-modal="false"
            aria-labelledby="room-pop-title"
            style={{ left: pos.left, top: pos.top }}
          >
            <div className={s.popHead}>
              <div>
                <p className={s.popTitle} id="room-pop-title">
                  Room {openRoom.number}
                </p>
                <p className={s.popSub}>
                  {openRoom.room_type} · mostly {openRoom.channel_name}
                </p>
              </div>
              <button
                type="button"
                className={s.popClose}
                aria-label="Close room details"
                onClick={() => {
                  setOpen(null);
                  tileRefs.current.get(openRoom.number)?.focus();
                }}
              >
                ×
              </button>
            </div>
            <dl className={s.lines}>
              <dt>Nights this month</dt>
              <dd>{openRoom.nights}</dd>
              <dt>Net kept</dt>
              <dd>{inr(openRoom.net)}</dd>
              <dt>Room costs ({openRoom.nights} nights)</dt>
              <dd>{inr(-openRoom.variable_cost)}</dd>
              <dt>Share of fixed costs</dt>
              <dd>{inr(-openRoom.fixed_share)}</dd>
              <dt className={s.total}>Profit</dt>
              <dd className={`${s.total} ${s[profitTone(openRoom.profit)] ?? ""}`}>
                {signedInr(openRoom.profit)}
              </dd>
            </dl>
          </div>
        ) : null}
      </div>
      <Legend mode={mode} channels={channels} />
    </div>
  );
}

function Legend({ mode, channels }: { mode: ColourMode; channels: PlaceChannel[] }) {
  if (mode === "profit") {
    return (
      <ul className={s.legend} aria-label="Room colours">
        <li>
          <i className={s.swGain} aria-hidden="true" />+ In profit
        </li>
        <li>
          <i className={s.swLoss} aria-hidden="true" />− Below its costs
        </li>
      </ul>
    );
  }
  return (
    <ul className={s.legend} aria-label="Room colours">
      {channels.map((c) => (
        <li key={c.key}>
          <i style={{ background: channelColour(c.key) }} aria-hidden="true" />
          {c.name} · {c.rooms} {c.rooms === 1 ? "room" : "rooms"}
        </li>
      ))}
    </ul>
  );
}
