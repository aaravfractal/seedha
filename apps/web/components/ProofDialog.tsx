"use client";

import { useRef } from "react";
import { useApi } from "@/lib/api";
import { bundleStatus, dialogChainText, linkHost } from "@/lib/proofChain";
import type { ConsentProof } from "@/lib/types";
import { useToast } from "./Toast";
import { ErrorState, Loading } from "./States";
import { useDialogFocus } from "./useDialogFocus";
import { Chip } from "./owner/ui";
import { istStamp, proofStatus, shortHash } from "./owner/proofStatus";
import d from "./owner/proofDialog.module.css";

function copy(p: ConsentProof): { title: string; body: string } {
  if (p.status === "erased") {
    return {
      title: "Consent deleted",
      body: "This consent was erased after the guest asked. Its fingerprint stays in the sealed bundle, but nothing links it to anyone now.",
    };
  }
  if (p.status === "mismatch") {
    return {
      title: "Record changed after sealing",
      body: `${p.guest_name}'s consent record no longer hashes to the fingerprint sealed in its bundle. Messages to this guest are blocked until you check it.`,
    };
  }
  if (p.bundle && p.matches) {
    return {
      title: "Consent verified",
      body: `${p.guest_name} said yes at the front desk. The record still hashes to the fingerprint sealed in the bundle, so it has not been changed.`,
    };
  }
  return {
    title: "Waiting for tonight's bundle",
    body: `${p.guest_name} said yes at the front desk. The fingerprint is sealed into tonight's bundle at 9 PM.`,
  };
}

/** One consent's proof, re-checked against its bundle right now. */
export function ProofDialog({ consentId, onClose }: { consentId: number; onClose: () => void }) {
  const proof = useApi<ConsentProof>(`proof/consents/${consentId}`);
  const toast = useToast();
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, true, onClose);

  const p = proof.data;
  const status = p
    ? proofStatus(p.status === "verified" && p.matches === false ? "mismatch" : p.status)
    : null;
  const text = p ? copy(p) : null;
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        tabIndex={-1}
        className={`dlg ${d.dlg}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proofTitle"
      >
        {proof.error ? (
          <>
            <h2 id="proofTitle" className={d.title}>
              Consent proof
            </h2>
            <ErrorState message={proof.error.message} code={proof.error.code} onRetry={proof.reload} />
            <div className={d.actions}>
              <button type="button" className="btn small" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : !p || !status || !text ? (
          <>
            <h2 id="proofTitle" className={d.title}>
              Consent proof
            </h2>
            <Loading rows={2} label="Checking the proof" />
          </>
        ) : (
          <>
            <Chip tone={status.tone} dot>
              {status.label}
            </Chip>
            <h2 id="proofTitle" className={d.title}>
              {text.title}
            </h2>
            <p className={d.body}>{text.body}</p>
            <dl className={d.rows}>
              <dt>Guest</dt>
              <dd>{p.status === "erased" ? "Deleted" : p.guest_name}</dd>
              <dt>Given</dt>
              <dd>{istStamp(p.given_at)}</dd>
              <dt>Bundle</dt>
              <dd>
                {p.bundle
                  ? `${istStamp(p.bundle.created_at)} · root ${shortHash(p.bundle.merkle_root)}`
                  : "Not sealed yet"}
              </dd>
              {p.bundle ? (
                <>
                  <dt>Root</dt>
                  <dd>{bundleStatus(p.bundle).label}</dd>
                </>
              ) : null}
              <dt>Fingerprint</dt>
              <dd className={d.mono}>{shortHash(p.fingerprint)}</dd>
            </dl>
            <p className={d.chain}>{dialogChainText(p.bundle)}</p>
            <div className={d.actions}>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(p.fingerprint).catch(() => undefined);
                  toast("Fingerprint copied");
                }}
              >
                Copy fingerprint
              </button>
              {p.bundle?.explorer_url && linkHost(p.bundle.explorer_url) ? (
                <a
                  className="btn small ghost"
                  href={p.bundle.explorer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Amoy explorer ({linkHost(p.bundle.explorer_url)})
                </a>
              ) : null}
              <button type="button" className={`btn small ${d.done}`} onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
