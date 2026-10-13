/*
 * Seedha hotel page offline worker (Hotel Site V2, docs/HOTEL_SITE_V2.md).
 *
 * Registered only by a hotel's public page, scoped to that page
 * (/h/<slug>, or "/" on the hotel's own host), with ?slug=<slug>. It keeps
 * exactly one thing: the hotel's public site JSON (name, place, contact), and
 * when the page cannot load offline it answers with a small page built from
 * it: the hotel's name and how to reach them. Nothing about the visitor is
 * stored, no other API response is cached, and every other request passes
 * straight to the network untouched.
 */
"use strict";

const VERSION = "v2";
const SLUG = new URL(self.location.href).searchParams.get("slug") || "";
const VALID = SLUG.length >= 3 && SLUG.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(SLUG);
const CACHE = `seedha-hotel-${VERSION}-${SLUG}`;
const DATA = `/api/public/site/${SLUG}`;
const FRESH_MS = 15 * 60 * 1000;

/** True when the server says the hotel's page or data is gone (unpublished or unknown). */
function gone(res) {
  return res.status === 404 || res.status === 410;
}

/**
 * The hotel is gone: delete everything this worker kept for it and
 * unregister, so no withdrawn contact stays in the visitor's browser
 * (security review R1-6).
 */
function forget() {
  return caches
    .keys()
    .then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("seedha-hotel-") && k.endsWith(`-${SLUG}`))
          .map((k) => caches.delete(k)),
      ),
    )
    .then(() => self.registration.unregister())
    .catch(() => undefined);
}

/** Save the hotel's current public data (always replacing the old copy), or forget it when it is gone. */
function saveSite() {
  return fetch(DATA, { credentials: "omit", cache: "no-store", headers: { accept: "application/json" } })
    .then((res) => {
      if (gone(res)) return forget();
      return res.ok ? caches.open(CACHE).then((cache) => cache.put(DATA, res)) : undefined;
    })
    .catch(() => undefined);
}

self.addEventListener("install", (event) => {
  if (VALID) event.waitUntil(saveSite());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("seedha-hotel-") && k.endsWith(`-${SLUG}`) && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** The hotel's own page and nothing else: "/" on the hotel's host (scope "/"), else /h/<slug>. */
function isHotelPage(url) {
  if (new URL(self.registration.scope).pathname === "/") return url.pathname === "/";
  return url.pathname === `/h/${SLUG}` || url.pathname === `/h/${SLUG}/`;
}

function esc(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function digits(text) {
  return String(text || "").replace(/\D/g, "");
}

function offlineHtml(site) {
  const contact = (site && site.details && site.details.contact) || {};
  const name = (site && site.hotel) || "This hotel";
  const place = (site && site.location && site.location.en) || "";
  const phone = contact.phone || (site && site.contact && site.contact.phone) || "";
  const whatsapp = contact.whatsapp || phone;
  const rows = [];
  if (digits(phone).length >= 6) {
    const plus = phone.trim().startsWith("+") ? "+" : "";
    rows.push(`<li><span>Phone</span><a href="tel:${plus}${digits(phone)}">${esc(phone)}</a></li>`);
  }
  if (digits(whatsapp).length >= 6) {
    rows.push(
      `<li><span>WhatsApp</span><a href="https://wa.me/${digits(whatsapp)}">${esc(whatsapp)}</a></li>`,
    );
  }
  if (contact.email) {
    rows.push(`<li><span>Email</span><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></li>`);
  }
  if (contact.address_en) rows.push(`<li><span>Address</span><span>${esc(contact.address_en)}</span></li>`);
  const sample = site && site.sample ? "<p class=n>Sample hotel. All details are fictional.</p>" : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(name)} · offline</title>
<style>body{margin:0;min-height:100svh;background:#F5F1E8;color:#1D1D1F;font:17px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:560px;margin:0 auto;padding:48px 16px}h1{font:600 40px/1.1 Georgia,serif;margin:0 0 8px;color:#1F4D3A}
p{margin:0 0 16px}.m{color:#6E6E73}.n{color:#6E6E73;font-size:15px}ul{list-style:none;margin:24px 0;padding:0}
li{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 16px;padding:12px 0;border-bottom:1px solid #DDD5C6}
li span:first-child{font-weight:600}a{color:#1F4D3A;font-weight:600;min-height:44px;display:inline-flex;align-items:center}
.b{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:999px;background:#1F4D3A;color:#fff;text-decoration:none}
a:focus-visible{outline:3px solid #1F4D3A;outline-offset:3px}</style></head>
<body><main><p class=m>${esc(place)}</p><h1>${esc(name)}</h1>
<p>You are offline. This page will load again when you are back online.</p>
<p class=m lang="hi">आप ऑफ़लाइन हैं। इंटरनेट वापस आने पर यह पेज फिर खुलेगा।</p>
${rows.length ? `<ul>${rows.join("")}</ul>` : ""}${sample}
<a class=b href="">Try again</a></main></body></html>`;
}

function offlineResponse() {
  return caches
    .open(CACHE)
    .then((cache) => cache.match(DATA))
    .then((res) => (res ? res.json() : null))
    .catch(() => null)
    .then(
      (site) =>
        new Response(offlineHtml(site), {
          status: 503,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy":
              "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
          },
        }),
    );
}

/** Refresh the saved site when it is older than 15 minutes, after a page load that worked. */
function refreshIfOld() {
  return caches
    .open(CACHE)
    .then((cache) => cache.match(DATA))
    .then((res) => {
      const date = res ? Date.parse(res.headers.get("date") || "") : NaN;
      if (!res || !(Date.now() - date < FRESH_MS)) return saveSite();
      return undefined;
    })
    .catch(() => undefined);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!VALID || request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !isHotelPage(url)) return;
  event.respondWith(
    fetch(request).then(
      (res) => {
        event.waitUntil(gone(res) ? forget() : refreshIfOld());
        return res;
      },
      () => offlineResponse(),
    ),
  );
});
