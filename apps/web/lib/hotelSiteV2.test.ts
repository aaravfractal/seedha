import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOTEL_SITES_TAG,
  ROBOTS_RULES,
  cardPerk,
  cardPerkSentence,
  clip,
  fromPrice,
  monthLabel,
  perkWords,
  ratingCommentError,
  ratingHref,
  ratingsView,
  roomDetailFor,
  hotelJsonLd,
  hotelPageHeaders,
  hotelSiteTag,
  jsonLdText,
  langFrom,
  mapsHref,
  metaDescription,
  photoSources,
  pick,
  priceRange,
  hotelRevalidation,
  scanCardFrom,
  searchWithoutSrc,
  serviceWorkerScope,
  telHref,
  whatsappHref,
  withDetails,
} from "./hotelSiteV2.ts";
import type { HotelSitePayload, SiteDetailsData } from "./types-hotel-site.ts";

const DETAILS: SiteDetailsData = {
  amenities: ["wifi", "parking"],
  amenity_labels: [
    { id: "wifi", en: "Free Wi-Fi", hi: "मुफ़्त वाई-फ़ाई" },
    { id: "parking", en: "Free parking", hi: "मुफ़्त पार्किंग" },
  ],
  nearby: [],
  how_to_reach: [],
  good_to_know: [],
  check_in: "12:00",
  check_out: "11:00",
  contact: {
    phone: "+91 98765 43210",
    whatsapp: "+91 98765 43210",
    email: "stay@example.com",
    address_en: "Camel's Back Road",
    address_hi: "",
  },
  geo: { lat: 30.4598, lng: 78.0664 },
  sample: false,
};

function site(over: Partial<HotelSitePayload> = {}): HotelSitePayload {
  return {
    slug: "pine-view",
    address: "pine-view.example.in",
    sample: false,
    mood: "pine",
    lang: "en",
    hotel: "Pine View",
    hotel_hi: "पाइन व्यू",
    location: { en: "Mussoorie", hi: "मसूरी" },
    tagline: { en: "Quiet rooms under the deodars", hi: "" },
    rooms_count: 12,
    rooms: [],
    nearby: [],
    gallery: [],
    contact: { phone: "", upi: "", placeholder: false },
    url: "https://pine-view.example.in",
    source: "edited",
    text: null,
    photos: [
      {
        id: 3,
        url: "/api/public/site/pine-view/photos/3?v=ab",
        width: 1024,
        height: 768,
        caption_en: "",
        caption_hi: "",
      },
    ],
    hide_branding: false,
    booking_url: "/link",
    published: true,
    today: "2026-10-13",
    packages: [],
    redirect_to: null,
    details: DETAILS,
    ...over,
  };
}

test("only the three printed cards count as a scan", () => {
  assert.equal(scanCardFrom("?src=card-wallet"), "wallet");
  assert.equal(scanCardFrom("?src=card-room&lang=hi"), "room");
  assert.equal(scanCardFrom("src=card-desk"), "desk");
  for (const bad of [
    "",
    "?src=card",
    "?src=card-tent",
    "?src=CARD-ROOM",
    "?src=card-room-x",
    "?source=card-room",
    "?src=hasOwnProperty",
  ]) {
    assert.equal(scanCardFrom(bad), null, bad);
  }
});

test("the scan source is dropped from the address, everything else stays", () => {
  assert.equal(searchWithoutSrc("?src=card-room"), "");
  assert.equal(searchWithoutSrc("?src=card-room&lang=hi"), "?lang=hi");
  assert.equal(searchWithoutSrc("?lang=hi"), "?lang=hi");
  assert.equal(searchWithoutSrc(""), "");
});

test("?lang picks a language only for en and hi", () => {
  assert.equal(langFrom("?lang=hi"), "hi");
  assert.equal(langFrom("?lang=en"), "en");
  assert.equal(langFrom("?lang=fr"), null);
  assert.equal(langFrom(""), null);
});

test("links: maps without a key, wa.me and tel only when a number is set", () => {
  assert.equal(
    mapsHref({ lat: 30.4598, lng: 78.0664 }),
    "https://www.google.com/maps/search/?api=1&query=30.45980,78.06640",
  );
  assert.equal(mapsHref(null), "");
  assert.equal(mapsHref({ lat: Number.NaN, lng: 1 }), "");
  assert.equal(whatsappHref("+91 98765 43210"), "https://wa.me/919876543210");
  assert.equal(whatsappHref(""), "");
  assert.equal(telHref("+91 98765 43210"), "tel:+919876543210");
  assert.equal(telHref("0135 263 2000"), "tel:01352632000");
  assert.equal(telHref("  "), "");
});

test("Hindi falls back to English", () => {
  assert.equal(pick("Mall Road", "मॉल रोड", "hi"), "मॉल रोड");
  assert.equal(pick("Mall Road", " ", "hi"), "Mall Road");
  assert.equal(pick("Mall Road", "मॉल रोड", "en"), "Mall Road");
});

test("only the hotel's own site saves mark its page stale; the reset marks all (R1-3)", () => {
  const write = (over: Partial<Parameters<typeof hotelRevalidation>[0]> = {}) =>
    hotelRevalidation({
      access: "owner",
      method: "POST",
      status: 200,
      path: "site/publish",
      subject: "demo",
      hosted: false,
      ...over,
    });
  assert.equal(write(), "own");
  assert.equal(write({ method: "PATCH", path: "site" }), "own");
  assert.equal(write({ method: "PUT", path: "site/details" }), "own");
  assert.equal(write({ method: "DELETE", path: "site/photos/3", status: 204 }), "own");
  assert.equal(write({ method: "PATCH", path: "site/branding" }), "own");
  assert.equal(write({ path: "demo/reset" }), "all");
  // Not a site write, a read, a failure, or not an owner call.
  for (const path of ["ask", "messages/3/approve", "desk/checkin", "statements", "rooms/x/y/slip", "sites"]) {
    assert.equal(write({ path }), "none", path);
  }
  assert.equal(write({ method: "GET" }), "none");
  assert.equal(write({ method: "HEAD" }), "none");
  assert.equal(write({ status: 422 }), "none");
  assert.equal(write({ access: "public", path: "public/site/x/scan", status: 204 }), "none");
  assert.equal(write({ access: "device" }), "none");
  // Hosted: the Direct beta demo login cannot change the locked sample page.
  assert.equal(write({ hosted: true }), "none");
  assert.equal(write({ hosted: true, path: "demo/reset" }), "none");
  assert.equal(write({ hosted: true, subject: "owner-1" }), "own");
  assert.equal(HOTEL_SITES_TAG, "hotel-sites");
  assert.equal(hotelSiteTag("pine-view"), "hotel-site:pine-view");
});

test("robots: public pages and hotel photos may be crawled, the rest of the API may not (R3-4)", () => {
  assert.deepEqual(ROBOTS_RULES.allow, ["/", "/api/public/site/"]);
  assert.deepEqual(ROBOTS_RULES.disallow, ["/api/"]);
});

test("the card ribbon shows only the owner's own perk, never a made-up one (R1-9, R2-1)", () => {
  assert.equal(cardPerk({}, "en"), "");
  assert.equal(cardPerk({ card_perk_en: "  ", card_perk_hi: "" }, "hi"), "");
  assert.equal(cardPerk({ card_perk_en: "Tea on arrival", card_perk_hi: "" }, "hi"), "Tea on arrival");
  assert.equal(
    cardPerk({ card_perk_en: "Tea on arrival", card_perk_hi: "पहुंचने पर चाय" }, "hi"),
    "पहुंचने पर चाय",
  );
  assert.equal(withDetails({ ...site(), details: undefined } as never).details.card_perk_en, "");
});

test("photos: AVIF, WebP and JPEG at the API's widths, never wider than the photo (R3-1)", () => {
  const url = "/api/public/site/pine-view/photos/3?v=ab";
  const big = photoSources(url, 1024);
  assert.ok(big);
  assert.equal(
    big.avif,
    `${url}&w=480&fmt=avif 480w, ${url}&w=768&fmt=avif 768w, ${url}&w=1024&fmt=avif 1024w`,
  );
  assert.match(big.webp, /&w=768&fmt=webp 768w/);
  assert.equal(big.src, `${url}&w=1024&fmt=jpeg`);
  const small = photoSources(url, 600);
  assert.ok(small);
  assert.equal(small.jpeg, `${url}&w=480&fmt=jpeg 480w, ${url}&w=768&fmt=jpeg 600w`);
  assert.equal(small.src, `${url}&w=768&fmt=jpeg`);
  assert.equal(photoSources("/api/site/photos/3?v=ab", 1024), null);
  assert.equal(photoSources(url, 0), null);
});

test("meta description: the owner's text, else tagline, hotel and place; samples say so (R3-9)", () => {
  assert.equal(
    metaDescription(site()),
    "Quiet rooms under the deodars. Pine View in Mussoorie. Book directly with the hotel.",
  );
  const long = "Twelve quiet rooms ".repeat(20);
  const own = metaDescription(
    site({ text: { description: { en: long, hi: "" }, why_book_direct: { en: [], hi: [] } } }),
  );
  assert.ok(own.length <= 155, own);
  assert.ok(own.endsWith("…"));
  assert.match(metaDescription(site({ sample: true })), /^Sample hotel with fictional details\. /);
  assert.equal(clip("a b c", 10), "a b c");
});

test("price range from the owner's room prices, formatting only (R3-8)", () => {
  assert.equal(priceRange([]), "");
  assert.equal(priceRange([{ nightly_rate: 0 }]), "");
  assert.equal(priceRange([{ nightly_rate: 620000 }]), "₹6,200");
  assert.equal(priceRange([{ nightly_rate: 620000 }, { nightly_rate: 430000 }]), "₹4,300 to ₹6,200");
});

test("service worker scope: the hotel host root or the page's own path", () => {
  assert.equal(serviceWorkerScope("/", "pine-view"), "/");
  assert.equal(serviceWorkerScope("/h/pine-view", "pine-view"), "/h/pine-view");
});

test("Hotel JSON-LD has the facts and never a review or rating", () => {
  const data = hotelJsonLd(
    site({ rooms: [{ nightly_rate: 430000 } as never, { nightly_rate: 620000 } as never] }),
  );
  assert.equal(data["@type"], "Hotel");
  assert.equal(data.name, "Pine View");
  assert.equal(data.url, "https://pine-view.example.in");
  assert.equal(data.telephone, "+91 98765 43210");
  assert.deepEqual(data.geo, { "@type": "GeoCoordinates", latitude: 30.4598, longitude: 78.0664 });
  assert.deepEqual(data.image, ["https://pine-view.example.in/api/public/site/pine-view/photos/3?v=ab"]);
  assert.equal(data.priceRange, "₹4,300 to ₹6,200");
  assert.equal((data.amenityFeature as unknown[]).length, 2);
  assert.deepEqual(data.address, {
    "@type": "PostalAddress",
    streetAddress: "Camel's Back Road",
    addressLocality: "Mussoorie",
    addressCountry: "IN",
  });
  const text = JSON.stringify(data);
  for (const banned of ["review", "Review", "rating", "Rating", "offers"]) {
    assert.equal(text.includes(banned), false, banned);
  }
  // No priced room, no photo: no priceRange and no image (nothing invented).
  const bare = hotelJsonLd(site({ photos: [] }));
  assert.equal(bare.priceRange, undefined);
  assert.equal(bare.image, undefined);
});

test("the sample hotel's JSON-LD is labelled and carries no address, position, phone or email (R1-5)", () => {
  const data = hotelJsonLd(site({ sample: true, details: { ...DETAILS, sample: true } }));
  assert.equal(data.name, "Pine View (sample)");
  assert.match(String(data.description), /fictional/);
  for (const key of ["telephone", "email", "address", "geo", "priceRange"]) {
    assert.equal(data[key], undefined, key);
  }
});

test("JSON-LD text cannot close its script tag", () => {
  const text = jsonLdText({ name: "</script><script>alert(1)</script>" });
  assert.equal(text.includes("<"), false);
  assert.deepEqual(JSON.parse(text), { name: "</script><script>alert(1)</script>" });
});

test("hotel page headers are strict", () => {
  const headers = Object.fromEntries(hotelPageHeaders(false).map((h) => [h.key, h.value]));
  const csp = headers["Content-Security-Policy"] ?? "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self'(;|$)/);
  assert.match(csp, /worker-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-src 'none'/);
  assert.equal(csp.includes("unsafe-eval"), false);
  assert.match(headers["Permissions-Policy"] ?? "", /microphone=\(\)/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Cache-Control"], "public, max-age=0, must-revalidate");
  assert.match(hotelPageHeaders(true)[0]!.value, /'unsafe-eval'/);
});

test("a payload without details (an older API) still gets every list", () => {
  const rest: Omit<HotelSitePayload, "details"> & { details?: undefined } = { ...site(), details: undefined };
  const filled = withDetails(rest);
  assert.deepEqual(filled.details.amenity_labels, []);
  assert.deepEqual(filled.details.nearby, []);
  assert.equal(filled.details.geo, null);
  assert.equal(filled.details.contact.whatsapp, "");
  const partial = withDetails({ ...rest, details: { contact: { phone: "+91 1234567" } } as never });
  assert.equal(partial.details.contact.phone, "+91 1234567");
  assert.equal(partial.details.contact.email, "");
  assert.equal(partial.details.check_in, "12:00");
});

test("card perk sentence: the owner's words, no 'Sample perk:' prefix, nothing when unset", () => {
  assert.equal(perkWords("Sample perk: masala chai on arrival."), "masala chai on arrival");
  assert.equal(perkWords("नमूना पर्क: मसाला चाय।"), "मसाला चाय");
  assert.equal(
    cardPerkSentence("Sample perk: masala chai on arrival", "en"),
    "Scanned our card? Book direct for masala chai on arrival.",
  );
  assert.equal(
    cardPerkSentence("free breakfast", "hi"),
    "हमारा कार्ड स्कैन किया? सीधे बुक करें और पाएं: free breakfast।",
  );
  assert.equal(cardPerkSentence("  ", "en"), "");
  assert.equal(cardPerkSentence("Sample perk:", "en"), "");
});

test("room details match the room type by name; missing rooms list is fine", () => {
  const room = {
    name: "Deluxe Valley",
    size_sqft: 240,
    beds_en: "1 king bed",
    beds_hi: "",
    max_guests: 2,
    features_en: ["Balcony"],
    features_hi: [],
    photo_id: null,
  };
  assert.equal(roomDetailFor([room], " deluxe valley "), room);
  assert.equal(roomDetailFor([room], "Suite"), null);
  assert.equal(roomDetailFor(undefined, "Suite"), null);
  assert.deepEqual(withDetails({ ...site(), details: undefined } as never).details.rooms, []);
});

test("from price only as the API sends it", () => {
  assert.equal(fromPrice({ from_price_paise: 430000 }), 430000);
  for (const p of [undefined, null, 0, -5, 12.5])
    assert.equal(fromPrice({ from_price_paise: p as never }), null);
});

test("ratings: a number only with 3 or more real ratings", () => {
  assert.deepEqual(ratingsView(undefined), { kind: "new" });
  assert.deepEqual(ratingsView({ count: 2, average: null, comments: [] }), { kind: "new" });
  assert.deepEqual(ratingsView({ count: 2, average: 5, comments: [] }), { kind: "new" });
  const shown = ratingsView({
    count: 4,
    average: 4.25,
    comments: [
      { stars: 5, comment: "Quiet rooms", month: "2026-09" },
      { stars: 4, comment: " ", month: "2026-09" },
    ],
  });
  assert.equal(shown.kind, "shown");
  if (shown.kind === "shown") {
    assert.equal(shown.average, "4.3");
    assert.equal(shown.count, 4);
    assert.equal(shown.comments.length, 1);
  }
  assert.equal(monthLabel("2026-09", "en"), "Sep 2026");
  assert.equal(monthLabel("2026-10", "hi"), "अक्टूबर 2026");
  assert.equal(monthLabel("soon", "en"), "soon");
});

test("JSON-LD carries no rating even with real ratings", () => {
  const text = JSON.stringify(
    hotelJsonLd({ ...site(), ratings: { count: 9, average: 4.5, comments: [] } } as HotelSitePayload),
  );
  assert.doesNotMatch(text, /aggregateRating|ratingValue|review/i);
});

test("rating comment and rating link checks", () => {
  assert.equal(ratingCommentError(""), null);
  assert.equal(ratingCommentError("a".repeat(200)), null);
  assert.equal(ratingCommentError("a".repeat(201)), "too_long");
  assert.equal(ratingCommentError("nice <b>"), "bad_chars");
  assert.equal(ratingHref("/rate/abc"), "/rate/abc");
  assert.equal(ratingHref("https://seedha.example/rate/abc"), "https://seedha.example/rate/abc");
  for (const bad of ["//evil.example/x", "javascript:alert(1)", "", null, undefined])
    assert.equal(ratingHref(bad), "");
});
