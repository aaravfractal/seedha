"use client";

import { useId } from "react";
import { moveItem } from "@/lib/siteBuild";
import {
  DETAIL_LIMITS,
  DIRECTIONS,
  NEARBY_KINDS,
  TRAVEL_MODES,
  emptyNearby,
  nearestDirection,
} from "@/lib/siteDetails";
import type { NearbyDraft } from "@/lib/siteDetails";
import { Block, Choice, ItemTools, TextBox } from "./fields";
import d from "./details.module.css";

// Compass buttons laid out in a 3 x 3 grid, the hotel in the middle.
const GRID: ReadonlyArray<string | null> = ["NW", "N", "NE", "W", null, "E", "SW", "S", "SE"];

/** Which way the place is from the hotel: eight compass buttons, or exact degrees. */
function Direction({
  place,
  bearing,
  error,
  onChange,
}: {
  place: string;
  bearing: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const typed = /^\d+$/.test(bearing.trim()) ? Number(bearing) : null;
  const near = typed !== null && typed <= 359 ? nearestDirection(typed)[0] : null;
  return (
    <div className={d.field}>
      <span className={d.label} id={`${id}-label`}>
        Which way from the hotel
      </span>
      <div className={d.direction}>
        <div className={d.compass} role="group" aria-labelledby={`${id}-label`}>
          {GRID.map((key, i) => {
            if (key === null) {
              return (
                <span key="hotel" className={d.compassCentre} aria-hidden="true">
                  Hotel
                </span>
              );
            }
            const dir = DIRECTIONS.find(([short]) => short === key);
            if (!dir) return <span key={i} />;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={near === key}
                aria-label={`${dir[1]} of the hotel, for ${place}`}
                onClick={() => onChange(String(dir[2]))}
              >
                {key}
              </button>
            );
          })}
        </div>
        <div className={d.degrees}>
          <TextBox
            label="Degrees from north"
            value={bearing}
            inputMode="numeric"
            error={error}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
}

/** Up to 8 places near the hotel, with time, mode, kind and direction for the site map. */
export function NearbyEditor({
  value,
  errors,
  onChange,
}: {
  value: NearbyDraft[];
  errors: Record<string, string>;
  onChange: (next: NearbyDraft[]) => void;
}) {
  const max = DETAIL_LIMITS.nearby;
  function set(i: number, patch: Partial<NearbyDraft>) {
    onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  return (
    <Block
      id="details-nearby"
      title="Nearby places"
      count={`${value.length} of ${max}`}
      hint="Places guests ask about, how long it takes, and which way they are. The direction places them on your site's map."
    >
      {value.length === 0 ? <p className={d.hint}>No nearby places yet.</p> : null}
      <ol className={d.items}>
        {value.map((p, i) => {
          const label = p.name_en.trim() || `place ${i + 1}`;
          return (
            <li key={i} className={d.item}>
              <div className={d.itemHead}>
                <h4 className={d.itemTitle}>Place {i + 1}</h4>
                <ItemTools
                  index={i}
                  total={value.length}
                  noun="place"
                  onMove={(from, to) => onChange(moveItem(value, from, to))}
                  onRemove={(at) => onChange(value.filter((_, j) => j !== at))}
                />
              </div>
              <div className={d.pair}>
                <TextBox
                  label="Name in English"
                  value={p.name_en}
                  error={errors[`nearby.${i}.name_en`]}
                  onChange={(v) => set(i, { name_en: v })}
                />
                <TextBox
                  label="Name in Hindi (optional)"
                  value={p.name_hi}
                  lang="hi"
                  error={errors[`nearby.${i}.name_hi`]}
                  onChange={(v) => set(i, { name_hi: v })}
                />
              </div>
              <div className={d.trio}>
                <TextBox
                  label="Minutes"
                  value={p.minutes}
                  inputMode="numeric"
                  error={errors[`nearby.${i}.minutes`]}
                  onChange={(v) => set(i, { minutes: v })}
                />
                <Choice
                  label="How"
                  value={p.mode}
                  options={TRAVEL_MODES}
                  onChange={(v) => set(i, { mode: v })}
                />
                <Choice
                  label="Kind"
                  value={p.kind}
                  options={NEARBY_KINDS}
                  onChange={(v) => set(i, { kind: v })}
                />
              </div>
              <Direction
                place={label}
                bearing={p.bearing}
                error={errors[`nearby.${i}.bearing`]}
                onChange={(v) => set(i, { bearing: v })}
              />
            </li>
          );
        })}
      </ol>
      <div>
        <button
          type="button"
          className="btn ghost small"
          disabled={value.length >= max}
          onClick={() => onChange([...value, emptyNearby()])}
        >
          {value.length >= max ? `${max} places added` : "Add a place"}
        </button>
      </div>
      {errors.nearby ? <p className={d.error}>{errors.nearby}</p> : null}
    </Block>
  );
}
