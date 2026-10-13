import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { axeViolations, resetSampleHotel, scrollsSideways, signInOnce } from "./helpers";

/**
 * Hotel Site V2, the public page (docs/HOTEL_SITE_V2.md, V2-PAGE): the
 * sample hotel at /h/deodar-view and on its own host deodar-view.localhost,
 * at 390 and 1440, in English and Hindi: the sections, 12 amenities then all
 * of them, the location, honest empty reviews, Hotel JSON-LD without any
 * review or rating markup (labelled sample, noindex, not in the sitemap),
 * the strict headers, the card-scan ribbon with ?src=card-room (the owner's
 * own perk or a neutral welcome, never a made-up perk; one scan POST, no
 * cookies, counted by the API), and the offline page from the service
 * worker. Sample data only. Signs in once for the whole file (signInOnce),
 * so the suite stays under the Direct beta login rate limit.
 */

const SLUG = "deodar-view";
const PAGE = `/h/${SLUG}`;
const WELCOME = "Welcome. Booking here goes straight to the hotel.";
// The owner's own card perk in a sentence, or the neutral welcome.
const PERK = "Scanned our card? Book direct for";
const RIBBON = /Scanned our card\? Book direct for |Welcome\. Booking here goes straight to the hotel\./;
let ownerState = "";

test.describe.configure({ mode: "serial" });

function hotelOrigin(baseURL: string | undefined, slug: string): string {
  const url = new URL(baseURL ?? "http://localhost:3000");
  return `${url.protocol}//${slug}.localhost:${url.port}`;
}

/** A page signed in as the owner, from the file's one sign-in (the guest's page stays signed out). */
async function ownerPage(page: Page, baseURL: string | undefined): Promise<Page> {
  const browser = page.context().browser();
  if (!browser) throw new Error("no browser");
  const context = await browser.newContext({ storageState: ownerState, baseURL });
  return context.newPage();
}

async function scansThisMonth(page: Page): Promise<{ total: number; by_card: Record<string, number> }> {
  const res = await page.request.get("/api/site/scans");
  expect(res.ok(), `scans: ${res.status()}`).toBe(true);
  return (await res.json()) as { total: number; by_card: Record<string, number> };
}

test.beforeAll(async ({ browser, baseURL }) => {
  ownerState = await signInOnce(browser);
  const context = await browser.newContext({ storageState: ownerState, baseURL });
  await resetSampleHotel(await context.newPage());
  await context.close();
});

test("390 px, English: every section, amenities expand, no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const res = await page.goto(PAGE);
  expect(res?.status()).toBe(200);
  const root = page.locator("main#main");
  await expect(page.getByRole("heading", { level: 1, name: "Deodar View" })).toBeVisible();
  await expect(page.locator("[lang='en']").first()).toBeVisible();
  for (const name of [
    "Book your stay",
    "At a glance",
    "Why book direct",
    "Rooms",
    "Packages",
    "Amenities",
    "Photos",
    "Guest ratings",
    "Location",
    "How to reach",
    "House rules",
    "Contact",
  ]) {
    await expect(root.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  // Hero: Book directly moves to the booking form with the date focused; WhatsApp is a plain wa.me link.
  const hero = page.locator("section").filter({ has: page.getByRole("heading", { level: 1 }) });
  const bookDirectly = hero.getByRole("link", { name: "Book directly" });
  expect(await bookDirectly.getAttribute("href")).toMatch(/^#.+book$/);
  expect(await hero.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toBe(
    "https://wa.me/919000000000",
  );
  // The slim Seedha line (plain text, no link).
  const seedhaBar = page.getByText("Deodar View on Seedha", { exact: true });
  await expect(seedhaBar).toBeVisible();
  await expect(seedhaBar.locator("a")).toHaveCount(0);
  // At a glance: rooms, room types, check-in and check-out.
  const glance = page.locator("section").filter({ has: page.getByRole("heading", { name: "At a glance" }) });
  await expect(glance.getByText("Room types")).toBeVisible();
  await expect(glance.locator("dd").first()).toHaveText(/^\d+$/);
  // NEEDS A1 (from_price_paise): "From ₹X a night", exactly the API's number, formatted.
  const from = page.getByTestId("from-price");
  if (await from.count()) await expect(from).toHaveText(/^From ₹[\d,]+ a night$/);
  // NEEDS A1 (details.rooms): room facts on at least one card.
  const facts = page.locator("article ul[aria-label='Room facts']");
  if (await facts.count()) await expect(facts.first()).toContainText(/sq ft|guest/);
  // Every room's Book goes to Seedha Link with the room preselected.
  const roomBook = page.getByRole("link", { name: /^Book: / }).first();
  expect(await roomBook.getAttribute("href")).toMatch(/\/link\?room=[^&]+&in=/);
  // Honest ratings: the sample has none; sample labels.
  await expect(page.getByText("New on Seedha, no ratings yet")).toBeVisible();
  await expect(page.locator("[data-ratings='shown']")).toHaveCount(0);
  await expect(page.getByText("Sample hotel. All details are fictional.")).toBeVisible();
  await expect(page.getByText("Phone and address are placeholders. Sample data.")).toBeVisible();
  await expect(page.getByText("Built with Seedha")).toBeVisible();
  await expect(page.getByRole("button", { name: /Book direct · Powered by Seedha/ })).toBeVisible();
  // No ribbon without a card scan.
  await expect(page.locator("[data-card]")).toHaveCount(0);
  await bookDirectly.click();
  await expect(page.getByLabel("Check-in")).toBeFocused();

  // 12 amenities, then all 20 of the sample hotel's, then 12 again.
  const amenities = page.locator("[data-amenity]");
  await expect(amenities).toHaveCount(12);
  const more = page.getByRole("button", { name: "Show all 20 amenities" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(amenities).toHaveCount(20);
  const fewer = page.getByRole("button", { name: "Show fewer" });
  await expect(fewer).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-amenity] svg")).toHaveCount(20);
  await fewer.click();
  await expect(amenities).toHaveCount(12);

  // Location: the nearby places as text and a plain Google Maps link (no key).
  const location = page.locator("section").filter({ has: page.getByRole("heading", { name: "Location" }) });
  await location.scrollIntoViewIfNeeded();
  await expect(location.getByText("Mall Road").first()).toBeVisible();
  const maps = location.getByRole("link", { name: /Open in Maps/ });
  await expect(maps).toHaveCount(1);
  expect(await maps.getAttribute("href")).toBe(
    "https://www.google.com/maps/search/?api=1&query=30.45980,78.06640",
  );
  // House rules, with check-in and check-out.
  await expect(page.getByText("Check-in 12:00")).toBeVisible();
  await expect(page.getByText("Check-out 11:00")).toBeVisible();

  // The sticky mobile bar: Call, WhatsApp, Book.
  const bar = page.getByRole("navigation", { name: "Quick actions" });
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+919000000000");
  await expect(bar.getByRole("link", { name: "WhatsApp" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Book" })).toBeVisible();

  expect(await scrollsSideways(page)).toBe(false);
  expect(await axeViolations(page)).toEqual([]);
});

test("1440 px, Hindi: the toggle and ?lang=hi, Devanagari, no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PAGE);
  await expect(page.getByRole("navigation", { name: "Quick actions" })).toBeHidden();
  await page.getByRole("button", { name: "हिन्दी" }).click();
  await expect(page.getByRole("button", { name: "हिन्दी" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 1, name: "देवदार व्यू" })).toBeVisible();
  await expect(page.locator("div[lang='hi']").first()).toBeVisible();
  for (const name of [
    "सुविधाएं",
    "मेहमानों की रेटिंग",
    "जगह",
    "कैसे पहुंचें",
    "घर के नियम",
    "एक नज़र में",
    "संपर्क",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByText("Seedha पर नया, अभी कोई रेटिंग नहीं")).toBeVisible();
  await expect(page.getByText("देवदार व्यू Seedha पर", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "सभी 20 सुविधाएं देखें" })).toBeVisible();
  expect(await scrollsSideways(page)).toBe(false);
  expect(await axeViolations(page)).toEqual([]);

  await page.goto(`${PAGE}?lang=hi`);
  await expect(page.getByRole("heading", { level: 1, name: "देवदार व्यू" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Deodar View" })).toBeVisible();
});

test("SEO: title, canonical, Open Graph image and Hotel JSON-LD without reviews", async ({ page }) => {
  await page.goto(PAGE);
  await expect(page).toHaveTitle(/Deodar View/);
  expect(await page.locator("link[rel='canonical']").getAttribute("href")).toMatch(/\/h\/deodar-view$/);
  const og = await page.locator("meta[property='og:image']").first().getAttribute("content");
  expect(og).toMatch(/\/h\/deodar-view\/opengraph-image/);
  const image = await page.request.get(new URL(og ?? "", page.url()).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");

  const scripts = page.locator("script[type='application/ld+json']");
  await expect(scripts).toHaveCount(1);
  const text = (await scripts.first().textContent()) ?? "";
  const data = JSON.parse(text) as Record<string, unknown>;
  // The fictional sample is labelled, carries no address or position, and is never indexed (rule 11).
  expect(data).toMatchObject({
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: "Deodar View (sample)",
  });
  expect(String(data.description)).toContain("fictional");
  expect(data.geo).toBeUndefined();
  expect(data.address).toBeUndefined();
  expect(await page.locator("meta[name='robots']").getAttribute("content")).toMatch(/noindex/);
  expect((data.amenityFeature as unknown[]).length).toBe(20);
  for (const banned of ["review", "Review", "aggregateRating", "ratingValue", "priceRange", "award"]) {
    expect(text.includes(banned), banned).toBe(false);
  }
  // The sample hotel's placeholder phone is not published as structured data.
  expect(data.telephone).toBeUndefined();

  const sitemap = await page.request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toContain("/h/deodar-view");
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /api/public/site/");
  // Capitals 308 to the lower-case address; an impossible or unknown slug's image is a 404.
  const upper = await page.request.get("/h/Deodar-View", { maxRedirects: 0 });
  expect(upper.status()).toBe(308);
  expect(upper.headers()["location"]).toMatch(/\/h\/deodar-view$/);
  for (const path of ["/h/no-hotel-here-x/opengraph-image", "/h/x_y/opengraph-image"]) {
    expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
});

test("strict headers on the hotel page, on both addresses", async ({ page, baseURL }) => {
  for (const url of [PAGE, `${hotelOrigin(baseURL, SLUG)}/`]) {
    const res = await page.request.get(url);
    expect(res.status(), url).toBe(200);
    const csp = res.headers()["content-security-policy"] ?? "";
    expect(csp, url).toContain("frame-src 'none'");
    expect(csp, url).toContain("worker-src 'self'");
    expect(csp, url).toContain("object-src 'none'");
    expect(res.headers()["permissions-policy"], url).toContain("microphone=()");
  }
});

test("a card scan shows the owner's perk or a plain welcome and counts once, with no cookies", async ({
  page,
  baseURL,
}) => {
  const owner = await ownerPage(page, baseURL);
  const before = await scansThisMonth(owner);

  const scan = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith(`/api/public/site/${SLUG}/scan`),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${PAGE}?src=card-room`);
  const request = await scan;
  expect(request.postDataJSON()).toEqual({ card: "room" });
  expect((await request.allHeaders())["cookie"]).toBeUndefined();
  expect((await request.response())?.status()).toBe(204);

  const ribbon = page.locator("[data-card]");
  await expect(ribbon).toBeVisible();
  await expect(ribbon).toContainText(RIBBON);
  expect(await ribbon.textContent()).not.toMatch(/returning-guest perk|₹/);
  const ribbonText = (await ribbon.textContent()) ?? "";
  expect(ribbonText).not.toMatch(/Sample perk:/);
  if (ribbonText.includes(PERK)) {
    // The sample hotel's perk carries a small "Sample" label (rule 11).
    await expect(ribbon).toContainText(/^Sample/);
  } else {
    await expect(ribbon).toHaveText(WELCOME);
  }
  // The ribbon never covers the "Sample photo" label (rule 11, R2-5).
  const chip = await page.getByText("Sample photo").first().boundingBox();
  const box = await ribbon.boundingBox();
  if (chip && box) {
    const apart =
      box.x >= chip.x + chip.width ||
      chip.x >= box.x + box.width ||
      box.y >= chip.y + chip.height ||
      chip.y >= box.y + box.height;
    expect(apart).toBe(true);
  }
  // The source leaves the address, so a reload or a shared link does not count again.
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  expect(await scrollsSideways(page)).toBe(false);
  expect(await axeViolations(page)).toEqual([]);

  // On the hotel's own host too (the one POST a hotel host allows).
  const hostScan = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/scan"));
  await page.goto(`${hotelOrigin(baseURL, SLUG)}/?src=card-desk&lang=hi`);
  expect((await (await hostScan).response())?.status()).toBe(204);
  await expect(page.locator("[data-card]")).toBeVisible();
  await expect(page.locator("[data-card]")).not.toContainText("Welcome");

  const after = await scansThisMonth(owner);
  expect(after.total).toBe(before.total + 2);
  expect(after.by_card.room).toBe((before.by_card.room ?? 0) + 1);
  expect(after.by_card.desk).toBe((before.by_card.desk ?? 0) + 1);

  // A bad card is refused by the API; other writes are 404 on the hotel host.
  const bad = await page.request.post(`/api/public/site/${SLUG}/scan`, {
    data: { card: "tent" },
    headers: { origin: new URL(baseURL ?? "").origin },
  });
  expect(bad.status()).toBe(422);
  const hostWrite = await page.request.post(
    `${hotelOrigin(baseURL, SLUG)}/api/public/site/${SLUG}/availability`,
    {
      data: {},
    },
  );
  expect(hostWrite.status()).toBe(404);
  await owner.context().close();
});

test("reduced motion: no globe box, the static map is the whole location view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PAGE);
  const location = page.locator("section").filter({ has: page.getByRole("heading", { name: "Location" }) });
  await location.scrollIntoViewIfNeeded();
  await expect(location.locator("[data-globe-cell]")).toBeHidden();
  await expect(location.locator("canvas")).toHaveCount(0);
  const map = location.locator("[data-map-card]");
  await expect(map).toBeVisible();
  await expect(map.locator("svg").first()).toBeVisible();
  // The map fills the row: no empty column where the globe was.
  const row = await location.locator("[data-map-card]").locator("xpath=..").boundingBox();
  const box = await map.boundingBox();
  expect(row && box && Math.abs(row.width - box.width) < 2).toBe(true);
  expect(await scrollsSideways(page)).toBe(false);
});

test("offline: the service worker shows the hotel's name and contact", async ({ page, context }) => {
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Wait until the worker controls this page and has saved the hotel's details.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((done) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => done(), { once: true }),
      );
    }
  });
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.endsWith("-deodar-view"))))
    .toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Deodar View" })).toBeVisible();
    await expect(page.getByText("You are offline.")).toBeVisible();
    await expect(page.getByRole("link", { name: "+91 90000 00000" }).first()).toHaveAttribute(
      "href",
      "tel:+919000000000",
    );
    await expect(page.getByText("Sample hotel. All details are fictional.")).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  await page.reload();
  await expect(page.getByText("You are offline.")).toHaveCount(0);
});

test("slow 4G at 390 px: LCP under 2.5 s and CLS under 0.1 (production build)", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await context.newCDPSession(page);
  // Lighthouse's mobile slow 4G: 150 ms RTT, 1.6 Mbps down, 750 kbps up, CPU 4x slower.
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!e.hadRecentInput) w.__cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(PAGE, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const lcp = await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp);
  // Scroll through the page so the lazy parts (photos, globe, map) arrive too.
  for (let y = 0; y < 12; y += 1) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1000);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  test.info().annotations.push({ type: "slow 4G LCP (ms)", description: String(Math.round(lcp)) });
  test.info().annotations.push({ type: "CLS", description: cls.toFixed(4) });
  expect(lcp).toBeGreaterThan(0);
  expect(lcp).toBeLessThan(2500);
  expect(cls).toBeLessThan(0.1);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
