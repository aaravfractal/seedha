"use client";

import { useEffect, useRef, useState } from "react";
import css from "./pulse-story.module.css";

const STEP_MS = 3000;
const STOP_EVENTS = ["pointerdown", "wheel", "keydown", "touchstart"] as const;

/**
 * "Play season": moves to the next event every 3 seconds. Stops on any user
 * input or at the last event. Never starts on its own; the section does not
 * render it under reduced motion.
 */
export function PlaySeason({
  index,
  total,
  onGo,
}: {
  index: number;
  total: number;
  onGo: (index: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const latest = useRef({ index, onGo });
  useEffect(() => {
    latest.current = { index, onGo };
  });

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const next = latest.current.index + 1;
      if (next < total) latest.current.onGo(next);
      if (next >= total - 1) setPlaying(false);
    }, STEP_MS);
    const stop = (e: Event) => {
      // The button's own press toggles it; let that click decide.
      const own = e.target instanceof Node && button.current?.contains(e.target);
      if (own && (e.type !== "keydown" || ["Enter", " "].includes((e as KeyboardEvent).key))) return;
      setPlaying(false);
    };
    const options = { capture: true, passive: true } as const;
    for (const type of STOP_EVENTS) window.addEventListener(type, stop, options);
    return () => {
      window.clearInterval(timer);
      for (const type of STOP_EVENTS) window.removeEventListener(type, stop, options);
    };
  }, [playing, total]);

  const toggle = () => {
    if (!playing && index >= total - 1) onGo(0);
    setPlaying(!playing);
  };

  return (
    <button ref={button} type="button" className={css.play} aria-pressed={playing} onClick={toggle}>
      <svg className={css.playIcon} viewBox="0 0 16 16" aria-hidden="true">
        {playing ? (
          <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
        ) : (
          <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
        )}
      </svg>
      Play season
    </button>
  );
}
