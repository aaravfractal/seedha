import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTICE_MAX,
  actionText,
  rejectedName,
  RATE_LINE,
  categoryText,
  dateRange,
  eventLabels,
  demandText,
  extractErrorText,
  isHttpsUrl,
  isOwnerEvent,
  noticeCounter,
  ownEventId,
  reasonText,
  sourceHost,
  sourceUrlError,
} from "./events.ts";

const ALL_REASONS = [
  "money_mentioned",
  "web_address",
  "bad_dates",
  "bad_length",
  "bad_category",
  "bad_demand",
  "duplicate",
  "too_many",
  "already_saved",
  "x",
];

test("reject reasons read as plain words, unknown codes get a safe line", () => {
  assert.match(reasonText("money_mentioned"), /price or amount/);
  assert.match(reasonText("web_address"), /web address/);
  assert.match(reasonText("bad_dates"), /dates/);
  assert.match(reasonText("bad_length"), /too short or too long/);
  assert.match(reasonText("bad_category"), /kind of event/);
  assert.match(reasonText("bad_demand"), /low, medium or high/);
  assert.match(reasonText("duplicate"), /twice/);
  assert.match(reasonText("too_many"), /up to 10/);
  assert.match(reasonText("already_saved"), /already on your calendar/);
  assert.equal(rejectedName(null), "An event");
  assert.equal(rejectedName("  "), "An event");
  assert.equal(rejectedName("Mela"), "Mela");
  assert.equal(reasonText("something_new"), "Seedha could not read this one clearly.");
  for (const code of ALL_REASONS) {
    assert.doesNotMatch(reasonText(code), /_/);
  }
});

test("https validation refuses http, bare hosts, credentials and junk", () => {
  assert.equal(isHttpsUrl("https://uttarakhandtourism.gov.in/events"), true);
  assert.equal(isHttpsUrl("  https://example.org/a?b=1  "), true);
  assert.equal(isHttpsUrl("http://example.org"), false);
  assert.equal(isHttpsUrl("example.org"), false);
  assert.equal(isHttpsUrl("https://localhost"), false);
  assert.equal(isHttpsUrl("https://user:pw@example.org"), false); // pragma: allowlist secret (tests that a URL with credentials is refused)
  assert.equal(isHttpsUrl("javascript:alert(1)"), false);
  assert.equal(isHttpsUrl(""), false);
});

test("source link field errors", () => {
  assert.equal(sourceUrlError(""), "Add the official source link.");
  assert.equal(sourceUrlError("http://example.org"), "Use the https:// address of the source.");
  assert.equal(sourceUrlError("example.org"), "Enter a full link that starts with https://");
  assert.equal(sourceUrlError("https://example.org"), null);
});

test("source host drops www and refuses non-https", () => {
  assert.equal(sourceHost("https://www.mussoorie.gov.in/notice/12"), "mussoorie.gov.in");
  assert.equal(sourceHost("https://tourism.example.org"), "tourism.example.org");
  assert.equal(sourceHost("http://example.org"), null);
  assert.equal(sourceHost(null), null);
  assert.equal(sourceHost(undefined), null);
});

test("notice counter counts characters and flags the limit", () => {
  assert.equal(NOTICE_MAX, 6000);
  const empty = noticeCounter("");
  assert.deepEqual([empty.count, empty.left, empty.over], [0, 6000, false]);
  assert.equal(empty.label, "0 of 6,000 characters");
  const full = noticeCounter("a".repeat(6000));
  assert.equal(full.over, false);
  const over = noticeCounter("a".repeat(6003));
  assert.equal(over.over, true);
  assert.equal(over.label, "6,003 of 6,000 characters. Remove 3 to continue.");
  assert.equal(noticeCounter("मसूरी").count, 5);
});

test("origin labels: missing origin is sample", () => {
  assert.deepEqual(eventLabels("owner_source"), ["From your sources"]);
  assert.deepEqual(eventLabels("sample_extraction"), ["Sample extraction"]);
  assert.deepEqual(eventLabels("sample"), ["Sample"]);
  assert.deepEqual(eventLabels(undefined), ["Sample"]);
  assert.equal(isOwnerEvent("owner_source"), true);
  assert.equal(isOwnerEvent("sample_extraction"), true);
  assert.equal(isOwnerEvent("sample"), false);
  assert.equal(isOwnerEvent(undefined), false);
});

test("own event ids come only from own-<digits> keys", () => {
  assert.equal(ownEventId("own-12"), 12);
  assert.equal(ownEventId("winter-line-carnival"), null);
  assert.equal(ownEventId("own-12x"), null);
});

test("labels and dates", () => {
  assert.equal(demandText("high"), "Likely overnight demand, as Claude read your source: High");
  assert.equal(demandText("low", true), "Likely overnight demand (sample): Low");
  assert.equal(categoryText("festival"), "Festival");
  assert.equal(categoryText("nope"), "Other");
  assert.equal(dateRange("2026-12-25", "2026-12-30"), "25 to 30 Dec");
  assert.equal(dateRange("2026-12-31", "2026-12-31"), "31 Dec");
  assert.equal(dateRange("2026-12-31", "2027-01-03"), "31 Dec to 3 Jan");
});

test("error text for rate limit and unavailable extraction", () => {
  assert.match(extractErrorText(429, "rate_limited", ""), /Too many tries/);
  assert.match(extractErrorText(503, "extract_unavailable", "x"), /not available right now/);
  assert.equal(extractErrorText(400, "bad", "Bad input"), "Bad input");
  assert.match(extractErrorText(422, "bad_source_url", "x"), /https/);
  assert.equal(extractErrorText(422, "empty_notice", "x"), "Paste the notice text first.");
  assert.match(extractErrorText(422, "invalid_input", "x"), /Check the notice/);
});

test("every channel action reads as words, low demand keeps the usual mix", () => {
  assert.equal(actionText("keep"), "Keep your usual mix");
  assert.equal(actionText("no_discount"), "No OTA discounts");
  assert.equal(actionText("hold"), "Hold rooms for direct");
  assert.equal(actionText("anything"), "Keep your usual mix");
});

test("copy has no rupee figures, em dashes or exclamation marks", () => {
  const all = [
    RATE_LINE,
    ...ALL_REASONS.map(reasonText),
    ...["bad_source_url", "empty_notice", "invalid_input"].map((code) => extractErrorText(422, code, "")),
    actionText("keep"),
    extractErrorText(429, "", ""),
    extractErrorText(503, "", ""),
    extractErrorText(413, "", ""),
  ].join(" ");
  assert.doesNotMatch(all, /[₹—!]|\brs\.?\s*\d/i);
});
