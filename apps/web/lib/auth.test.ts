import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanCode,
  clock,
  countdownAnnouncement,
  maskPhone,
  normalisePhone,
  parsePending,
  safeNext,
  triesText,
} from "./auth.ts";

test("Indian mobiles normalise to 10 digits", () => {
  assert.equal(normalisePhone("9876543210"), "9876543210");
  assert.equal(normalisePhone("+91 98765 43210"), "9876543210");
  assert.equal(normalisePhone("91-98765-43210"), "9876543210");
  assert.equal(normalisePhone("098765 43210"), "9876543210");
  assert.equal(normalisePhone("6000000000"), "6000000000");
});

test("other numbers are refused", () => {
  for (const raw of ["5876543210", "987654321", "98765432101", "+1 9876543210", "abc", ""]) {
    assert.equal(normalisePhone(raw), null, raw);
  }
});

test("mask shows the first five and last two digits", () => {
  assert.equal(maskPhone("9876543210"), "+91 98765 •••10");
});

test("code input keeps six digits only", () => {
  assert.equal(cleanCode("12 34-56 78"), "123456");
  assert.equal(cleanCode("ab"), "");
});

test("countdown text and announcements", () => {
  assert.equal(clock(299), "4:59");
  assert.equal(clock(30), "0:30");
  assert.equal(clock(-4), "0:00");
  assert.equal(countdownAnnouncement(240), "Code expires in 4 minutes.");
  assert.equal(countdownAnnouncement(60), "Code expires in 1 minute.");
  assert.equal(countdownAnnouncement(30), "Code expires in 30 seconds.");
  assert.equal(countdownAnnouncement(0), "The code has expired. Ask for a new one.");
  assert.equal(countdownAnnouncement(59), null);
  assert.equal(triesText(5), "5 of 5 tries left");
});

test("next path stays on this site", () => {
  assert.equal(safeNext("/flip"), "/flip");
  assert.equal(safeNext("//evil.example"), "/home");
  assert.equal(safeNext("/\\evil.example"), "/home");
  assert.equal(safeNext("https://evil.example"), "/home");
  assert.equal(safeNext(null), "/home");
});

test("pending code state is validated", () => {
  assert.equal(parsePending(null), null);
  assert.equal(parsePending("not json"), null);
  assert.equal(parsePending(JSON.stringify({ phone: "123", sentAt: 1 })), null);
  const ok = parsePending(JSON.stringify({ phone: "9876543210", sentAt: 5, flow: "signup", next: "//x" }));
  assert.equal(ok?.masked, "+91 98765 •••10");
  assert.equal(ok?.flow, "signup");
  assert.equal(ok?.triesLeft, 5);
  assert.equal(ok?.next, "/home");
  assert.equal(ok?.demoCode, null);
});
