"use client";

import { motion, type MotionValue } from "framer-motion";
import { SEASON_LABEL, type PulseEvent } from "@/lib/pulse";
import site from "../site.module.css";
import css from "./pulse-story.module.css";

/** "Oct" -> "Oct 2026"; the season runs Oct 2026 to Jan 2027. */
export function monthLabel(month: PulseEvent["month"]): string {
  return `${month} ${month === "Jan" ? 2027 : 2026}`;
}

/** Tick for an event already passed in the story. */
export function Tick({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Vertical season timeline. A pine line fills with scroll progress (scaleY,
 * transform only); each event is a button that jumps the story to it.
 */
export function Timeline({
  events,
  index,
  fill,
  onJump,
}: {
  events: readonly PulseEvent[];
  index: number;
  fill: MotionValue<number>;
  onJump: (index: number) => void;
}) {
  return (
    <div className={css.timeline}>
      <p className={css.season}>
        <span>{SEASON_LABEL}</span>
        <span className={css.sample}>Sample</span>
      </p>
      <div className={css.track}>
        <div className={css.rail} aria-hidden="true">
          <motion.div className={css.railFill} style={{ scaleY: fill }} />
        </div>
        <ol className={css.nodes} aria-label={`Season timeline, ${SEASON_LABEL}`}>
          {events.map((event, i) => {
            const firstOfMonth = i === 0 || events[i - 1]?.month !== event.month;
            const state = i < index ? "past" : i === index ? "active" : "next";
            return (
              <li key={event.id} className={css.nodeItem}>
                <span className={css.month} aria-hidden="true">
                  {firstOfMonth ? monthLabel(event.month) : ""}
                </span>
                <button
                  type="button"
                  className={css.node}
                  data-state={state}
                  aria-current={i === index ? "step" : undefined}
                  onClick={() => onJump(i)}
                >
                  <span className={css.dot} aria-hidden="true">
                    {state === "past" ? <Tick className={css.tick} /> : null}
                  </span>
                  <span className={css.nodeText}>
                    <span className={css.nodeName}>{event.name}</span>
                    <span className={css.nodeDate}>{event.date}</span>
                  </span>
                  {state === "past" ? <span className={site.srOnly}>, done</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
