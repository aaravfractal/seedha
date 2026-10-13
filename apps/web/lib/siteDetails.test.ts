import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AMENITIES, AMENITY_IDS } from "./amenities.ts";
import {
  AMENITY_GROUPS,
  CARD_SOURCE,
  CARD_SPECS,
  apiProblems,
  cardUrl,
  cardsPdfHref,
  coordError,
  dayName,
  draftChanged,
  emailError,
  emptyNearby,
  errorLines,
  fieldName,
  fromDraft,
  matchesAmenity,
  monthName,
  nearestDirection,
  phoneError,
  plainProblem,
  qrBaseUrl,
  qrHref,
  qrPathData,
  ratingDate,
  ratingSource,
  ratingsSummary,
  starsLabel,
  scanBars,
  textError,
  timeError,
  toDraft,
  validateDraft,
  wholeError,
} from "./siteDetails.ts";
import type { SiteDetailsIn } from "./types-site-v2-owner.ts";

const SAMPLE: SiteDetailsIn = {
  rooms: [
    {
      name: "Deluxe Valley View",
      size_sqft: 280,
      beds_en: "1 king bed",
      beds_hi: "1 किंग बेड",
      max_guests: 3,
      features_en: ["Valley view balcony", "Room heater"],
      features_hi: ["घाटी की ओर बालकनी", "रूम हीटर"],
      photo_id: 7,
    },
  ],
  amenities: ["wifi", "parking", "bonfire"],
  nearby: [
    { name_en: "Mall Road", name_hi: "मॉल रोड", minutes: 5, mode: "walk", kind: "market", bearing: 200 },
  ],
  how_to_reach: [{ mode: "road", text_en: "35 km from Dehradun.", text_hi: "" }],
  good_to_know: [{ text_en: "Nights are cold.", text_hi: "रातें ठंडी होती हैं।" }],
  check_in: "12:00",
  check_out: "11:00",
  contact: { phone: "+91 90000 00000", whatsapp: "", email: "", address_en: "Mall Road", address_hi: "" },
  geo: { lat: 30.4598, lng: 78.0664 },
  card_perk_en: "Free evening tea",
  card_perk_hi: "",
};

test("the web amenity list mirrors the API's fixed 40, ids and labels", () => {
  const py = readFileSync(new URL("../../api/app/services/site_details.py", import.meta.url), "utf8");
  const block = py.slice(py.indexOf("AMENITIES:"), py.indexOf("AMENITY_IDS"));
  const rows = [...block.matchAll(/\("([a-z_]+)", "([^"]+)", "([^"]+)"\)/g)].map((m) => ({
    id: m[1],
    en: m[2],
    hi: m[3],
  }));
  assert.equal(rows.length, 40);
  assert.deepEqual(
    AMENITIES.map((a) => ({ id: a.id, en: a.en, hi: a.hi })),
    rows,
  );
});

test("every amenity sits in exactly one picker group", () => {
  const grouped = AMENITY_GROUPS.flatMap((g) => g.ids);
  assert.equal(grouped.length, 40);
  assert.deepEqual([...grouped].sort(), [...AMENITY_IDS].sort());
});

test("amenity search matches English, Hindi and id", () => {
  assert.equal(matchesAmenity("wifi", "wi-fi"), true);
  assert.equal(matchesAmenity("bonfire", "अलाव"), true);
  assert.equal(matchesAmenity("hot_water", "hot water"), true);
  assert.equal(matchesAmenity("wifi", "parking"), false);
  assert.equal(matchesAmenity("wifi", "  "), true);
});

test("a saved object round-trips through the draft unchanged", () => {
  const draft = toDraft(SAMPLE);
  assert.deepEqual(validateDraft(draft), {});
  assert.deepEqual(fromDraft(draft), SAMPLE);
  assert.equal(draftChanged(draft, toDraft(SAMPLE)), false);
  draft.amenities = [...draft.amenities, "yoga"];
  assert.equal(draftChanged(draft, toDraft(SAMPLE)), true);
  // Saved in the fixed order whatever order they were ticked in.
  assert.deepEqual(fromDraft(draft).amenities, ["wifi", "parking", "bonfire", "yoga"]);
});

test("fromDraft trims text, parses numbers and clears an empty map position", () => {
  const draft = toDraft(SAMPLE);
  draft.nearby[0] = { ...emptyNearby(), name_en: "  Gun Hill ", minutes: " 10 ", bearing: "330" };
  draft.lat = "";
  draft.lng = "";
  const out = fromDraft(draft);
  assert.equal(out.nearby[0]?.name_en, "Gun Hill");
  assert.equal(out.nearby[0]?.minutes, 10);
  assert.equal(out.nearby[0]?.bearing, 330);
  assert.equal(out.geo, null);
});

test("text checks mirror the API: required, length in letters, no markup", () => {
  assert.equal(textError("", 60, true), "This cannot be empty.");
  assert.equal(textError("   ", 60, true), "This cannot be empty.");
  assert.equal(textError("", 60, false), null);
  assert.equal(textError("a".repeat(60), 60, true), null);
  assert.match(textError("a".repeat(61), 60, true) ?? "", /60 letters or fewer/);
  assert.equal(textError("<b>Hi</b>", 60, true), "Use plain text without < or >.");
  assert.equal(textError("गन हिल", 60, true), null);
});

test("phone, email and time checks", () => {
  for (const ok of ["", "+91 90000 00000", "9876543210", " 98765 "]) assert.equal(phoneError(ok), null, ok);
  for (const bad of ["+", "++91", "91-98765", "abc", "9".repeat(17)])
    assert.notEqual(phoneError(bad), null, bad);
  assert.equal(emailError(""), null);
  assert.equal(emailError("stay@hotel.in"), null);
  assert.notEqual(emailError("stay@hotel"), null);
  assert.notEqual(emailError("a<b@c.d"), null);
  assert.equal(timeError("09:30"), null);
  assert.equal(timeError("23:59"), null);
  assert.notEqual(timeError("24:00"), null);
  assert.notEqual(timeError("9:30"), null);
});

test("numbers: minutes 1 to 600, bearing 0 to 359, coordinates in range", () => {
  assert.equal(wholeError("1", 1, 600, "minutes"), null);
  assert.equal(wholeError("600", 1, 600, "minutes"), null);
  assert.notEqual(wholeError("0", 1, 600, "minutes"), null);
  assert.notEqual(wholeError("601", 1, 600, "minutes"), null);
  assert.notEqual(wholeError("5.5", 1, 600, "minutes"), null);
  assert.notEqual(wholeError("360", 0, 359, "degrees"), null);
  assert.equal(coordError("30.4598", 90), null);
  assert.equal(coordError("-78", 180), null);
  assert.notEqual(coordError("91", 90), null);
  assert.notEqual(coordError("abc", 90), null);
});

test("validateDraft keys errors like the API's 422 fields", () => {
  const draft = toDraft(SAMPLE);
  draft.nearby[0] = { ...draft.nearby[0]!, name_en: "", minutes: "0" };
  draft.good_to_know[0] = { text_en: "<script>", text_hi: "" };
  draft.check_in = "noon";
  draft.contact.phone = "call me";
  draft.lat = "30.1";
  draft.lng = "";
  const errors = validateDraft(draft);
  assert.deepEqual(Object.keys(errors).sort(), [
    "check_in",
    "contact.phone",
    "geo.lng",
    "good_to_know.0.text_en",
    "nearby.0.minutes",
    "nearby.0.name_en",
  ]);
});

test("validateDraft caps list sizes", () => {
  const draft = toDraft(SAMPLE);
  draft.nearby = Array.from({ length: 9 }, () => ({ ...emptyNearby(), name_en: "Place" }));
  assert.equal(validateDraft(draft).nearby, "Add up to 8 places.");
});

test("the API's 422 problems read as plain words", () => {
  assert.equal(
    plainProblem("nearby.0.name_en", "String should have at most 60 characters"),
    "Use 60 letters or fewer.",
  );
  assert.equal(
    plainProblem("good_to_know.0.text_en", "Value error, Use plain text without < or >"),
    "Use plain text without < or >.",
  );
  assert.equal(
    plainProblem("check_in", "String should match pattern '^([01]\\d|2[0-3]):[0-5]\\d$'"),
    "Use a 24-hour time like 12:00.",
  );
  assert.equal(
    plainProblem("contact.email", "String should match pattern 'x'"),
    "Use an email like name@example.com.",
  );
  assert.equal(
    plainProblem("nearby.0.minutes", "Input should be greater than or equal to 1"),
    "Use 1 or more.",
  );
  assert.equal(
    plainProblem("nearby", "List should have at most 8 items after validation, not 9"),
    "Up to 8 only.",
  );
  assert.equal(plainProblem("x", "something odd"), "This is not valid.");
  assert.equal(fieldName("nearby.1.name_en"), "Nearby place 2, name in English");
  assert.equal(fieldName("how_to_reach.0.text_hi"), "How to reach 1, Hindi text");
  assert.equal(fieldName("contact.phone"), "Phone");
  assert.equal(fieldName("geo.lat"), "Latitude");
  const problems = apiProblems([
    { field: "nearby.0.name_en", problem: "String should have at least 1 character" },
    { field: "nearby.0.name_en", problem: "second problem ignored" },
  ]);
  assert.deepEqual(problems, { "nearby.0.name_en": "This cannot be empty." });
  assert.deepEqual(errorLines(problems), ["Nearby place 1, name in English: This cannot be empty."]);
});

test("nearest compass point", () => {
  assert.deepEqual(nearestDirection(0), ["N", "North"]);
  assert.deepEqual(nearestDirection(200), ["S", "South"]);
  assert.deepEqual(nearestDirection(330), ["NW", "North-west"]);
  assert.deepEqual(nearestDirection(359), ["N", "North"]);
  assert.deepEqual(nearestDirection(70), ["E", "East"]);
});

test("card QR targets carry ?src=card-wallet, card-room or card-desk", () => {
  // Exactly as the API's card_url builds it, so the preview QR is the printed QR.
  assert.equal(cardUrl("https://deodar.example.in", "wallet"), "https://deodar.example.in?src=card-wallet");
  assert.equal(cardUrl("https://x.in/?a=1", "room"), "https://x.in/?a=1&src=card-room");
  assert.equal(
    cardUrl("http://localhost:3000/h/deodar", CARD_SOURCE.tent),
    "http://localhost:3000/h/deodar?src=card-desk",
  );
  assert.equal(cardUrl("/h/deodar", "room"), "/h/deodar?src=card-room");
  assert.equal(cardsPdfHref("all"), "/api/site/cards.pdf?kind=all");
  assert.equal(qrHref("desk", "png"), "/api/site/cards/qr.png?card=desk");
  assert.equal(CARD_SPECS.wallet.qrMm, 18);
  assert.equal(CARD_SPECS.room.qrMm, 25);
  assert.equal(CARD_SPECS.tent.qrMm, 40);
});

test("scan bars and month names", () => {
  assert.equal(monthName("2026-10"), "October 2026");
  assert.equal(dayName("2026-10-03"), "3 Oct");
  assert.deepEqual(scanBars([]), []);
  assert.deepEqual(
    scanBars([
      { day: "2026-10-01", wallet: 1, room: 1, desk: 0 },
      { day: "2026-10-02", wallet: 0, room: 0, desk: 0 },
      { day: "2026-10-03", wallet: 4, room: 0, desk: 0 },
    ]),
    [
      { day: "2026-10-01", total: 2, percent: 50 },
      { day: "2026-10-03", total: 4, percent: 100 },
    ],
  );
});

test("QR path: dark runs merged per row, offset by the 4-module quiet zone", () => {
  const grid = [
    [1, 1, 0],
    [0, 0, 0],
    [1, 0, 1],
  ];
  assert.equal(
    qrPathData(3, (r, c) => grid[r]?.[c] === 1),
    "M4 4h2v1h-2zM4 6h1v1h-1zM6 6h1v1h-1z",
  );
});

test("text checks refuse line breaks, control, bidi and zero-width characters", () => {
  assert.equal(textError("Mall\nRoad", 60, true), "Keep this on one line.");
  for (const bad of ["Mall\u202eRoad", "Mall\u200bRoad", "Mall\u0000Road", "Mall\tRoad", "\u200d"])
    assert.notEqual(textError(bad, 60, true), null, JSON.stringify(bad));
  assert.equal(textError("...", 60, true), "Use some letters or numbers.");
  assert.equal(textError("देवदार व्यू", 60, true), null);
});

test("phone takes ASCII digits only; email is strict like the API", () => {
  for (const bad of ["²³⁴⁵⁶⁷", "١٢٣٤٥٦", "+91 9876+5"]) assert.notEqual(phoneError(bad), null, bad);
  assert.equal(phoneError("+91 98765 43210"), null);
  for (const bad of ["a@b.c?cc=x&body=hi", "a b@c.in", "a@b.c", "a@b.c1"])
    assert.notEqual(emailError(bad), null, bad);
  for (const ok of ["stay@deodar.example", "a.b+c_d%e-f@x-y.co.in"]) assert.equal(emailError(ok), null, ok);
});

test("card perk: optional, up to 100 letters, plain text, sent trimmed", () => {
  const draft = toDraft(SAMPLE);
  draft.card_perk_en = "  Free evening tea  ";
  draft.card_perk_hi = "";
  assert.deepEqual(validateDraft(draft), {});
  assert.equal(fromDraft(draft).card_perk_en, "Free evening tea");
  draft.card_perk_en = "a".repeat(101);
  draft.card_perk_hi = "<b>";
  const errors = validateDraft(draft);
  assert.match(errors.card_perk_en ?? "", /100 letters or fewer/);
  assert.equal(errors.card_perk_hi, "Use plain text without < or >.");
  assert.equal(fieldName("card_perk_en"), "Card perk in English");
  draft.card_perk_en = "";
  draft.card_perk_hi = "";
  assert.deepEqual(validateDraft(draft), {});
});

test("rooms: one draft entry per room type sold, saved facts kept, others empty", () => {
  const draft = toDraft(SAMPLE, ["Standard", "Deluxe Valley View", "Standard"]);
  assert.deepEqual(
    draft.rooms.map((r) => r.name),
    ["Standard", "Deluxe Valley View"],
  );
  assert.equal(draft.rooms[0]?.size_sqft, "");
  assert.equal(draft.rooms[1]?.size_sqft, "280");
  assert.deepEqual(validateDraft(draft, { photoIds: [7] }), {});
  const out = fromDraft(draft);
  assert.deepEqual(out.rooms[0], {
    name: "Standard",
    size_sqft: null,
    beds_en: "",
    beds_hi: "",
    max_guests: null,
    features_en: [],
    features_hi: [],
    photo_id: null,
  });
  assert.deepEqual(out.rooms[1], SAMPLE.rooms[0]);
  // A room type no longer sold drops out; an older API without rooms reads as none.
  assert.deepEqual(toDraft(SAMPLE, ["Standard"]).rooms.length, 1);
  const { rooms: _gone, ...older } = SAMPLE;
  void _gone;
  assert.deepEqual(toDraft(older as SiteDetailsIn).rooms, []);
});

test("rooms: checks mirror the contract", () => {
  const draft = toDraft(SAMPLE);
  const room = draft.rooms[0]!;
  room.size_sqft = "49";
  room.max_guests = "13";
  room.beds_en = "x".repeat(41);
  room.features_en = ["", "y".repeat(41)];
  room.features_hi = ["हिंदी", ""];
  room.photo_id = "8";
  const errors = validateDraft(draft, { photoIds: [7] });
  assert.equal(errors["rooms.0.size_sqft"], "Use 50 to 5000 sq ft.");
  assert.equal(errors["rooms.0.max_guests"], "Use 1 to 12 guests.");
  assert.equal(errors["rooms.0.beds_en"], "Use 40 letters or fewer. This has 41.");
  assert.equal(errors["rooms.0.features_en.0"], "Add the English line too.");
  assert.equal(errors["rooms.0.features_en.1"], "Use 40 letters or fewer. This has 41.");
  assert.match(errors["rooms.0.photo_id"] ?? "", /no longer on your site/);
  room.size_sqft = "2.5";
  assert.equal(validateDraft(draft)["rooms.0.size_sqft"], "Use a whole number of sq ft.");
  assert.equal(fieldName("rooms.0.features_en.1"), "Room 1, feature in English");
  assert.equal(fieldName("good_to_know.0.text_en"), "House rules 1, English text");
});

test("rooms: Hindi features pair with English ones in order", () => {
  const draft = toDraft(SAMPLE);
  const room = draft.rooms[0]!;
  room.features_en = ["", "Fireplace"];
  room.features_hi = ["", "अंगीठी"];
  assert.deepEqual(validateDraft(draft), {});
  assert.deepEqual(fromDraft(draft).rooms[0]?.features_en, ["Fireplace"]);
  assert.deepEqual(fromDraft(draft).rooms[0]?.features_hi, ["अंगीठी"]);
  room.features_en = ["Balcony", "Fireplace"];
  room.features_hi = ["", "अंगीठी"];
  assert.ok(validateDraft(draft)["rooms.0.features_hi.0"]);
  room.features_hi = ["बालकनी", ""];
  assert.deepEqual(fromDraft(draft).rooms[0]?.features_hi, ["बालकनी"]);
});

test("card QR base: the site's own /h/<slug> address, else the app's", () => {
  assert.equal(
    qrBaseUrl("https://seedha-demo.vercel.app/h/deodar-view", "deodar-view", "https://x.test"),
    "https://seedha-demo.vercel.app/h/deodar-view",
  );
  assert.equal(
    qrBaseUrl("https://deodar-view.seedha.in", "deodar-view", "https://seedha-demo.vercel.app/"),
    "https://seedha-demo.vercel.app/h/deodar-view",
  );
  assert.equal(
    cardUrl(qrBaseUrl("http://localhost:3000/h/deodar-view", "deodar-view", ""), "wallet"),
    "http://localhost:3000/h/deodar-view?src=card-wallet",
  );
});

test("ratings in plain words", () => {
  assert.equal(ratingSource("desk"), "Checked out at the front desk");
  assert.equal(ratingSource("link"), "Booked direct");
  assert.equal(ratingSource("something"), "Verified guest");
  assert.equal(ratingDate("2026-10-03T09:30:00Z"), "3 October 2026");
  assert.equal(starsLabel(1), "1 of 5 stars");
  assert.equal(starsLabel(4), "4 of 5 stars");
  assert.equal(ratingsSummary(0), "No ratings yet.");
  assert.match(ratingsSummary(2), /once there are 3/);
  assert.match(ratingsSummary(3), /shows the average and the count/);
});
