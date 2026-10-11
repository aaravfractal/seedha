/**
 * Plain words for where a consent proof lives: Polygon Amoy testnet, or kept
 * on Seedha's server. Pure helpers, shared by the proof screen, the proof
 * dialog and the Settings wallet notice. Testnet only: never mainnet.
 */
import type { ProofBundle, ProofChain, ProofOverview } from "./types.ts";

export const NETWORK = "Polygon Amoy testnet";
export const FAUCET_URL = "https://faucet.polygon.technology";
export const NO_VALUE = "Testnet tokens have no value.";

export type ChainStatus = "stored" | "sent" | "verified" | "failed";
export type StatusTone = "ok" | "plain" | "bad";

/** "written" is the old name for "sent"; anything unknown reads as stored. */
export function chainStatus(raw: string | null | undefined): ChainStatus {
  if (raw === "sent" || raw === "written") return "sent";
  if (raw === "verified" || raw === "failed") return raw;
  return "stored";
}

/** The line shown on each bundle. */
export function bundleStatus(bundle: Pick<ProofBundle, "chain_status" | "chain_block">): {
  status: ChainStatus;
  label: string;
  tone: StatusTone;
} {
  const status = chainStatus(bundle.chain_status);
  if (status === "sent") {
    return { status, label: `Sent to ${NETWORK}, waiting for confirmation`, tone: "plain" };
  }
  if (status === "verified") {
    const block = bundle.chain_block;
    const label =
      typeof block === "number" ? `Verified on ${NETWORK}, block ${block}` : `Verified on ${NETWORK}`;
    return { status, label, tone: "ok" };
  }
  if (status === "failed") return { status, label: "Not confirmed", tone: "bad" };
  return { status, label: "Stored on Seedha", tone: "plain" };
}

const LOCAL: ProofChain = {
  mode: "local",
  network_label: NETWORK,
  address: null,
  balance_pol: null,
  low_balance: false,
  reason: null,
  address_url: null,
};

/** The chain block of GET /proof; an older API has none and is local only. */
export function readChain(proof: Pick<ProofOverview, "chain"> | null | undefined): ProofChain {
  const chain = proof?.chain;
  if (!chain || (chain.mode !== "amoy" && chain.mode !== "local")) return LOCAL;
  return chain;
}

/** Why the root stays on Seedha's server, in plain words. */
export function localReason(reason: ProofChain["reason"]): string {
  switch (reason) {
    case "no_key":
      return "No wallet key is set.";
    case "rpc_down":
      return `${NETWORK} is not reachable right now.`;
    case "wrong_chain":
      return `The network did not answer as ${NETWORK}, so Seedha refused to send.`;
    case "low_balance":
      return "The wallet balance is too low to send.";
    case "public_mode":
      return `During a public demo, ${NETWORK} writes run only on the laptop running Seedha.`;
    default:
      return `Writing to ${NETWORK} is off.`;
  }
}

/** "0x1234…abcd". */
export function shortAddress(address: string): string {
  const a = address.trim();
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** "0.0042 POL"; at most 4 decimals, cut not rounded up. */
export function formatPol(balance: string | null | undefined): string | null {
  if (balance === null || balance === undefined) return null;
  const b = balance.trim();
  if (!/^\d+(\.\d+)?$/.test(b)) return null;
  const [whole, frac = ""] = b.split(".");
  const cut = frac.slice(0, 4).replace(/0+$/, "");
  return `${whole}${cut ? `.${cut}` : ""} POL`;
}

/** The host of an explorer link, shown next to it; null for anything not https. */
export function linkHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.host : null;
  } catch {
    return null;
  }
}

/** Settings shows a top-up hint only when the wallet is low on test POL. */
export function needsTopUp(chain: ProofChain): boolean {
  return (
    (chain.mode === "amoy" && chain.low_balance) || (chain.mode === "local" && chain.reason === "low_balance")
  );
}

/** The note under the proof dialog's rows, true in both modes. */
export function dialogChainText(bundle: Pick<ProofBundle, "chain_status"> | null): string {
  const tail = "Only fingerprints go there: no name, phone or booking detail.";
  if (!bundle) {
    return "This fingerprint is sealed into tonight's bundle at 9 PM. No name, phone or booking detail is ever published.";
  }
  const status = chainStatus(bundle.chain_status);
  if (status === "verified") return `This bundle's root is on ${NETWORK}, a public test network. ${tail}`;
  if (status === "sent") {
    return `This bundle's root was sent to ${NETWORK} and is waiting for confirmation. It is also kept on Seedha's server. ${tail}`;
  }
  return "This bundle's root is kept on Seedha's server. No name, phone or booking detail is ever published.";
}
