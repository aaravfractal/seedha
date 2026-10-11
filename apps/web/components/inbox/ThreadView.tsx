"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { DraftAttach, InboxDraft, InboxEntry, RateLine, ThreadDetail } from "@/lib/types-inbox";
import { awaitingReply, wantsInvoice } from "@/lib/inboxRules";
import { InvoicePanel } from "./InvoicePanel";
import { avatarFill, clock, dayLabel, initials, stayRange } from "./format";
import styles from "./Inbox.module.css";

function bubbleClass(m: InboxEntry): string {
  if (m.direction === "in") return styles.in ?? "";
  return (m.sent_by === "away" ? styles.awayMsg : styles.out) ?? "";
}

function whoLabel(m: InboxEntry): string | null {
  if (m.sent_by === "away") return "Your away message · approved by you";
  if (m.kind === "winback") return "Win-back offer · approved by you";
  return null;
}

/** Messages with day dividers, booking card and typing dots. */
function Stream({ detail, drafting }: { detail: ThreadDetail; drafting: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  const count = detail.messages.length;
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    end.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [count, drafting]);

  const b = detail.booking;
  const days = detail.messages.map((m) => dayLabel(m.at));
  return (
    <div
      className={styles.stream}
      role="log"
      aria-live="polite"
      aria-label={`Conversation with ${detail.thread.guest_name}`}
    >
      {count === 0 ? (
        <p className={styles.divider}>
          No messages yet. The conversation starts when {detail.thread.short_name} writes.
        </p>
      ) : null}
      {detail.messages.map((m, i) => {
        const day = days[i] ?? "";
        const showDay = i === 0 || day !== days[i - 1];
        const who = whoLabel(m);
        return (
          <Fragment key={m.key}>
            {showDay ? <p className={styles.divider}>{day}</p> : null}
            {who ? (
              <p className={`${styles.who} ${m.direction === "out" ? styles.right : ""}`}>{who}</p>
            ) : null}
            <div className={`${styles.bubble} ${bubbleClass(m)}`}>
              <span className="sr-only-text">
                {m.direction === "in" ? `${detail.thread.short_name}: ` : "You: "}
              </span>
              {m.body}
              <span className={styles.time}>{clock(m.at)}</span>
            </div>
          </Fragment>
        );
      })}
      {b ? (
        <div className={styles.booking}>
          <div className={styles.kicker}>{b.kind === "direct" ? "Direct booking" : "Stay with consent"}</div>
          <div className={styles.bookingDates}>{stayRange(b.check_in, b.nights)}</div>
          <p className={styles.bookingSub}>
            {[b.room_type, `${b.nights} ${b.nights === 1 ? "night" : "nights"}`, b.channel]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {b.link ? (
            <a className="link" href={b.link} target="_blank" rel="noreferrer">
              Open Seedha Link
            </a>
          ) : null}
        </div>
      ) : null}
      {drafting ? (
        <div className={styles.typing} role="status" aria-label="Seedha is drafting a suggestion">
          <i />
          <i />
          <i />
        </div>
      ) : null}
      <div ref={end} />
    </div>
  );
}

/** Insert a rate card line (written by code, never AI) into the composer. */
function RateButton({
  lines,
  disabled,
  onPick,
}: {
  lines: RateLine[];
  disabled: boolean;
  onPick: (line: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className={styles.rupeeWrap}>
      <button
        type="button"
        className={styles.rupee}
        aria-label="Insert a rate from your rate card"
        aria-expanded={open}
        aria-controls="rateMenu"
        disabled={disabled || lines.length === 0}
        onClick={() => setOpen(!open)}
      >
        ₹
      </button>
      {open ? (
        <div className={styles.rateMenu} id="rateMenu" ref={menu} role="group" aria-label="Rate card">
          <p>From your rate card. Calculated from your room rates, never AI.</p>
          {lines.map((l) => (
            <button
              key={l.room_type}
              type="button"
              onClick={() => {
                onPick(l.line);
                setOpen(false);
              }}
            >
              {l.line}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Where the stay invoice goes when the guest asked for a bill. The invoice is
 * built by code from the booking row; the AI only wrote the covering text.
 */
function InvoiceSlot({ attach }: { attach: DraftAttach }) {
  const [attached, setAttached] = useState(false);
  return (
    <div
      className={styles.invoiceSlot}
      data-testid="invoice-slot"
      data-consent={attach.consent_id}
      role="group"
      aria-label="Invoice"
    >
      <span className={styles.kicker}>Invoice</span>
      <p>Stay invoice ready to attach</p>
      <InvoicePanel consentId={attach.consent_id} attached={attached} onAttach={() => setAttached(true)} />
      {attached ? (
        <p role="status">Attached. The guest gets the stay invoice with this reply (simulated send).</p>
      ) : null}
    </div>
  );
}

export function ThreadView({
  detail,
  rateCard,
  onBack,
  onInfo,
  infoOpen,
  onSend,
  onDraft,
  onSimulate,
}: {
  detail: ThreadDetail;
  rateCard: RateLine[];
  onBack: () => void;
  onInfo: () => void;
  infoOpen: boolean;
  onSend: (body: string) => Promise<boolean>;
  onDraft: () => Promise<InboxDraft | null>;
  onSimulate: () => void;
}) {
  const t = detail.thread;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftSource, setDraftSource] = useState<"ai" | "template" | null>(null);
  const [attach, setAttach] = useState<DraftAttach | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const drafted = useRef<string | null>(null);
  const can = detail.can_reply;
  const waiting = awaitingReply(detail);

  function fill(value: string) {
    setText(value);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(value.length, value.length);
    });
  }

  function insert(line: string) {
    const el = field.current;
    if (!el) return fill(`${text}${text ? " " : ""}${line}`);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const spacer = before && !before.endsWith(" ") ? " " : "";
    fill(`${before}${spacer}${line}${text.slice(end)}`);
  }

  async function send() {
    const body = text.trim();
    if (!body || sending || !can) return;
    setSending(true);
    const ok = await onSend(body);
    setSending(false);
    if (ok) {
      setText("");
      setDraftSource(null);
      setAttach(null);
    }
  }

  async function draft(focus = true) {
    setDrafting(true);
    const result = await onDraft();
    setDrafting(false);
    if (!result) return;
    if (focus) fill(result.text);
    else setText((current) => current || result.text);
    setDraftSource(result.source);
    setAttach(wantsInvoice(result) ? result.attach : null);
  }

  // Each new guest message gets one suggested draft in the box when the
  // owner opens the thread. A suggestion only: nothing is sent (rule 7).
  useEffect(() => {
    if (waiting === null || drafted.current === waiting) return;
    drafted.current = waiting;
    void draft(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per new guest message
  }, [waiting]);

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  const sub = [
    t.city,
    t.stays > 1 ? "Returning guest" : null,
    `${t.stays} ${t.stays === 1 ? "stay" : "stays"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className={styles.thread} aria-label={`Conversation with ${t.guest_name}`}>
      <header className={styles.threadHead}>
        <button type="button" className={styles.back} aria-label="Back to guests" onClick={onBack}>
          ‹
        </button>
        <span className={styles.avatar} style={{ background: avatarFill(t.consent_id) }} aria-hidden="true">
          {initials(t.guest_name)}
        </span>
        <div className={styles.threadWho}>
          <strong>{t.guest_name}</strong>
          <span>{sub}</span>
        </div>
        <button
          type="button"
          className={styles.info}
          aria-label="Guest details"
          aria-expanded={infoOpen}
          aria-controls="guestProfile"
          onClick={onInfo}
        >
          i
        </button>
      </header>

      <Stream detail={detail} drafting={drafting} />

      <div className={styles.compose}>
        {can ? (
          <div className={styles.suggest} role="group" aria-label="Suggested replies">
            <span className={styles.suggestLabel}>
              <span aria-hidden="true">✦ </span>Suggested
            </span>
            {detail.suggestions.map((s) => (
              <button key={s} type="button" className={styles.suggestion} title={s} onClick={() => fill(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.windowNote}>{detail.reply_note}</p>
        )}
        <div className={styles.botNote}>
          <span>
            <strong>Bot drafts, you send.</strong>{" "}
            {draftSource === "ai"
              ? "AI suggestion in the box. Edit it, then send."
              : draftSource === "template"
                ? "Suggested reply in the box. Edit it, then send."
                : "Nothing goes out until you tap send."}
          </span>
          <button
            type="button"
            className={styles.draftBtn}
            disabled={!can || drafting}
            onClick={() => void draft()}
          >
            <span aria-hidden="true">✦ </span>
            {drafting ? "Drafting" : "Draft with AI"}
          </button>
        </div>
        {attach ? <InvoiceSlot attach={attach} /> : null}
        <div className={styles.composer}>
          <RateButton lines={rateCard} disabled={!can} onPick={insert} />
          <label htmlFor="composer" className="sr-only-text">
            Message to {t.short_name}
          </label>
          <textarea
            id="composer"
            ref={field}
            className={styles.field}
            rows={1}
            value={text}
            disabled={!can}
            maxLength={1000}
            placeholder={can ? "Write a message" : "Replies open when the guest writes"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
          />
          <button
            type="button"
            className={styles.send}
            aria-label="Send"
            disabled={!can || sending || !text.trim()}
            onClick={() => void send()}
          >
            ↑
          </button>
        </div>
        <div className={styles.composeFoot}>
          <span>Prices from your rate card, never AI · every message ends with Reply STOP to opt out</span>
          <button type="button" className={styles.textBtn} onClick={onSimulate}>
            Simulate guest
          </button>
        </div>
      </div>
    </section>
  );
}
