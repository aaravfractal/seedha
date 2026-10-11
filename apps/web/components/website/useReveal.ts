"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { useSeenOnce } from "./hooks";

/**
 * Rise-once reveal for the upgrade sections. Content is only hidden after the
 * page hydrates, so it stays readable without JavaScript, and it shows as soon
 * as it is first seen. Reduced motion is handled in upgrade.module.css.
 */
export function useReveal<T extends Element>(): [RefObject<T | null>, boolean] {
  const [ref, seen] = useSeenOnce<T>();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrated: allow the hidden start state
    setArmed(true);
  }, []);
  return [ref, armed && !seen];
}
