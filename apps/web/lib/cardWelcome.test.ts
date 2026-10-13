import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FEEDBACK_MAX,
  bookAgainHref,
  bookAgainLine,
  cleanBookingRef,
  cleanLast4,
  cleanName,
  cleanWhatsapp,
  feedbackBody,
  feedbackError,
  rewardAllowed,
  rewardChoices,
  seedhaHomeHref,
  shortHotelName,
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

const FORM = {
  name: " Asha  Rawat ",
  whatsapp: "+91 98765 43210",
  ref: "",
  last4: "",
  askLast4: false,
  overall: 5,
  food: 0,
  review: "",
  reward: "none" as const,
  consent: false,
};

test("feedback: name and stars needed; the number is sent only with consent", () => {
  const out = feedbackBody(FORM);
  assert.deepEqual(out.problems, []);
  assert.deepEqual(out.body, { name: "Asha Rawat", overall: 5, reward: "none", consent: false });
  assert.deepEqual(feedbackBody({ ...FORM, name: " ", overall: 0 }).problems, ["name", "overall"]);
  assert.deepEqual(feedbackBody({ ...FORM, name: "a".repeat(61) }).problems, ["name"]);
  assert.deepEqual(feedbackBody({ ...FORM, consent: true, whatsapp: "" }).problems, ["whatsapp"]);
  const yes = feedbackBody({ ...FORM, consent: true, food: 4, review: "  Warm rooms.  " });
  assert.deepEqual(yes.body, {
    name: "Asha Rawat",
    whatsapp: "+91 98765 43210",
    overall: 5,
    food: 4,
    review: "Warm rooms.",
    reward: "none",
    consent: true,
  });
  assert.deepEqual(feedbackBody({ ...FORM, review: "x".repeat(501) }).problems, ["review"]);
});

test("feedback: discounts only with a booking reference; phone digits only once asked", () => {
  assert.deepEqual(feedbackBody({ ...FORM, reward: "pct5" }).problems, ["reward"]);
  assert.deepEqual(feedbackBody({ ...FORM, reward: "breakfast" }).problems, []);
  assert.deepEqual(feedbackBody({ ...FORM, ref: "DV 1" }).problems, ["ref"]);
  const ref = feedbackBody({ ...FORM, ref: " CL2101 ", reward: "flat100", last4: "12" });
  assert.equal(ref.body?.booking_ref, "CL2101");
  assert.equal(ref.body?.phone_last4, undefined);
  assert.deepEqual(feedbackBody({ ...FORM, ref: "CL2101", askLast4: true, last4: "12" }).problems, ["last4"]);
  assert.equal(
    feedbackBody({ ...FORM, ref: "CL2101", askLast4: true, last4: "4821" }).body?.phone_last4,
    "4821",
  );
  assert.equal(rewardAllowed("flat100", false), false);
  assert.equal(rewardAllowed("breakfast", false), true);
});

test("WhatsApp number: digits, spaces, a leading +, 10 to 15 digits, at most 16 characters", () => {
  assert.equal(cleanWhatsapp(" 98765 43210 "), "98765 43210");
  assert.equal(cleanWhatsapp("+919876543210"), "+919876543210");
  assert.equal(cleanWhatsapp("98765"), null);
  assert.equal(cleanWhatsapp("98-765-43210"), null);
  assert.equal(cleanWhatsapp("+91 98765 43210 1"), null);
  assert.equal(cleanName("  "), null);
});

test("rewards: known ids once, in order", () => {
  const out = rewardChoices([
    { id: "breakfast", en: "Free breakfast", hi: "मुफ़्त नाश्ता" },
    { id: "breakfast", en: "Again", hi: "फिर" },
    { id: "spa" as "pct5", en: "Spa", hi: "स्पा" },
    { id: "pct5", en: "5% off", hi: "5% छूट" },
  ]);
  assert.deepEqual(
    out.map((r) => r.id),
    ["breakfast", "pct5"],
  );
  assert.deepEqual(rewardChoices(undefined), []);
});

test("Seedha bar: short hotel name and the Seedha home address", () => {
  assert.equal(shortHotelName("Hotel Deodar View"), "Deodar View");
  assert.equal(shortHotelName("Deodar View"), "Deodar View");
  assert.equal(shortHotelName("होटल देवदार व्यू"), "देवदार व्यू");
  assert.equal(shortHotelName("Hotel"), "Hotel");
  assert.equal(seedhaHomeHref("https://app.seedha.in/link"), "https://app.seedha.in/");
  assert.equal(seedhaHomeHref(null), "/");
  assert.equal(
    seedhaHomeHref("/link", { protocol: "http:", hostname: "deodar-view.localhost", port: "3000" }),
    "http://localhost:3000/",
  );
});
