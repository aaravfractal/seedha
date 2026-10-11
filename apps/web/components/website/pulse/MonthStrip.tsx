"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { SEASON_LABEL, type PulseEvent } from "@/lib/pulse";
import site from "../site.module.css";
import { DecisionCard } from "./DecisionCard";
import { PlaySeason } from "./PlaySeason";
import { keyIndex, useReservedHeight } from "./storyHooks";
import { monthLabel, Tick } from "./Timeline";
import css from "./pulse-story.module.css";

/** Horizontal travel (px) that counts as a swipe. */
const SWIPE_PX = 56;

/**
 * Phone and tablet season story: no pinning. A snap-scrolling strip of event
 * chips grouped by month, and the compact decision card below. Swiping the
 * card left or right moves between events; vertical scroll stays native.
 */
export function MonthStrip({
  events,
  index,
  onIndex,
}: {
  events: readonly PulseEvent[];
  index: number;
  onIndex: (index: number) => void;
}) {
  const total = events.length;
  const strip = useRef<HTMLOListElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; id: number } | null>(null);
  useReservedHeight(slot);

  // Keep the active chip centred in the strip, without moving the page.
  useEffect(() => {
    const list = strip.current;
    const chip = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !chip) return;
    const left = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [index]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = keyIndex(e.key, index, total, false);
    if (next === null) return;
    e.preventDefault();
    onIndex(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = press.current;
    press.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = Math.min(total - 1, Math.max(0, index + (dx < 0 ? 1 : -1)));
    if (next !== index) onIndex(next);
  };

  const event = events[index];
  if (!event) return null;
  return (
    <div
      className={css.mobile}
      role="group"
      aria-label="Season story. Arrow keys move between events."
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className={css.stripHead}>
        <p className={css.season}>
          <span>{SEASON_LABEL}</span>
          <span className={css.sample}>Sample</span>
        </p>
        <PlaySeason index={index} total={total} onGo={onIndex} />
      </div>
      <ol ref={strip} className={css.strip} aria-label={`Season events, ${SEASON_LABEL}`}>
        {events.map((item, i) => {
          const firstOfMonth = i === 0 || events[i - 1]?.month !== item.month;
          const state = i < index ? "past" : i === index ? "active" : "next";
          return (
            <li key={item.id} className={css.chipItem}>
              <span className={css.chipMonth} aria-hidden="true">
                {firstOfMonth ? monthLabel(item.month) : ""}
              </span>
              <button
                type="button"
                className={css.chip}
                data-state={state}
                aria-current={i === index ? "step" : undefined}
                onClick={() => onIndex(i)}
              >
                {state === "past" ? <Tick className={css.chipTick} /> : null}
                <span className={css.chipName}>{item.name}</span>
                <span className={css.chipDate}>{item.date}</span>
                {state === "past" ? <span className={site.srOnly}>, done</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <div
        ref={slot}
        className={css.swipe}
        data-pulse-card=""
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          press.current = null;
        }}
      >
        <DecisionCard event={event} index={index} total={total} reducedMotion={false} compact />
      </div>
      <p className={css.swipeHint}>Swipe the card or tap an event.</p>
    </div>
  );
}
