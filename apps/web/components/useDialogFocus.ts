"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour for a dialog while it is open: focus moves into it,
 * Tab stays inside it, Escape closes it, and focus returns to whatever was
 * focused before it opened.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  // Callers pass inline arrows; keep the latest without re-running the effect.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    (items()[0] ?? dialog).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      const first = list[0];
      const last = list.at(-1);
      if (!first || !last) return;
      // Focus can leave through a click on the dialog's padding or backdrop:
      // bring it back instead of letting Tab walk the page behind (review A9).
      if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus();
    };
  }, [ref, open]);
}
