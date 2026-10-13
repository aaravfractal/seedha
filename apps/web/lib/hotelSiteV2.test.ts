import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOTEL_SITES_TAG,
  hotelJsonLd,
  hotelPageHeaders,
  hotelSiteTag,
  jsonLdText,
  langFrom,
  mapsHref,
  pick,
  revalidatesHotelSites,
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

test("only successful owner writes mark the hotel pages stale", () => {
  assert.ok(revalidatesHotelSites("owner", "POST", 200));
  assert.ok(revalidatesHotelSites("owner", "PATCH", 204));
  assert.ok(revalidatesHotelSites("owner", "DELETE", 200));
  assert.equal(revalidatesHotelSites("owner", "GET", 200), false);
  assert.equal(revalidatesHotelSites("owner", "POST", 422), false);
  assert.equal(revalidatesHotelSites("public", "POST", 204), false);
  assert.equal(revalidatesHotelSites("device", "POST", 200), false);
  assert.equal(HOTEL_SITES_TAG, "hotel-sites");
  assert.equal(hotelSiteTag("pine-view"), "hotel-site:pine-view");
});

test("service worker scope: the hotel host root or the page's own path", () => {
  assert.equal(serviceWorkerScope("/", "pine-view"), "/");
  assert.equal(serviceWorkerScope("/h/pine-view", "pine-view"), "/h/pine-view");
});

test("Hotel JSON-LD has the facts and never a review, rating or price", () => {
  const data = hotelJsonLd(site());
  assert.equal(data["@type"], "Hotel");
  assert.equal(data.name, "Pine View");
  assert.equal(data.url, "https://pine-view.example.in");
  assert.equal(data.telephone, "+91 98765 43210");
  assert.deepEqual(data.geo, { "@type": "GeoCoordinates", latitude: 30.4598, longitude: 78.0664 });
  assert.deepEqual(data.image, ["https://pine-view.example.in/api/public/site/pine-view/photos/3?v=ab"]);
  assert.equal((data.amenityFeature as unknown[]).length, 2);
  assert.deepEqual(data.address, {
    "@type": "PostalAddress",
    streetAddress: "Camel's Back Road",
    addressLocality: "Mussoorie",
    addressCountry: "IN",
  });
  const text = JSON.stringify(data);
  for (const banned of ["review", "Review", "rating", "Rating", "priceRange", "offers"]) {
    assert.equal(text.includes(banned), false, banned);
  }
});

test("the sample hotel's placeholder phone and email stay out of the JSON-LD", () => {
  const data = hotelJsonLd(site({ sample: true, details: { ...DETAILS, sample: true } }));
  assert.equal(data.telephone, undefined);
  assert.equal(data.email, undefined);
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
