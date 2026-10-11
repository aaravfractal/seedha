"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, postJson } from "@/lib/api";
import type { SimulatedIncoming } from "@/lib/types-inbox";
import { useToast } from "@/components/Toast";
import s from "./settings.module.css";

/**
 * Sample hotel demo tool: one realistic guest message from a fixed rotating
 * set arrives in the inbox, through the same path as a WhatsApp message.
 * Nothing is sent to anyone; the owner still reads, edits and sends.
 */
export function SimulateMessage() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SimulatedIncoming | null>(null);

  async function simulate() {
    setBusy(true);
    try {
      const got = await postJson<SimulatedIncoming>("inbox/simulate");
      setLast(got);
      toast(`New message from ${got.guest_name}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>Guest inbox demo</h2>
      </div>
      <div className={s.list}>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Simulate incoming message</span>
            <span className={s.rowHint}>
              {last ? (
                <>
                  {last.guest_name} wrote.{" "}
                  <Link className="link" href={`/inbox?thread=${last.consent_id}`}>
                    Open the conversation
                  </Link>
                </>
              ) : (
                "A sample guest writes to you on WhatsApp, so the inbox is never empty in a demo."
              )}
            </span>
          </span>
          <button type="button" className="btn small" disabled={busy} onClick={() => void simulate()}>
            {busy ? "Adding" : "Simulate"}
          </button>
        </div>
      </div>
    </>
  );
}
