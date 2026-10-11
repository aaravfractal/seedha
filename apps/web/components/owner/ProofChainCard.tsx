"use client";

import type { ProofChain } from "@/lib/types";
import {
  FAUCET_URL,
  NETWORK,
  NO_VALUE,
  formatPol,
  linkHost,
  localReason,
  shortAddress,
} from "@/lib/proofChain";
import { useToast } from "@/components/Toast";
import { ui } from "./ui";
import c from "./proofChain.module.css";

/** Where tonight's root goes: Polygon Amoy testnet, or kept on Seedha's server. */
export function ProofChainCard({ chain }: { chain: ProofChain }) {
  const toast = useToast();
  const host = linkHost(chain.address_url);
  const balance = formatPol(chain.balance_pol);

  if (chain.mode === "local") {
    return (
      <section className={`${ui.card} ${c.card}`} aria-labelledby="chainTitle">
        <p className={c.kicker}>Where the root goes</p>
        <h2 className={c.title} id="chainTitle">
          Local only
        </h2>
        <p className={c.body}>
          {localReason(chain.reason)} Each night&apos;s root is kept on Seedha&apos;s server, so every consent
          can still be checked here. Only fingerprints would ever be published: no name, phone or booking
          detail.
        </p>
        {chain.reason === "low_balance" ? (
          <p className={c.body}>
            <a className={c.link} href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
              Top up from the Polygon faucet
            </a>{" "}
            <span className={c.host}>({linkHost(FAUCET_URL)})</span>. {NO_VALUE}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className={`${ui.card} ${c.card}`} aria-labelledby="chainTitle">
      <p className={c.kicker}>Where the root goes</p>
      <h2 className={c.title} id="chainTitle">
        {NETWORK}
      </h2>
      <p className={c.body}>
        Each night&apos;s root is sent to {NETWORK}, a public test network. {NO_VALUE} Only fingerprints go
        there: no name, phone or booking detail.
      </p>
      <dl className={c.rows}>
        {chain.address ? (
          <>
            <dt>Wallet</dt>
            <dd>
              <span className={c.mono} title={chain.address}>
                <span aria-hidden="true">{shortAddress(chain.address)}</span>
                <span className="sr-only-text">{chain.address}</span>
              </span>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => {
                  const address = chain.address as string;
                  void navigator.clipboard?.writeText(address).catch(() => undefined);
                  toast("Wallet address copied");
                }}
              >
                Copy address
              </button>
              {chain.address_url && host ? (
                <a className={c.link} href={chain.address_url} target="_blank" rel="noopener noreferrer">
                  View wallet on Amoy explorer <span className={c.host}>({host})</span>
                </a>
              ) : null}
            </dd>
          </>
        ) : null}
        {balance ? (
          <>
            <dt>Balance</dt>
            <dd>
              <span>{balance}</span>
              {chain.low_balance ? (
                <>
                  <span className={c.low}>Balance is low.</span>
                  <a className={c.link} href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
                    Top up from the Polygon faucet
                  </a>
                </>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
