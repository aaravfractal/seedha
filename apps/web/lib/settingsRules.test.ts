import { test } from "node:test";
import assert from "node:assert/strict";
import { bpsPct, checkDetails, fieldForCode, mobileDigits, taxId } from "./settingsRules.ts";

const ok = {
  name: "Meera Rawat",
  email: "meera@pinecrest.example",
  business_name: "Pine Crest Homestay",
  gstin: "05AAACH1234K1Z2",
  pan: "AAACH1234K",
  address: "Camel's Back Road",
  pin: "248179",
};

test("valid details and empty optional fields pass", () => {
  assert.deepEqual(checkDetails(ok), {});
  assert.deepEqual(checkDetails({ ...ok, email: "", gstin: "", pan: "", address: "", pin: "" }), {});
  assert.deepEqual(checkDetails({ ...ok, gstin: "05aaach1234k1z2", pan: "aaach 1234k" }), {});
});

test("handoff regexes", () => {
  assert.ok(checkDetails({ ...ok, gstin: "05AAACH1234K1X2" }).gstin);
  assert.ok(checkDetails({ ...ok, gstin: "5AAACH1234K1Z2" }).gstin);
  assert.ok(checkDetails({ ...ok, pan: "AAAC1234K" }).pan);
  assert.ok(checkDetails({ ...ok, pin: "24817" }).pin);
  assert.ok(checkDetails({ ...ok, email: "x@y" }).email);
  assert.ok(checkDetails({ ...ok, name: " " }).name);
});

test("PAN must match the PAN inside the GSTIN", () => {
  assert.match(checkDetails({ ...ok, pan: "ABCDE1234F" }).pan ?? "", /do not match/); // pragma: allowlist secret
});

test("mobile numbers", () => {
  assert.equal(mobileDigits("+91 98111 11111"), "9811111111");
  assert.equal(mobileDigits("098111-11111"), "9811111111");
  assert.equal(mobileDigits("919811111111"), "9811111111");
  assert.equal(mobileDigits("5811111111"), "");
  assert.equal(mobileDigits("98111"), "");
});

test("helpers", () => {
  assert.equal(taxId(" ab cd "), "ABCD");
  assert.equal(fieldForCode("pan_gstin_mismatch"), "pan");
  assert.equal(fieldForCode("other"), null);
  assert.equal(bpsPct(2200), "22%");
  assert.equal(bpsPct(1850), "18.5%");
  assert.equal(bpsPct(1825), "18.25%");
  assert.equal(bpsPct(1805), "18.05%");
  assert.equal(bpsPct(0), "0%");
});
