"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import { count, istStamp } from "@/lib/format";
import { readChain } from "@/lib/proofChain";
import type { ProofBundle, ProofOverview } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";
import o from "@/app/(owner)/(screens)/pro/pro.module.css";

/** Plain words for a bundle's chain status ("written" is read as "sent"). */
function bundleStatus(b: ProofBundle): string {
  if (b.chain_status === "verified") return "Verified";
  if (b.chain_status === "sent" || b.chain_status === "written") return "Sent, waiting to verify";
  if (b.chain_status === "failed") return "Write failed, kept on Seedha";
  return "Kept on Seedha";
}

/** Pro card "proof": consents proven, pending, and the latest bundle, from GET /proof. */
export function ProofView() {
  const proof = useApi<ProofOverview>("proof");
  if (proof.error) {
    return <ErrorState message={proof.error.message} code={proof.error.code} onRetry={proof.reload} />;
  }
  if (!proof.data) return <Loading rows={1} label="Loading proof" />;
  const p = proof.data;
  const latest = p.bundles[0];
  const chain = readChain(p);
  return (
    <div className={o.view}>
      <dl className={o.stats}>
        <div className={o.stat}>
          <dt className={o.statLabel}>Proven</dt>
          <dd className={o.statValue}>{count(p.proven)}</dd>
        </div>
        <div className={o.stat}>
          <dt className={o.statLabel}>Waiting for tonight</dt>
          <dd className={o.statValue}>{count(p.pending)}</dd>
        </div>
        <div className={o.stat}>
          <dt className={o.statLabel}>Latest bundle</dt>
          <dd className={o.statValue} style={{ fontSize: 17 }}>
            {latest ? bundleStatus(latest) : "None yet"}
          </dd>
          {latest ? (
            <dd className={o.statSub}>
              {istStamp(latest.created_at)}, {count(latest.item_count)} consent
              {latest.item_count === 1 ? "" : "s"}
            </dd>
          ) : null}
        </div>
      </dl>
      <p className={o.vNote}>
        Only salted fingerprints are sealed, never a guest&apos;s name or number.{" "}
        {chain.mode === "amoy" ? `Roots go to ${chain.network_label}.` : "Roots are kept on Seedha's server."}
      </p>
      <Link className={o.vLink} href="/proof">
        Open Proof
      </Link>
    </div>
  );
}
