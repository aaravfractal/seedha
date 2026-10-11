"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { stepIndex } from "@/lib/pulse";

/** Width (and a usable height) at which the season story pins. */
export const STORY_QUERY = "(min-width: 980px) and (min-height: 600px)";
export const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** Live media query match. False on the server and during hydration. */
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Index an arrow, Home or End key leads to, or null for any other key.
 * `wrap` steps past the ends; otherwise the index is clamped.
 */
export function keyIndex(key: string, index: number, total: number, wrap: boolean): number | null {
  let step = 0;
  if (key === "ArrowDown" || key === "ArrowRight") step = 1;
  else if (key === "ArrowUp" || key === "ArrowLeft") step = -1;
  else if (key === "Home") return 0;
  else if (key === "End") return total - 1;
  else return null;
  if (wrap) return stepIndex(index, step, total);
  return Math.min(total - 1, Math.max(0, index + step));
}

/**
 * Keeps a slot at the tallest height its content has reached, so swapping
 * cards never shifts what sits below. Resets when the slot width changes.
 */
export function useReservedHeight(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const slot = ref.current;
    if (!slot || typeof ResizeObserver === "undefined") return;
    let width = slot.clientWidth;
    let max = 0;
    const observer = new ResizeObserver(() => {
      if (slot.clientWidth !== width) {
        width = slot.clientWidth;
        max = 0;
        slot.style.minHeight = "";
      }
      const height = slot.offsetHeight;
      if (height > max) {
        max = height;
        slot.style.minHeight = `${height}px`;
      }
    });
    observer.observe(slot);
    return () => observer.disconnect();
  }, [ref]);
}
