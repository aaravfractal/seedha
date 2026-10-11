"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDialogFocus } from "@/components/useDialogFocus";
import styles from "./Inbox.module.css";

/** A modal dialog shell: aria-modal, focus kept inside, Escape closes, focus returns. */
export function Dialog({
  id,
  title,
  onClose,
  children,
  className,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Extra class on the dialog box (for example a wider sheet). */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true, onClose);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        className={className ? `dlg ${className}` : "dlg"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <h3 id={id} className="sub-title" style={{ fontSize: 24 }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

const STOP_LINE = "Reply STOP to opt out.";

/** The owner writes the away text and approves it before it is saved. */
export function AwayDialog({
  initial,
  busy,
  onSave,
  onClose,
}: {
  initial: string;
  busy: boolean;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial.replace(` ${STOP_LINE}`, ""));
  const [approved, setApproved] = useState(false);
  const ready = approved && text.trim().length > 0 && text.trim().length <= 300;
  return (
    <Dialog id="awayTitle" title="Your away message" onClose={onClose}>
      <p className="sub" style={{ margin: "6px 0 0" }}>
        When you are away, Seedha sends only this message, in your words. It goes only to guests who said yes
        at the Desk and write to you first, at most once a day each.
      </p>
      <label htmlFor="awayText" className="sr-only-text">
        Away message
      </label>
      <textarea
        id="awayText"
        className={styles.dlgText}
        value={text}
        maxLength={300}
        onChange={(e) => {
          setText(e.target.value);
          setApproved(false);
        }}
        placeholder="Namaste. I am away right now and will reply by 8 AM."
      />
      <p className={styles.note}>&quot;{STOP_LINE}&quot; is added at the end.</p>
      <label className={styles.approve}>
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        <span>I wrote this message and approve it for automatic replies.</span>
      </label>
      <div className={styles.dlgActions}>
        <button type="button" className="btn" disabled={!ready || busy} onClick={() => onSave(text.trim())}>
          {busy ? "Saving" : "Approve and turn on"}
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}

/** DPDP erasure confirm. */
export function ForgetDialog({
  name,
  busy,
  onConfirm,
  onClose,
}: {
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog id="forgetTitle" title={`Forget ${name}?`} onClose={onClose}>
      <p className="sub" style={{ margin: "6px 0 0" }}>
        Seedha deletes this guest&apos;s WhatsApp number, the conversation and the consent salt. Their consent
        fingerprint stays in the nightly proof but can no longer be linked to them. You cannot undo this.
      </p>
      <p className={styles.note}>Stays from your statements stay in your ledger without a contact.</p>
      <div className={styles.dlgActions}>
        <button type="button" className={`btn ${styles.dangerSolid}`} disabled={busy} onClick={onConfirm}>
          {busy ? "Forgetting" : "Forget this guest"}
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          Keep
        </button>
      </div>
    </Dialog>
  );
}

/** Demo only: act as the guest writing on WhatsApp. */
export function SimulateDialog({
  name,
  busy,
  onSend,
  onClose,
}: {
  name: string;
  busy: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(
    "Hi. Planning Diwali weekend with the kids. Is a valley view room free on 7 and 8 Nov?",
  );
  return (
    <Dialog id="simTitle" title={`Write as ${name}`} onClose={onClose}>
      <p className="sub" style={{ margin: "6px 0 0" }}>
        Demo: this acts as the guest writing to you on WhatsApp. Nothing leaves Seedha. Sending STOP opts the
        guest out.
      </p>
      <label htmlFor="simText" className="sr-only-text">
        Guest message
      </label>
      <textarea
        id="simText"
        className={styles.dlgText}
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={styles.dlgActions}>
        <button
          type="button"
          className="btn"
          disabled={busy || !text.trim()}
          onClick={() => onSend(text.trim())}
        >
          Send as guest
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => onSend("STOP")}>
          Send STOP
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
