"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./shell/Shell.module.css";

type ToastFn = (message: string) => void;

/** How long a toast stays up (SCREENS "Toast": 2.8s). */
export const TOAST_MS = 2800;

const ToastContext = createContext<ToastFn>(() => undefined);

/** Graphite pill toast, bottom centre, 2.8s. Announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback<ToastFn>((text) => {
    setMessage(text);
    setShown(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={`toast ${styles.toastPill}${shown ? " show" : ""}`} role="status" aria-live="polite">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastContext);
}
