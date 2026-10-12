import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookingLink,
  hotelHost,
  hotelPathAllowed,
  hotelPathSlug,
  legacyHotelPath,
  movedHostUrl,
  rootDomain,
  shareMessage,
  siteAddress,
  slugProblem,
  toSlug,
  whatsappShareHref,
} from "./siteHost.ts";
import { clearSessionCookie, sessionCookie } from "./session.ts";

test("slug rules match the API", () => {
  for (const ok of ["deodar-view", "abc", "a".repeat(40), "hotel-7", "7-hills"]) {
    assert.equal(slugProblem(ok), null, ok);
  }
  for (const bad of [
    "ab",
    "a".repeat(41),
    "-deodar",
    "deodar-",
    "deodar--view",
    "Deodar",
    "deo_dar",
    "देवदार",
    "",
  ]) {
    assert.equal(slugProblem(bad), "slug_invalid", bad);
  }
  for (const word of ["www", "app", "api", "admin", "mail", "docs", "status", "login", "localhost"]) {
    assert.equal(slugProblem(word), "slug_reserved", word);
  }
});

test("typing is turned into slug form", () => {
  assert.equal(toSlug("Deodar View"), "deodar-view");
  assert.equal(toSlug("Deodar View!"), "deodar-view-"); // a trailing hyphen while typing
  assert.equal(toSlug("  --Hotel  7 "), "hotel-7-");
  assert.equal(toSlug("x".repeat(60)).length, 40);
});

test("root domain is normalised", () => {
  assert.equal(rootDomain(" https://Seedha.IN/ "), "seedha.in");
  assert.equal(rootDomain("seedha.in:443"), "seedha.in");
  assert.equal(rootDomain(".seedha.in."), "seedha.in");
  assert.equal(rootDomain(undefined), "");
  assert.equal(rootDomain(""), "");
});

test("hotel hosts are exactly <slug>.<root> or <slug>.localhost", () => {
  assert.deepEqual(hotelHost("deodar-view.seedha.in", "seedha.in"), {
    slug: "deodar-view",
    root: "seedha.in",
  });
  assert.deepEqual(hotelHost("Deodar-View.Seedha.in:443", "seedha.in"), {
    slug: "deodar-view",
    root: "seedha.in",
  });
  assert.deepEqual(hotelHost("deodar-view.localhost:3000", ""), { slug: "deodar-view", root: "localhost" });
  assert.deepEqual(hotelHost("deodar-view.localhost:3000", "seedha.in"), {
    slug: "deodar-view",
    root: "localhost",
  });
  for (const app of [
    "seedha.in",
    "www.seedha.in",
    "app.seedha.in",
    "api.seedha.in",
    "a.b.seedha.in",
    "ab.seedha.in",
    "evil-seedha.in",
    "deodar-view.seedha.in.evil.com",
    "seedha-web.vercel.app",
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.0.10:3000",
    "",
  ]) {
    assert.equal(hotelHost(app, "seedha.in"), null, app);
  }
  assert.equal(hotelHost("deodar-view.seedha.in", ""), null);
});

test("hotel hosts serve only the page and their own public API", () => {
  const allowed = (path: string, method = "GET") => hotelPathAllowed(path, method, "deodar-view");
  assert.ok(allowed("/"));
  assert.ok(allowed("/_next/static/chunks/app.js"));
  assert.ok(allowed("/api/public/site/deodar-view"));
  assert.ok(allowed("/api/public/site/deodar-view/availability"));
  assert.ok(allowed("/api/public/site/deodar-view/photos/3", "HEAD"));
  for (const path of [
    "/login",
    "/home",
    "/site",
    "/settings",
    "/h/deodar-view",
    "/link",
    "/api/site",
    "/api/auth/demo",
    "/api/public/site/other-hotel",
    "/api/public/site/deodar-viewer",
    "/api/public/link",
  ]) {
    assert.equal(allowed(path), false, path);
  }
  assert.equal(allowed("/api/public/site/deodar-view", "POST"), false);
});

test("paths: /h/<slug> and the old /hotel/<slug>", () => {
  assert.equal(hotelPathSlug("/h/deodar-view"), "deodar-view");
  assert.equal(hotelPathSlug("/h/Deodar-View/"), "deodar-view");
  assert.equal(hotelPathSlug("/h/deodar-view/x"), null);
  assert.equal(hotelPathSlug("/h/%E0%A4"), null);
  assert.equal(hotelPathSlug("/home"), null);
  assert.equal(legacyHotelPath("/hotel/deodar-view"), "/h/deodar-view");
  assert.equal(legacyHotelPath("/hotel/deodar-view/"), "/h/deodar-view");
  assert.equal(legacyHotelPath("/hotels"), null);
});

test("a renamed hotel host moves to the new subdomain", () => {
  const local = new URL("http://old-name.localhost:3000/?lang=hi");
  assert.equal(
    movedHostUrl(local, "old-name.localhost:3000", "new-name", "localhost"),
    "http://new-name.localhost:3000/?lang=hi",
  );
  const live = new URL("https://old-name.seedha.in/");
  assert.equal(
    movedHostUrl(live, "old-name.seedha.in", "new-name", "seedha.in"),
    "https://new-name.seedha.in/",
  );
});

test("WhatsApp share uses a plain wa.me link with the message encoded", () => {
  const text = shareMessage("Deodar View", "https://deodar-view.seedha.in");
  assert.equal(text, "Book Deodar View directly on our own website: https://deodar-view.seedha.in");
  assert.equal(
    whatsappShareHref(text),
    "https://wa.me/?text=Book%20Deodar%20View%20directly%20on%20our%20own%20website%3A%20https%3A%2F%2Fdeodar-view.seedha.in",
  );
});

test("owner cookies stay on the app host (no Domain attribute)", () => {
  for (const cookie of [
    sessionCookie("v", { remember: true, secure: true }),
    sessionCookie("v", { remember: false, secure: false }),
    clearSessionCookie(true),
  ]) {
    assert.doesNotMatch(cookie, /domain=/i);
  }
});

test("booking buttons go to Seedha Link on the app host", () => {
  const path = "/link?room=standard&in=2026-11-02&nights=2";
  assert.equal(
    bookingLink("https://app.seedha.in/link", path),
    "https://app.seedha.in/link?room=standard&in=2026-11-02&nights=2",
  );
  assert.equal(bookingLink("/link", path), path);
  assert.equal(bookingLink("/link", path, { protocol: "http:", hostname: "localhost", port: "3000" }), path);
  assert.equal(
    bookingLink("/link", path, { protocol: "http:", hostname: "deodar-view.localhost", port: "3935" }),
    `http://localhost:3935${path}`,
  );
  assert.equal(
    bookingLink("/link", "/link", { protocol: "https:", hostname: "x-y.localhost", port: "" }),
    "https://localhost/link",
  );
  assert.equal(bookingLink("https://app.seedha.in/link", "/link"), "https://app.seedha.in/link");
});

test("the live address preview", () => {
  assert.equal(siteAddress("deodar-view", "seedha.in", "app.seedha.in"), "deodar-view.seedha.in");
  assert.equal(siteAddress("deodar-view", "", "localhost:3000"), "localhost:3000/h/deodar-view");
});
