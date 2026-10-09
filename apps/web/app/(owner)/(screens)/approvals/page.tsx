"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { Messages, WinbackMessage } from "@/lib/types";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { ProofDialog } from "@/components/ProofDialog";

function deskTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

const STATUS_TAG: Record<string, [string, string]> = {
  sent: ["ok", "Sent"],
  rejected: ["", "Rejected"],
  blocked: ["bad", "Opted out (STOP)"],
  failed: ["bad", "Not sent"],
};

export default function ApprovalsPage() {
  const messages = useApi<Messages>("messages");
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const [proofFor, setProofFor] = useState<number | null>(null);

  async function act(m: WinbackMessage, action: "approve" | "reject" | "simulate-reply", note: string) {
    setBusy(m.id);
    try {
      const body = action === "simulate-reply" ? { text: "STOP" } : undefined;
      messages.setData(await postJson<Messages>(`messages/${m.id}/${action}`, body));
      toast(note);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work");
      messages.reload();
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <>
      <h2 className="title">Messages waiting for you.</h2>
      <p className="sub">
        Seedha drafts a thank-you with a perk for guests who said yes at the Desk. Nothing is sent until you
        approve.
      </p>
    </>
  );
  if (messages.error) {
    return (
      <>
        {header}
        <ErrorState message={messages.error.message} code={messages.error.code} onRetry={messages.reload} />
      </>
    );
  }
  if (!messages.data) {
    return (
      <>
        {header}
        <Loading rows={2} label="Loading drafts" />
      </>
    );
  }
  const data = messages.data;
  if (data.messages.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="No messages waiting"
          action={
            <Link className="btn small" href="/desk">
              Go to Desk
            </Link>
          }
        >
          Drafts appear after a guest says yes at the Desk and checks out.
        </EmptyState>
      </>
    );
  }
  return (
    <>
      {header}
      {data.simulated ? (
        <p className="tag sim" style={{ marginBottom: 12 }}>
          Simulated WhatsApp: approved messages are logged, not delivered. Add WhatsApp keys to send for real.
        </p>
      ) : null}
      <div className="card">
        {data.messages.map((m) => {
          const tag = STATUS_TAG[m.status];
          return (
            <div className="item" style={{ gridTemplateColumns: "1fr" }} key={m.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <b>{m.guest_name}</b>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="tag ok">Consent {deskTime(m.consent_given_at)} at Desk</span>
                  <span className={`tag${m.proof_status === "verified" ? " ok" : ""}`}>
                    {m.proof_status === "verified" ? "✓ Verified" : "◷ Pending proof"}
                  </span>
                  {tag ? <span className={`tag ${tag[0]}`}>{tag[1]}</span> : null}
                </span>
              </div>
              <div className={`bub ${m.status === "sent" ? "me" : "bot"}`} style={{ maxWidth: "100%" }}>
                {m.body}
                {m.status === "sent" ? (
                  <span className="foot">Sent{m.transport === "simulated" ? " (simulated)" : ""}</span>
                ) : null}
              </div>
              {m.status === "draft" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn small"
                    disabled={busy === m.id}
                    onClick={() => act(m, "approve", "Sent on WhatsApp")}
                  >
                    Approve and send
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    disabled={busy === m.id}
                    onClick={() => act(m, "reject", "Draft removed")}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
              {m.status === "sent" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link
                    className="btn small ghost"
                    href={`/link/${m.perk_code}`}
                    target="_blank"
                    rel="noopener"
                  >
                    Open as guest
                  </Link>
                  {m.consent_active ? (
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={busy === m.id}
                      onClick={() => act(m, "simulate-reply", "Guest replied STOP. No more messages.")}
                    >
                      Simulate guest reply STOP (sample)
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="calc">
        Only guests who ticked yes at the Desk appear here. Guests found through OTA data are never messaged.
      </p>
      {proofFor !== null ? <ProofDialog consentId={proofFor} onClose={() => setProofFor(null)} /> : null}
    </>
  );
}
