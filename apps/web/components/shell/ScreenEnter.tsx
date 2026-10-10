"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./Shell.module.css";

/** Fade and rise on every screen change (instant under reduced motion). */
export function ScreenEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={styles.content}>
      {children}
    </div>
  );
}
