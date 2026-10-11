"use client";

import { useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { PulseEvent } from "@/lib/pulse";
import { DecisionCard } from "./DecisionCard";
import { PlaySeason } from "./PlaySeason";
import { keyIndex, useReservedHeight } from "./storyHooks";
import { Timeline } from "./Timeline";
import css from "./pulse-story.module.css";

/** The sticky panel sits this far below the viewport top (64px header + gap). */
const PIN_TOP = 72;
/** A programmatic jump owns the index until the scroll lands, or this long. */
const LOCK_MS = 1500;

/**
 * Desktop season story. A tall wrapper (about one viewport per event) holds a
 * sticky panel; native scroll drives progress through useScroll, and the
 * active event derives from that progress. Jumps scroll the window to the
 * event's position so scroll and state never disagree.
 */
export function ScrollStory({
  events,
  index,
  onIndex,
}: {
  events: readonly PulseEvent[];
  index: number;
  onIndex: (index: number) => void;
}) {
  const total = events.length;
  const wrapper = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const lock = useRef<{ target: number; until: number } | null>(null);
  useReservedHeight(slot);

  const { scrollYProgress } = useScroll({ target: wrapper, offset: [`start ${PIN_TOP}px`, "end end"] });
  // Event i starts at progress i/total; the line reaches node i at that moment.
  const fill = useTransform(scrollYProgress, [0, (total - 1) / total], [0, 1], { clamp: true });

  const fromProgress = useCallback(
    (p: number) => Math.min(total - 1, Math.max(0, Math.floor(p * total))),
    [total],
  );

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = fromProgress(p);
    const held = lock.current;
    if (held) {
      if (next !== held.target && performance.now() < held.until) return;
      lock.current = null;
    }
    onIndex(next);
  });

  // Mounted mid-story (reload, resize into desktop): take the index from scroll.
  useEffect(() => {
    const p = scrollYProgress.get();
    if (p > 0) onIndex(fromProgress(p));
  }, [scrollYProgress, fromProgress, onIndex]);

  // A wheel or touch during a smooth jump hands control back to the scroll.
  useEffect(() => {
    const release = () => {
      lock.current = null;
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
    };
  }, []);

  const jump = useCallback(
    (i: number) => {
      const node = wrapper.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top + window.scrollY;
      const start = top - PIN_TOP;
      const end = top + node.offsetHeight - window.innerHeight;
      const target = start + ((i + 0.5) / total) * Math.max(0, end - start);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      lock.current = { target: i, until: performance.now() + LOCK_MS };
      onIndex(i);
      window.scrollTo({ top: Math.round(target), behavior: reduce ? "auto" : "smooth" });
    },
    [onIndex, total],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = keyIndex(e.key, index, total, false);
    if (next === null) return;
    e.preventDefault();
    if (next !== index) jump(next);
  };

  const event = events[index];
  if (!event) return null;
  return (
    <div ref={wrapper} className={css.story} style={{ "--steps": total } as CSSProperties}>
      <div
        className={css.panel}
        role="group"
        aria-label="Season story. Arrow keys move between events."
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div className={css.side}>
          <Timeline events={events} index={index} fill={fill} onJump={jump} />
          <PlaySeason index={index} total={total} onGo={jump} />
        </div>
        <div ref={slot} className={css.cardSlot} data-pulse-card="">
          <DecisionCard event={event} index={index} total={total} reducedMotion={false} />
        </div>
      </div>
    </div>
  );
}
