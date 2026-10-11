"use client";

import { useApi } from "@/lib/api";
import { FAUCET_URL, NETWORK, NO_VALUE, formatPol, needsTopUp, readChain } from "@/lib/proofChain";
import type { ProofOverview } from "@/lib/types";
import n from "./proofWalletNotice.module.css";

/**
 * A quiet note when the proof wallet is low on test POL. It renders nothing
 * otherwise, and nothing if GET /proof fails (for example a staff login).
 */
export function ProofWalletNotice() {
  const proof = useApi<ProofOverview>("proof");
  if (!proof.data) return null;
  const chain = readChain(proof.data);
  if (!needsTopUp(chain)) return null;
  const balance = formatPol(chain.balance_pol);
  return (
    <div className={n.notice} role="status">
      <p className={n.title}>Proof wallet is low on test POL</p>
      <p className={n.body}>
        {chain.mode === "amoy"
          ? `Tonight's proof is still sent to ${NETWORK}${balance ? `. Balance: ${balance}` : ""}.`
          : `Tonight's proof is kept on Seedha's server because the wallet balance is too low to send to ${NETWORK}${
              balance ? ` (${balance})` : ""
            }.`}{" "}
        {NO_VALUE}{" "}
        <a className={n.link} href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
          Top up from the Polygon faucet
        </a>{" "}
        <span className={n.host}>(faucet.polygon.technology)</span>
      </p>
    </div>
  );
}
