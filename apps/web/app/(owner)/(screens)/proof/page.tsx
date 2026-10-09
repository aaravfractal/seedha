"use client";

import { useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { count } from "@/lib/format";
import type { Messages, ProofOverview } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";
import { ProofDialog } from "@/components/ProofDialog";
import { useToast } from "@/components/Toast";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default function ProofPage() {
  const proof = useApi<ProofOverview>("proof");
  const messages = useApi<Messages>("messages");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  async function bundle() {
    setBusy(true);
    try {
      const result = await postJson<ProofOverview>("proof/bundle");
      proof.setData(result);
      messages.reload();
      toast(`Tonight's proof written. ${result.bundles[0]?.item_count ?? 0} consents verified`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not write the proof");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <>
      <h2 className="title">Every yes, provable.</h2>
      <p className="sub">
        Each consent becomes a fingerprint. Every night the fingerprints are written to a record that nobody
        can change.
      </p>
    </>
  );
  if (proof.error) {
    return (
      <>
        {header}
        <ErrorState message={proof.error.message} code={proof.error.code} onRetry={proof.reload} />
      </>
    );
  }
  if (!proof.data) {
    return (
      <>
        {header}
        <Loading rows={2} label="Loading proofs" />
      </>
    );
  }
  const p = proof.data;
  const consents = new Map((messages.data?.messages ?? []).map((m) => [m.consent_id, m.guest_name]));
  return (
    <>
      {header}
      <div className="stats" style={{ margin: "0 0 16px" }}>
        <div className="stat">
          <b className="num">{count(p.consents_this_month)}</b>
          <span>consents this month</span>
        </div>
        <div className="stat">
          <b className="num" style={{ color: "var(--gain)" }}>
            {count(p.proven)}
          </b>
          <span>proven</span>
        </div>
        <div className="stat">
          <b className="num">{count(p.pending)}</b>
          <span>pending tonight</span>
        </div>
      </div>
      <button type="button" className="btn" disabled={busy || p.pending === 0} onClick={bundle}>
        {p.pending === 0 ? "Nothing new to prove tonight" : "Write tonight's proof"}
      </button>
      {!p.chain_live ? (
        <p className="calc">
          Simulated chain: roots are stored and checked by Seedha. Add Polygon Amoy testnet keys to publish
          them.
        </p>
      ) : null}
      <div className="card" style={{ marginTop: 16 }}>
        {p.bundles.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>
            No bundles yet. Consents from the Desk are bundled each night at 12:00 AM.
          </p>
        ) : (
          p.bundles.map((b) => (
            <div className="item" key={b.id}>
              <div>
                <b>{when(b.created_at)}</b>
                <div className="meta">
                  Bundle of {count(b.item_count)} consent{b.item_count === 1 ? "" : "s"} · root{" "}
                  <span className="mono">
                    {b.merkle_root.slice(0, 8)}…{b.merkle_root.slice(-6)}
                  </span>
                </div>
              </div>
              <span className="tag ok">{b.chain_tx ? "✓ On chain" : "✓ Verified"}</span>
            </div>
          ))
        )}
      </div>
      {consents.size > 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="sub-title">Check a consent</h3>
          <div className="chips">
            {[...consents.entries()].map(([id, name]) => (
              <button key={id} type="button" className="chip" onClick={() => setOpen(id)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="calc">
        Only a fingerprint is public. No name, phone or booking detail is ever stored on the blockchain.
        Monthly statement summaries can be proven the same way.
      </p>
      {open !== null ? <ProofDialog consentId={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
