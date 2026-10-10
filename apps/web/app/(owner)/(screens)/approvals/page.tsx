"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import type { OwnerMessage, OwnerMessages } from "@/lib/types-owner";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { ProofDialog } from "@/components/ProofDialog";
import { Chip, Screen, ui } from "@/components/owner/ui";
import { STOP_LINE, editProblem } from "@/lib/draftRules";
import a from "./approvals.module.css";

const TITLE = "Messages waiting for you.";
const SUB =
  "Seedha drafts a thank-you with a perk for guests who said yes at the Desk. Nothing is sent until you approve.";

const STATUS_CHIP: Record<string, { tone: "ok" | "bad" | "plain"; label: string }> = {
  sent: { tone: "ok", label: "Sent" },
  rejected: { tone: "plain", label: "Rejected" },
  blocked: { tone: "bad", label: "Opted out (STOP)" },
  failed: { tone: "bad", label: "Not sent" },
};

/** "7:42 PM at Desk, 14 Jun 2026" in India time. */
function deskStamp(iso: string): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const day = at.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  return `${time} at Desk, ${day}`;
}

export default function ApprovalsPage() {
  const messages = useApi<OwnerMessages>("messages");
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const [bundling, setBundling] = useState(false);
  const [proofFor, setProofFor] = useState<number | null>(null);

  async function act(m: OwnerMessage, action: "approve" | "reject" | "simulate-reply", note: string) {
    setBusy(m.id);
    try {
      const body = action === "simulate-reply" ? { text: "STOP" } : undefined;
      messages.setData(await postJson<OwnerMessages>(`messages/${m.id}/${action}`, body));
      toast(note);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work");
      messages.reload();
    } finally {
      setBusy(null);
    }
  }

  async function save(m: OwnerMessage, text: string): Promise<string | null> {
    setBusy(m.id);
    try {
      messages.setData(
        await api<OwnerMessages>(`messages/${m.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        }),
      );
      toast("Draft saved. Nothing was sent.");
      return null;
    } catch (err) {
      return err instanceof ApiError ? err.message : "Could not save that";
    } finally {
      setBusy(null);
    }
  }

  async function writeBundle() {
    setBundling(true);
    try {
      await postJson("proof/bundle");
      messages.reload();
      toast("Tonight's bundle written. Consents verified.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not write the bundle");
    } finally {
      setBundling(false);
    }
  }

  if (messages.error) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <ErrorState message={messages.error.message} code={messages.error.code} onRetry={messages.reload} />
      </Screen>
    );
  }
  if (!messages.data) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <Loading rows={2} label="Loading drafts" />
      </Screen>
    );
  }
  const data = messages.data;
  if (data.messages.length === 0) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <EmptyState
          title="No guests waiting."
          action={
            <Link className="btn small" href="/desk">
              Open Seedha Desk
            </Link>
          }
        >
          New drafts appear after checkout.
        </EmptyState>
      </Screen>
    );
  }
  return (
    <Screen title={TITLE} sub={SUB}>
      {data.simulated ? (
        <p className={a.notice}>
          <Chip tone="sample">Simulated WhatsApp</Chip>{" "}
          <span className={ui.muted}>
            Approved messages are logged, not delivered, until WhatsApp keys are added.
          </span>
        </p>
      ) : null}
      <div className={a.list}>
        {data.messages.map((m) => (
          <Draft
            key={m.id}
            message={m}
            busy={busy === m.id}
            bundling={bundling}
            onAct={act}
            onSave={save}
            onBundle={writeBundle}
            onProof={() => setProofFor(m.consent_id)}
          />
        ))}
      </div>
      <p className={ui.calc}>
        Only guests who ticked yes at the Desk appear here. Guests found through OTA data are never messaged.
      </p>
      {proofFor !== null ? <ProofDialog consentId={proofFor} onClose={() => setProofFor(null)} /> : null}
    </Screen>
  );
}

function Draft({
  message: m,
  busy,
  bundling,
  onAct,
  onSave,
  onBundle,
  onProof,
}: {
  message: OwnerMessage;
  busy: boolean;
  bundling: boolean;
  onAct: (m: OwnerMessage, action: "approve" | "reject" | "simulate-reply", note: string) => void;
  onSave: (m: OwnerMessage, text: string) => Promise<string | null>;
  onBundle: () => void;
  onProof: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body);
  const [problem, setProblem] = useState<string | null>(null);
  const fieldId = useId();
  const status = STATUS_CHIP[m.status];
  const verified = m.proof_status === "verified";
  const proofLabel = verified ? "Verified" : m.proof_status === "erased" ? "Deleted" : "Pending proof";

  async function submit() {
    const local = editProblem(text, m.perk_code, m.link);
    if (local) {
      setProblem(local);
      return;
    }
    const remote = await onSave(m, text);
    setProblem(remote);
    if (!remote) setEditing(false);
  }

  return (
    <article className={ui.card} aria-label={`Draft for ${m.guest_name}`}>
      <div className={a.top}>
        <h2 className={a.name}>{m.guest_name}</h2>
        <div className={a.badges}>
          <Chip tone="ok">
            <span aria-hidden="true">✓</span> Consent {deskStamp(m.consent_given_at)}
          </Chip>
          <button
            type="button"
            className={`${a.proof} ${verified ? a.verified : ""}`}
            onClick={onProof}
            aria-label={`${proofLabel}. Open consent proof`}
          >
            <i className={a.dot} aria-hidden="true" />
            {proofLabel}
          </button>
          {status ? <Chip tone={status.tone}>{status.label}</Chip> : null}
        </div>
      </div>

      {m.proof_status === "pending" && m.status === "draft" ? (
        <div className={a.bundle}>
          <span>Consent proof is written in tonight&apos;s bundle at 9 PM.</span>
          <button type="button" className={ui.linkBtn} disabled={bundling} onClick={onBundle}>
            Write tonight&apos;s bundle
          </button>
        </div>
      ) : null}

      <div className={a.meta}>
        <Chip>{m.language}</Chip>
        <Chip>Perk: {m.perk}</Chip>
        <Chip>Code {m.perk_code}</Chip>
      </div>

      {editing ? (
        <div className={a.editor}>
          <label className={ui.muted} htmlFor={fieldId}>
            Message to {m.short_name}
          </label>
          <textarea
            id={fieldId}
            className={a.textarea}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setProblem(null);
            }}
            aria-invalid={problem !== null}
            aria-describedby={`${fieldId}-hint${problem ? ` ${fieldId}-err` : ""}`}
            maxLength={2000}
          />
          <p className={a.hint} id={`${fieldId}-hint`}>
            Keep the code, the link and &quot;{STOP_LINE}&quot;. Saving never sends.
          </p>
          {problem ? (
            <p className={a.error} id={`${fieldId}-err`} role="alert">
              {problem}
            </p>
          ) : null}
          <div className={ui.actions}>
            <button type="button" className="btn small" disabled={busy} onClick={() => void submit()}>
              Save draft
            </button>
            <button
              type="button"
              className="btn small ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setText(m.body);
                setProblem(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={a.preview}>
          <p className={a.previewLabel}>WhatsApp preview</p>
          <div className={`bub ${m.status === "sent" ? "me" : "bot"}`}>
            {m.body}
            {m.status === "sent" ? (
              <span className="foot">Sent{m.transport === "simulated" ? " (simulated)" : ""}</span>
            ) : null}
          </div>
        </div>
      )}

      {m.status === "draft" && !editing ? (
        <div className={ui.actions}>
          <button
            type="button"
            className="btn small"
            disabled={busy}
            onClick={() => onAct(m, "approve", "Sent on WhatsApp")}
          >
            Approve and send
          </button>
          <button
            type="button"
            className="btn small ghost"
            disabled={busy}
            onClick={() => {
              setText(m.body);
              setEditing(true);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn small ghost"
            disabled={busy}
            onClick={() => onAct(m, "reject", "Draft removed")}
          >
            Reject
          </button>
        </div>
      ) : null}
      {m.status === "sent" ? (
        <div className={ui.actions}>
          <Link className="btn small ghost" href={`/link/${m.perk_code}`} target="_blank" rel="noopener">
            Open as guest
          </Link>
          {m.consent_active ? (
            <button
              type="button"
              className="btn small ghost"
              disabled={busy}
              onClick={() => onAct(m, "simulate-reply", "Guest replied STOP. No more messages.")}
            >
              Simulate guest reply STOP (sample)
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
