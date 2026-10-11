import { test } from "node:test";
import assert from "node:assert/strict";
import { awaitingReply, sentNote, threadFromQuery, wantsInvoice } from "./inboxRules.ts";

test("deep link: only a positive whole number opens a thread", () => {
  assert.equal(threadFromQuery("?thread=12"), 12);
  assert.equal(threadFromQuery("thread=7&x=1"), 7);
  for (const bad of [
    "",
    "?thread=",
    "?thread=0",
    "?thread=-3",
    "?thread=1.5",
    "?thread=abc",
    "?thread=1e3",
  ]) {
    assert.equal(threadFromQuery(bad), null, bad);
  }
  assert.equal(threadFromQuery("?thread=1234567890"), null, "too long");
});

test("a draft is suggested only when the guest wrote last and the window is open", () => {
  const guest = { key: "i3", direction: "in" as const };
  const owner = { key: "i4", direction: "out" as const };
  assert.equal(awaitingReply({ can_reply: true, messages: [owner, guest] }), "i3");
  assert.equal(awaitingReply({ can_reply: true, messages: [guest, owner] }), null);
  assert.equal(awaitingReply({ can_reply: false, messages: [guest] }), null);
  assert.equal(awaitingReply({ can_reply: true, messages: [] }), null);
});

test("invoice slot appears only for a stay invoice attachment", () => {
  assert.equal(wantsInvoice({ attach: { kind: "stay_invoice", consent_id: 4 } }), true);
  assert.equal(wantsInvoice({ attach: null }), false);
  assert.equal(wantsInvoice({ attach: { kind: "other", consent_id: 4 } }), false);
  assert.equal(wantsInvoice(null), false);
});

test("simulated label lives on the send toast only", () => {
  assert.equal(sentNote(true), "Sent (simulated, no WhatsApp keys)");
  assert.equal(sentNote(false), "Sent on WhatsApp");
});
