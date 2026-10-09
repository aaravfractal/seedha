"use client";

import { useEffect, useRef } from "react";
import { useApi } from "@/lib/api";
import type { ConsentProof } from "@/lib/types";
import { useToast } from "./Toast";
import { Loading } from "./States";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function short(hash: string): string {
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

/** One consent's proof: recorded, fingerprinted, bundled, and re-checked now. */
export function ProofDialog({ consentId, onClose }: { consentId: number; onClose: () => void }) {
  const proof = useApi<ConsentProof>(`proof/consents/${consentId}`);
  const toast = useToast();
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = proof.data;
  const verified = p?.status === "verified" && p.matches === true;
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="proofTitle">
        <h3 id="proofTitle" className="sub-title" style={{ fontSize: 24 }}>
          Consent proof
        </h3>
        {!p ? (
          <Loading rows={2} label="Checking the proof" />
        ) : (
          <>
            <p className="sub" style={{ margin: "6px 0 0" }}>
              {p.status === "erased"
                ? "This consent was erased at the guest's request. Its fingerprint stays in the public record but can no longer be linked to anyone."
                : `${p.guest_name} said yes at the Desk on ${when(p.given_at)}. ${
                    verified
                      ? "This record has not been changed since."
                      : "It will be written to the record tonight."
                  }`}
            </p>
            <ol className="tl">
              <li>
                <span className="dot on" aria-hidden="true">
                  1
                </span>
                <span>
                  Consent recorded at the Desk
                  <br />
                  <span className="meta">{when(p.given_at)}</span>
                </span>
              </li>
              <li>
                <span className="dot on" aria-hidden="true">
                  2
                </span>
                <span>
                  Fingerprint created
                  <br />
                  <span className="mono">{short(p.fingerprint)}</span>
                </span>
              </li>
              <li>
                <span className={`dot${p.bundle ? " on" : ""}`} aria-hidden="true">
                  3
                </span>
                <span>
                  {p.bundle
                    ? p.bundle.chain_tx
                      ? "Written to a public blockchain"
                      : "Bundled under tonight's proof root"
                    : "Waiting for tonight's bundle"}
                  <br />
                  <span className="meta">
                    {p.bundle
                      ? `${when(p.bundle.created_at)} · root ${short(p.bundle.merkle_root)}`
                      : "Scheduled 12:00 AM"}
                  </span>
                </span>
              </li>
            </ol>
            <p
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: verified ? "var(--gain)" : "var(--ink2)",
                margin: "0 0 14px",
              }}
            >
              {verified ? "✓ Matches. Not changed." : "◷ Pending proof"}
            </p>
            {p.bundle && !p.bundle.chain_tx ? (
              <p className="tag sim" style={{ marginBottom: 12 }}>
                Stored by Seedha. Not yet on a public chain (simulated).
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              {p.bundle?.explorer_url ? (
                <a
                  className="btn small ghost"
                  href={p.bundle.explorer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View public record
                </a>
              ) : null}
              <button
                ref={done}
                type="button"
                className="btn small"
                style={{ marginLeft: "auto" }}
                onClick={onClose}
              >
                Done
              </button>
            </div>
            <p className="calc">
              Only a fingerprint is public. No name, phone or booking detail is ever stored on the blockchain.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
