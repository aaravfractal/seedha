"use client";

import { useId, useRef } from "react";
import type { ReactNode } from "react";
import { useDialogFocus } from "@/components/useDialogFocus";
import s from "./settings.module.css";

/**
 * A modal sheet (phone: rises from the bottom; wider: centred). aria-modal,
 * focus kept inside, Escape and the scrim close it. `alert` uses
 * role=alertdialog for confirm steps.
 */
export function Modal({
  title,
  onClose,
  children,
  alert = false,
  describedBy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  alert?: boolean;
  /** Id of the body text, read out with the title when the dialog opens. */
  describedBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(ref, true, onClose);
  return (
    <div className={s.scrim} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        className={s.sheet}
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
      >
        <h2 id={titleId} className={s.sheetTitle}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** "Payments open after launch": the only thing Billing's pay buttons open (D7). */
export function LaunchSheet({ onClose, what }: { onClose: () => void; what: string }) {
  return (
    <Modal title="Payments open after launch." onClose={onClose}>
      <p className={s.sheetBody}>
        {what} Seedha does not take payments in this early build, so there is nothing to enter here. UPI
        AutoPay and cards are planned.
      </p>
      <p className={s.sheetNote}>Seedha never asks for a card number, CVV or bank login on this screen.</p>
      <div className={s.sheetActions}>
        <button type="button" className="btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
