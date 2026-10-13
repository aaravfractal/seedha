"use client";

import type { ThreadDetail } from "@/lib/types-inbox";
import { avatarFill, dateTime, initials, shortDate } from "./format";
import styles from "./Inbox.module.css";

/** Save what Seedha holds about this guest as a JSON file (no phone number is ever returned). */
function exportGuest(detail: ThreadDetail) {
  const data = {
    exported_at: new Date().toISOString(),
    note: "Data Seedha holds for this guest. The WhatsApp number is stored only on the consent and is not exported.",
    profile: detail.profile,
    messages: detail.messages.map((m) => ({
      at: m.at,
      direction: m.direction,
      sent_by: m.sent_by,
      body: m.body,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seedha-guest-${detail.thread.consent_id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Right column (or slide-over below 1180px): consent, memory, stays, export, forget. */
export function Profile({
  detail,
  open,
  onClose,
  onForget,
}: {
  detail: ThreadDetail;
  open: boolean;
  onClose: () => void;
  onForget: () => void;
}) {
  const p = detail.profile;
  const id = detail.thread.consent_id;
  const verified = p.proof_status === "verified";
  return (
    <aside className={styles.profile} data-open={open} aria-label={`About ${p.guest_name}`} id="guestProfile">
      <div className={styles.profileTop}>
        <span
          className={`${styles.avatar} ${styles.big}`}
          style={{ background: avatarFill(id) }}
          aria-hidden="true"
        >
          {initials(p.guest_name)}
        </span>
        <div>
          <strong>{p.guest_name}</strong>
          <span>{p.city ?? "City not recorded"}</span>
        </div>
        <button type="button" className={styles.close} aria-label="Close guest details" onClick={onClose}>
          ×
        </button>
      </div>

      <section className={styles.block} aria-labelledby="consentHead">
        <div className={styles.blockHead}>
          <h4 id="consentHead">Consent</h4>
          <span className={`tag ${verified ? "ok" : ""}`}>{verified ? "✓ Verified" : "◷ Pending proof"}</span>
        </div>
        <div className={styles.kv}>
          <span>Said yes at the front desk</span>
          <span>{dateTime(p.consent_given_at)}</span>
        </div>
        <p className={styles.note}>Messages only while this consent stands. STOP ends it at once.</p>
      </section>

      <section className={styles.block} aria-labelledby="memHead">
        <div className={styles.blockHead}>
          <h4 id="memHead">What Seedha remembers</h4>
          <button type="button" className={styles.textBtn} onClick={onForget}>
            Forget
          </button>
        </div>
        <div className={styles.kv}>
          <span>Consent given</span>
          <span>{shortDate(p.consent_given_at.slice(0, 10))}</span>
        </div>
        <div className={styles.kv}>
          <span>Language</span>
          <span>{p.language ?? "Not recorded"}</span>
        </div>
        <div className={styles.kv}>
          <span>Perk code</span>
          <span>{p.perk_code ?? "After checkout"}</span>
        </div>
        <div className={styles.kv}>
          <span>Stays on record</span>
          <span>{p.stays_count}</span>
        </div>
        <div className={styles.kv}>
          <span>Last invoice</span>
          <span>{p.last_invoice ?? "None yet"}</span>
        </div>
        {p.remembers.length ? (
          <ul className={styles.memory} aria-label="Preferences">
            {p.remembers.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>No preferences saved yet.</p>
        )}
      </section>

      <section className={styles.block} aria-labelledby="notesHead">
        <div className={styles.blockHead}>
          <h4 id="notesHead">Notes</h4>
        </div>
        {p.notes.length ? (
          <ul className={styles.memory}>
            {p.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>No notes.</p>
        )}
      </section>

      <section className={styles.block} aria-labelledby="staysHead">
        <div className={styles.blockHead}>
          <h4 id="staysHead">Stays</h4>
        </div>
        {p.stays.length === 0 ? (
          <p className={styles.note}>No stays on record.</p>
        ) : (
          <ul className={styles.stays}>
            {p.stays.map((s) => (
              <li key={`${s.check_in}-${s.channel}`}>
                {shortDate(s.check_in)} · {s.nights} {s.nights === 1 ? "night" : "nights"}
                <span>
                  {s.channel}
                  {s.room_type ? ` · ${s.room_type}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.block}>
        <button type="button" className={styles.textBtn} onClick={() => exportGuest(detail)}>
          Export this guest&apos;s data
        </button>
        <button type="button" className={styles.danger} onClick={onForget}>
          Forget this guest
        </button>
      </section>
    </aside>
  );
}
