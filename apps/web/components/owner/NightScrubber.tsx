"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { dayLabel, dayLong } from "@/lib/rooms";
import s from "./roomBoard.module.css";

/**
 * The last seven nights as a segmented control (a radio group): click a
 * night, or use the arrow keys, Home and End. The last night is the
 * business date.
 */
export function NightScrubber({
  nights,
  value,
  onChange,
}: {
  nights: string[];
  value: string;
  onChange: (night: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, nights.indexOf(value));

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const last = nights.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? Math.min(last, index + 1)
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? Math.max(0, index - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    const night = nights[next];
    if (night === undefined) return;
    onChange(night);
    refs.current[next]?.focus();
  }

  return (
    <div
      className={s.scrubber}
      role="radiogroup"
      aria-label="Night"
      onKeyDown={onKey}
      data-testid="night-scrubber"
    >
      {nights.map((night, i) => {
        const [dow, date] = dayLabel(night).split(" ");
        const on = i === index;
        return (
          <button
            key={night}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${dayLong(night)}${i === nights.length - 1 ? ", last night" : ""}`}
            tabIndex={on ? 0 : -1}
            className={`${s.seg} ${on ? s.segOn : ""}`}
            onClick={() => onChange(night)}
          >
            <span className={s.segDow}>{dow}</span>
            <b className={s.segDate}>{date}</b>
          </button>
        );
      })}
    </div>
  );
}
