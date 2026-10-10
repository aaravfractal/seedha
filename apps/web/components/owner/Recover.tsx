"use client";

import { useId, useState } from "react";
import { inr } from "@/lib/format";
import type { Dispute, RecoverData } from "@/lib/types-owner";
import { useToast } from "@/components/Toast";
import { CalcNote } from "./ui";
import r from "./recover.module.css";

/** The two Recover totals. The commission figure is the Seedha Audit figure. */
export function RecoverTotals({ data }: { data: RecoverData }) {
  if (!data.audit_claim && !data.other_claim) return null;
  return (
    <div className={r.totals}>
      <p className={r.total}>
        To claim back: <strong className={r.num}>{inr(data.audit_claim)}</strong> in commission, the same
        figure as Seedha Audit.
      </p>
      {data.other_claim ? (
        <p className={r.total}>
          Payout short: <strong className={r.num}>{inr(data.other_claim)}</strong>, asked for separately.
        </p>
      ) : null}
      <CalcNote>TDS is a tax credit and is never claimed.</CalcNote>
    </div>
  );
}

/** "Draft a dispute": the letter the API filled from the stored row, ready to copy. */
export function DisputeDraft({ dispute }: { dispute: Dispute | undefined }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const panel = useId();
  if (!dispute) return null;
  const claim = dispute.audit_claim + dispute.other_claim;

  async function copy(d: Dispute) {
    try {
      await navigator.clipboard.writeText(`${d.subject}\n\n${d.text}`);
      toast("Dispute copied. Paste it to the channel yourself.");
    } catch {
      toast("Copy did not work here. Select the text and copy it.");
    }
  }

  return (
    <div className={r.wrap}>
      <button
        type="button"
        className="btn small ghost"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide dispute" : "Draft a dispute"}
      </button>
      {open ? (
        <div className={r.panel} id={panel}>
          <p className={r.subject}>{dispute.subject}</p>
          <pre className={r.letter} tabIndex={0} aria-label={`Dispute for booking ${dispute.external_ref}`}>
            {dispute.text}
          </pre>
          <div className={r.actions}>
            <button type="button" className="btn small" onClick={() => void copy(dispute)}>
              Copy dispute
            </button>
            {claim ? <span className={r.claim}>Claim {inr(claim)}</span> : null}
          </div>
          <p className={r.note}>
            Seedha does not send this. Paste it into the {dispute.channel} extranet or email. Drafting a
            dispute does not count the row; it stays out until you decide.
          </p>
        </div>
      ) : null}
    </div>
  );
}
