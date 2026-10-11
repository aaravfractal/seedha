import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bundleStatus,
  chainStatus,
  dialogChainText,
  formatPol,
  linkHost,
  localReason,
  needsTopUp,
  readChain,
  shortAddress,
} from "./proofChain.ts";
import type { ProofChain } from "./types.ts";

const amoy: ProofChain = {
  mode: "amoy",
  network_label: "Polygon Amoy testnet",
  address: "0x1234567890abcdef1234567890abcdef12345678",
  balance_pol: "0.25",
  low_balance: false,
  reason: null,
  address_url: "https://amoy.polygonscan.com/address/0x1234567890abcdef1234567890abcdef12345678",
};

test("old 'written' reads as sent; unknown reads as stored", () => {
  assert.equal(chainStatus("written"), "sent");
  assert.equal(chainStatus("sent"), "sent");
  assert.equal(chainStatus("verified"), "verified");
  assert.equal(chainStatus("failed"), "failed");
  assert.equal(chainStatus("stored"), "stored");
  assert.equal(chainStatus("anything"), "stored");
  assert.equal(chainStatus(undefined), "stored");
});

test("each bundle status has its label and tone", () => {
  assert.deepEqual(bundleStatus({ chain_status: "stored" }), {
    status: "stored",
    label: "Stored on Seedha",
    tone: "plain",
  });
  assert.equal(
    bundleStatus({ chain_status: "written" }).label,
    "Sent to Polygon Amoy testnet, waiting for confirmation",
  );
  assert.equal(
    bundleStatus({ chain_status: "verified", chain_block: 1234567 }).label,
    "Verified on Polygon Amoy testnet, block 1234567",
  );
  assert.equal(
    bundleStatus({ chain_status: "verified", chain_block: null }).label,
    "Verified on Polygon Amoy testnet",
  );
  assert.equal(bundleStatus({ chain_status: "verified" }).tone, "ok");
  assert.deepEqual(bundleStatus({ chain_status: "failed" }), {
    status: "failed",
    label: "Not confirmed",
    tone: "bad",
  });
});

test("a missing or odd chain block reads as local only", () => {
  assert.equal(readChain(null).mode, "local");
  assert.equal(readChain({}).mode, "local");
  assert.equal(readChain({ chain: null }).mode, "local");
  assert.equal(readChain({ chain: { ...amoy, mode: "mainnet" as "amoy" } }).mode, "local");
  assert.equal(readChain({ chain: amoy }).address, amoy.address);
});

test("every local reason has plain words", () => {
  assert.equal(localReason("no_key"), "No wallet key is set.");
  assert.match(localReason("rpc_down"), /not reachable/);
  assert.match(localReason("wrong_chain"), /refused to send/);
  assert.match(localReason("low_balance"), /too low/);
  assert.match(localReason(null), /off/);
});

test("addresses shorten to the first six and last four", () => {
  assert.equal(shortAddress(amoy.address as string), "0x1234…5678");
  assert.equal(shortAddress("0xabc"), "0xabc");
});

test("POL balances show at most four decimals, never rounded up", () => {
  assert.equal(formatPol("0.25"), "0.25 POL");
  assert.equal(formatPol("0.009999"), "0.0099 POL");
  assert.equal(formatPol("1.000000"), "1 POL");
  assert.equal(formatPol("3"), "3 POL");
  assert.equal(formatPol(null), null);
  assert.equal(formatPol("-1"), null);
  assert.equal(formatPol("abc"), null);
});

test("only https links get a host", () => {
  assert.equal(linkHost("https://amoy.polygonscan.com/tx/0xabc"), "amoy.polygonscan.com");
  assert.equal(linkHost("javascript:alert(1)"), null);
  assert.equal(linkHost("http://amoy.polygonscan.com/tx/0xabc"), null);
  assert.equal(linkHost(null), null);
  assert.equal(linkHost("not a url"), null);
});

test("top-up hint shows for a low amoy wallet or a local fallback for low balance", () => {
  assert.equal(needsTopUp(amoy), false);
  assert.equal(needsTopUp({ ...amoy, low_balance: true }), true);
  assert.equal(needsTopUp({ ...amoy, mode: "local", reason: "low_balance" }), true);
  assert.equal(needsTopUp({ ...amoy, mode: "local", reason: "no_key" }), false);
});

test("dialog chain note is true in both modes and never says mainnet", () => {
  const texts = [
    dialogChainText(null),
    dialogChainText({ chain_status: "stored" }),
    dialogChainText({ chain_status: "written" }),
    dialogChainText({ chain_status: "verified" }),
    dialogChainText({ chain_status: "failed" }),
  ];
  assert.match(texts[1] as string, /kept on Seedha's server/);
  assert.match(texts[2] as string, /waiting for confirmation/);
  assert.match(texts[3] as string, /on Polygon Amoy testnet/);
  assert.match(texts[4] as string, /kept on Seedha's server/);
  for (const t of texts) {
    assert.doesNotMatch(t, /mainnet|—|!/i);
    assert.doesNotMatch(t, /not yet/);
  }
});
