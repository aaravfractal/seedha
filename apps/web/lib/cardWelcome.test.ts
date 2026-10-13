import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FEEDBACK_MAX,
  bookAgainHref,
  bookAgainLine,
  cleanBookingRef,
  cleanLast4,
  feedbackError,
  stayPrefill,
} from "./cardWelcome.ts";

test("booking reference: 1 to 30 letters, digits or dashes", () => {
  assert.equal(cleanBookingRef("  DV-2026-0142 "), "DV-2026-0142");
  assert.equal(cleanBookingRef("A"), "A");
  assert.equal(cleanBookingRef("a".repeat(30)), "a".repeat(30));
  assert.equal(cleanBookingRef("a".repeat(31)), null);
  assert.equal(cleanBookingRef(""), null);
  assert.equal(cleanBookingRef("DV 0142"), null);
  assert.equal(cleanBookingRef("<script>"), null);
  assert.equal(cleanBookingRef("DV_0142"), null);
});

test("phone last 4: exactly 4 digits", () => {
  assert.equal(cleanLast4(" 4821 "), "4821");
  assert.equal(cleanLast4("482"), null);
  assert.equal(cleanLast4("48211"), null);
  assert.equal(cleanLast4("48a1"), null);
});

test("private note: 1 to 500 characters after trimming", () => {
  assert.equal(feedbackError("   "), "empty");
  assert.equal(feedbackError("The geyser was cold."), null);
  assert.equal(feedbackError("x".repeat(FEEDBACK_MAX)), null);
  assert.equal(feedbackError("x".repeat(FEEDBACK_MAX + 1)), "too_long");
  // Counted as characters, not UTF-16 units.
  assert.equal(feedbackError("न".repeat(FEEDBACK_MAX)), null);
});

test("Book again line: the owner's perk words only, sample prefix stripped", () => {
  assert.deepEqual(bookAgainLine("Sample perk: free breakfast.", "en"), {
    lead: "Book direct next time:",
    perk: "free breakfast",
  });
  assert.deepEqual(bookAgainLine("", "en"), { lead: "Book direct next time", perk: "" });
  assert.deepEqual(bookAgainLine("मुफ़्त नाश्ता", "hi"), {
    lead: "अगली बार सीधे बुक करें:",
    perk: "मुफ़्त नाश्ता",
  });
  for (const lang of ["en", "hi"] as const) {
    const line = bookAgainLine("free breakfast", lang);
    assert.doesNotMatch(`${line.lead} ${line.perk}`, /[—!₹]/);
  }
});

const VERIFIED = {
  state: "verified" as const,
  stay_token: "t",
  room_type: "Deluxe Valley View",
  nights: 2,
  next_check_in: "2026-11-13",
  perk_code: "DV-BRK-01",
};

test("Book again: verified with a code goes to /link/<code> with the stay prefilled", () => {
  assert.equal(
    bookAgainHref({ bookingUrl: "/link", verify: VERIFIED, firstRoom: "Standard" }),
    "/link/DV-BRK-01?room=Deluxe+Valley+View&in=2026-11-13&nights=2",
  );
  assert.equal(
    bookAgainHref({ bookingUrl: "https://app.example.in/link/", verify: VERIFIED, firstRoom: "Standard" }),
    "https://app.example.in/link/DV-BRK-01?room=Deluxe+Valley+View&in=2026-11-13&nights=2",
  );
  assert.equal(
    bookAgainHref({
      bookingUrl: "/link",
      verify: VERIFIED,
      firstRoom: "Standard",
      here: { protocol: "http:", hostname: "deodar-view.localhost", port: "3000" },
    }),
    "http://localhost:3000/link/DV-BRK-01?room=Deluxe+Valley+View&in=2026-11-13&nights=2",
  );
});

test("Book again: verified without a code, and unverified", () => {
  assert.equal(
    bookAgainHref({ bookingUrl: "/link", verify: { ...VERIFIED, perk_code: null }, firstRoom: "Standard" }),
    "/link?room=Deluxe+Valley+View&in=2026-11-13&nights=2",
  );
  assert.equal(
    bookAgainHref({ bookingUrl: null, verify: null, firstRoom: "Standard" }),
    "/link?room=Standard",
  );
  assert.equal(bookAgainHref({ bookingUrl: "/link", verify: null, firstRoom: "" }), "/link");
  // A state other than verified carries nothing.
  assert.equal(
    bookAgainHref({
      bookingUrl: "/link",
      verify: { ...VERIFIED, state: "not_ended" },
      firstRoom: "Standard",
    }),
    "/link?room=Standard",
  );
});

test("stay prefill: odd values are left out, never guessed", () => {
  const p = stayPrefill({ ...VERIFIED, nights: 15, next_check_in: "2026-02-30", perk_code: "x/y" });
  assert.deepEqual(p, { room: "Deluxe Valley View", checkIn: null, nights: null, code: null });
  assert.equal(stayPrefill({ ...VERIFIED, nights: 1.5 }).nights, null);
  assert.equal(stayPrefill({ ...VERIFIED, nights: 14 }).nights, 14);
});
