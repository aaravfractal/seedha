import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { BrowserContext, Page, Route } from "@playwright/test";
import { axeViolations, resetSampleHotel, signIn } from "./helpers";

/**
 * Seedha Site real mode, end to end on the real API (docs/SITE_REAL.md
 * section 6, T2): four real JPEGs made in the browser, the owner's words
 * (typed and through a stand-in speech recogniser), rooms with the owner's
 * prices, Generate (Sample: the e2e API has no Claude key), edit and save,
 * Regenerate behind "This uses AI credit" (key and "generated" result mocked
 * with page.route), Publish under a chosen slug, then the public page at
 * /h/<slug> and <slug>.localhost:<port> with those prices and photos, Copy,
 * Share on WhatsApp, the QR PNG and the Pro branding switch. Sample hotel
 * only; it is reset before and after.
 */

const SLUG = "deodar-build-t2";
const NOT_LIVE = "This hotel site isn't live yet";
const OWNER_WORDS = "Six quiet rooms under old deodar trees, a short walk from the Mall Road.";
const SPOKEN = "Breakfast is cooked on a wood fire every morning.";
const EDITED = "Edited by the owner in the T2 test: a quiet family hotel among the deodars.";
const ROOMS = [
  { name: "Valley Suite", price: "5250", shown: "₹5,250" },
  { name: "Forest Cottage", price: "3875", shown: "₹3,875" },
  // Same name and price as the sample hotel's rate, so Seedha Link can book it
  // and the booking bar shows (the other two say "Ask the hotel").
  { name: "Deluxe Valley View", price: "4300", shown: "₹4,300" },
];
const BUILD_URL = /\/api\/site\/build(\?.*)?$/;
const GENERATE_URL = /\/api\/site\/build\/generate(\?.*)?$/;

test.describe.configure({ mode: "serial" });

function hotelOrigin(baseURL: string | undefined, slug: string): string {
  const url = new URL(baseURL ?? "http://localhost:3000");
  return `${url.protocol}//${slug}.localhost:${url.port}`;
}

/** Four small, real JPEGs drawn in the browser (different colours, 800x600). */
async function makeJpegs(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }[]> {
  const encoded = await page.evaluate(async () => {
    const colours = ["#1E6B4E", "#2F6FA8", "#A35A2A", "#5B4A8C"];
    const out: string[] = [];
    for (const [i, colour] of colours.entries()) {
      const canvas = new OffscreenCanvas(800, 600);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(100 + i * 120, 150, 200, 300);
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      out.push(btoa(binary));
    }
    return out;
  });
  return encoded.map((b64, i) => ({
    name: `t2-photo-${i + 1}.jpg`,
    mimeType: "image/jpeg",
    buffer: Buffer.from(b64, "base64"),
  }));
}

/** A stand-in for the browser's speech recogniser: one final phrase, then it ends. */
function fakeSpeech(phrase: string): void {
  class FakeRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    start(): void {
      setTimeout(() => {
        const result = Object.assign([{ transcript: phrase }], { isFinal: true });
        this.onresult?.({ resultIndex: 0, results: { length: 1, 0: result } });
        this.onend?.();
      }, 50);
    }
    stop(): void {
      this.onend?.();
    }
    abort(): void {}
  }
  Object.defineProperty(window, "SpeechRecognition", { value: FakeRecognition, configurable: true });
  Object.defineProperty(window, "webkitSpeechRecognition", { value: FakeRecognition, configurable: true });
}

/** axe at 1440 and 390, light and dark, on the page as it is now (no reload, so step state stays). */
async function axeSweep(page: Page, context: BrowserContext, baseURL: string | undefined, where: string) {
  const found: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await context.addCookies([{ name: "seedha_theme", value: theme, url: baseURL ?? "" }]);
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const v of await axeViolations(page)) found.push(`${where} ${theme} ${width}px: ${v}`);
    }
  }
  await context.addCookies([{ name: "seedha_theme", value: "light", url: baseURL ?? "" }]);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(found).toEqual([]);
}

/** Pass a request through to the real API without a cached ETag, so the body is always there. */
async function fetchFresh(route: Route) {
  const headers = { ...route.request().headers() };
  delete headers["if-none-match"];
  return route.fetch({ headers });
}

test("build, generate, edit, regenerate and publish the site", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.addInitScript(fakeSpeech, SPOKEN);
  await signIn(page);
  await resetSampleHotel(page);
  expect((await page.request.patch("/api/site", { data: { stage: "empty" } })).ok()).toBe(true);

  // Website screen: "Build my site", WhatsApp building is only "coming soon".
  await page.goto("/site");
  await expect(page.getByText("Coming soon: build on WhatsApp")).toBeVisible();
  await page.getByRole("button", { name: "Build my site" }).click();

  // 1. Photos: four real JPEGs, each uploaded with its own request.
  await expect(page.getByRole("heading", { name: "Add 4 to 8 photos" })).toBeVisible();
  await expect(page.getByText("0 of 8 photos · add 4 more to continue")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Add at least 4 photos" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(await makeJpegs(page));
  await expect(page.getByText("4 of 8 photos", { exact: true })).toBeVisible({ timeout: 30_000 });
  const grid = page.getByRole("list", { name: "Your photos, in order" });
  await expect(grid.getByRole("listitem")).toHaveCount(4);
  const before = (await (await page.request.get("/api/site/photos")).json()) as { photos: { id: number }[] };
  await grid.getByRole("button", { name: "Move photo 2 earlier" }).click();
  await expect(page.getByText("Photo moved to place 1 of 4.")).toBeAttached();
  await expect
    .poll(async () => {
      const now = (await (await page.request.get("/api/site/photos")).json()) as { photos: { id: number }[] };
      return now.photos.map((p) => p.id);
    })
    .toEqual([before.photos[1]?.id, before.photos[0]?.id, before.photos[2]?.id, before.photos[3]?.id]);
  await axeSweep(page, context, baseURL, "photos step");
  await page.getByRole("button", { name: "Next" }).click();

  // 2. Describe: typed, plus a phrase from the (stand-in) speech recogniser.
  await expect(page.getByRole("heading", { name: "Tell guests about your hotel" })).toBeFocused();
  const about = page.getByRole("textbox", { name: "About your hotel" });
  await about.fill(OWNER_WORDS);
  await expect(page.getByRole("button", { name: "Speak" })).toBeVisible();
  await page.getByRole("button", { name: "Speak" }).click();
  await expect(about).toHaveValue(`${OWNER_WORDS} ${SPOKEN}`);
  await axeSweep(page, context, baseURL, "describe step");
  await page.getByRole("button", { name: "Next" }).click();

  // 3. Rooms with the owner's own prices.
  await expect(page.getByRole("heading", { name: "Rooms and prices" })).toBeFocused();
  for (const [i, room] of ROOMS.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Add a room type" }).click();
    await page.getByLabel(`Room ${i + 1} name`).fill(room.name);
    await page.getByLabel("Price for one night (₹)").nth(i).fill(room.price);
    await expect(page.getByText(`Shown as ${room.shown} a night`)).toBeVisible();
  }
  await axeSweep(page, context, baseURL, "rooms step");
  await page.getByRole("button", { name: "Next" }).click();

  // 4. Generate: no key in e2e, so the labelled Sample.
  await expect(page.getByRole("heading", { name: "Write my site" })).toBeFocused();
  const saved = (await (await page.request.get("/api/site/build")).json()) as {
    owner_description: string;
    rooms: { name: string; price_paise: number }[];
  };
  expect(saved.owner_description).toBe(`${OWNER_WORDS} ${SPOKEN}`);
  expect(saved.rooms.map((r) => [r.name, r.price_paise])).toEqual([
    ["Valley Suite", 525_000],
    ["Forest Cottage", 387_500],
    ["Deluxe Valley View", 430_000],
  ]);
  await expect(page.getByText("No AI key is set up here, so this writes Sample text.")).toBeVisible();

  // Where the browser has no speech recognition, the mic gives way to a typed-fallback note.
  const plain = await browser.newContext({ storageState: await context.storageState() });
  await plain.addInitScript(() => {
    for (const name of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      Object.defineProperty(window, name, { value: undefined, configurable: true });
    }
  });
  const tab = await plain.newPage();
  await tab.goto("/site");
  await tab.getByRole("button", { name: "Describe" }).click();
  await expect(tab.getByRole("textbox", { name: "About your hotel" })).toHaveValue(
    `${OWNER_WORDS} ${SPOKEN}`,
  );
  await expect(tab.getByText("Speaking is not available in this browser, so please type.")).toBeVisible();
  await expect(tab.getByRole("button", { name: "Speak" })).toHaveCount(0);
  await plain.close();

  await page.getByRole("button", { name: "Write my site" }).click();
  const note = page.getByRole("status").filter({ hasText: "Sample text." });
  await expect(note).toContainText("AI writing is not switched on here.");
  await axeSweep(page, context, baseURL, "generate step");
  await page.getByRole("button", { name: "Review my site" }).click();

  // 5. Review. Regenerate asks first; the key and a "generated" result are mocked.
  await expect(page.getByRole("heading", { name: "Your site text" })).toBeVisible();
  await page.route(BUILD_URL, async (route) => {
    const res = await fetchFresh(route);
    await route.fulfill({ response: res, json: { ...(await res.json()), key_configured: true } });
  });
  await page.route(GENERATE_URL, async (route) => {
    const res = await fetchFresh(route);
    const json = (await res.json()) as Record<string, unknown>;
    await route.fulfill({
      response: res,
      json: {
        ...json,
        key_configured: true,
        status: "generated",
        source: "claude",
        message: "",
        fallback_fields: [],
        generations_today: 1,
      },
    });
  });
  await page.reload();
  await expect(page.getByText("AI writing: 0 of 3 used today.")).toBeVisible();
  await page.getByRole("button", { name: "Regenerate" }).click();
  const confirm = page.getByRole("alertdialog", { name: "This uses AI credit" });
  await expect(confirm).toContainText("It counts as 1 of 3 runs today (3 left).");
  await expect(confirm).toContainText("Prices stay exactly as you typed them.");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await page.getByRole("button", { name: "Regenerate" }).click();
  await confirm.getByRole("button", { name: "Use 1 run" }).click();
  await expect(page.getByText("Your site text is ready.")).toBeVisible();
  await expect(page.getByText("Written with Claude · check every line")).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();

  // Edit one generated field and save it.
  const aboutHotel = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "About the hotel" }) });
  await aboutHotel.getByLabel("English", { exact: true }).fill(EDITED);
  await expect(aboutHotel.getByText("Not saved")).toBeVisible();
  await aboutHotel.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. Only you see it until you publish.")).toBeVisible();
  await expect(aboutHotel.getByText("Not saved")).toHaveCount(0);
  const edited = (await (await page.request.get("/api/site/build")).json()) as {
    source: string;
    content: { description_en: string };
  };
  expect(edited).toMatchObject({ source: "edited", content: { description_en: EDITED } });
  await expect(page.getByText("Edited by you", { exact: true })).toBeVisible();

  // Nothing is public before Publish.
  expect((await page.request.get(`/h/${SLUG}`, { maxRedirects: 0 })).status()).toBe(404);

  // Publish under the owner's slug.
  const picker = page.getByRole("region", { name: "Pick your address" });
  await picker.getByLabel("Address", { exact: true }).fill(SLUG);
  await expect(picker.getByText("Available")).toBeVisible();
  await axeSweep(page, context, baseURL, "review");
  await picker.getByRole("button", { name: "Publish site" }).click();
  const live = page.getByRole("region", { name: "Your site is live" });
  await expect(live).toBeVisible();
  const address = (await (await page.request.get("/api/site/address")).json()) as { url: string };
  expect(address.url).toMatch(new RegExp(`/h/${SLUG}$`));

  // Copy, Share on WhatsApp and the QR PNG.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(baseURL ?? "").origin,
  });
  await live.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByText("Address copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address.url);
  const href = (await live.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href")) ?? "";
  expect(href.startsWith("https://wa.me/?text=")).toBe(true);
  expect(decodeURIComponent(href.slice("https://wa.me/?text=".length))).toContain(address.url);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    live.getByRole("link", { name: "Download QR code" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`${SLUG}-qr.png`);
  const png = readFileSync(await download.path());
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // The public page, on the app host and on the hotel's own host.
  for (const url of [`/h/${SLUG}`, `${hotelOrigin(baseURL, SLUG)}/`]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(200);
    await expect(page.getByText(EDITED).first()).toBeVisible();
    for (const room of ROOMS) {
      await expect(page.getByRole("heading", { name: room.name }).first()).toBeVisible();
      await expect(page.getByText(room.shown).first()).toBeVisible();
    }
    await expect(page.getByText("Built with Seedha")).toBeVisible();
    await expect(page.getByRole("button", { name: /Book direct · Powered by Seedha/ })).toBeVisible();
    const photos = page.locator(`img[src*="/api/public/site/${SLUG}/photos/"]`);
    expect(await photos.count(), url).toBeGreaterThanOrEqual(4);
    for (const img of await photos.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
        .toBe(true);
    }
    const first = (await photos.first().getAttribute("src")) ?? "";
    const bytes = await page.request.get(new URL(first, page.url()).toString());
    expect(bytes.headers()["content-type"]).toBe("image/jpeg");
  }

  // Owner pages are 404 on the hotel's host; unknown slugs are a real 404 on both forms.
  for (const path of ["/login", "/site", "/settings", "/api/site/build"]) {
    const res = await page.goto(`${hotelOrigin(baseURL, SLUG)}${path}`);
    expect(res?.status(), path).toBe(404);
  }
  for (const url of ["/h/no-hotel-here-t2", `${hotelOrigin(baseURL, "no-hotel-here-t2")}/`]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(404);
    await expect(page.getByText(NOT_LIVE).first()).toBeVisible();
  }

  await page.goto(`/h/${SLUG}`);
  await expect(page.getByText(EDITED).first()).toBeVisible();
  await axeSweep(page, context, baseURL, "public page");

  // The Pro setting hides the branding; showing it again brings it back.
  await page.goto("/site");
  const brand = page.getByRole("checkbox", { name: /Hide .Built with Seedha/ });
  // The box follows the saved value, so it flips once the API answers.
  await brand.click();
  await expect(page.getByText("Seedha branding hidden")).toBeVisible();
  await expect(brand).toBeChecked();
  await page.goto(`/h/${SLUG}`);
  await expect(page.getByText(EDITED).first()).toBeVisible();
  await expect(page.getByText("Built with Seedha")).toHaveCount(0);
  await expect(page.getByText("Powered by Seedha")).toHaveCount(0);
  await page.goto("/site");
  await expect(brand).toBeChecked();
  await brand.click();
  await expect(page.getByText("Seedha branding shown")).toBeVisible();
  await expect(brand).not.toBeChecked();
  await page.goto(`/h/${SLUG}`);
  await expect(page.getByText("Built with Seedha")).toBeVisible();

  await resetSampleHotel(page);
});

test("Settings shows the site AI usage card", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Plan and billing" }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { name: "AI usage" })).toBeVisible();
  await expect(panel.getByText("Site text generation (Claude)")).toBeVisible();
  await expect(panel.getByText("Tokens this month")).toBeVisible();
  await expect(panel.getByText("Monthly cap")).toBeVisible();
  // e2e has no Claude key: Sample runs make no call, so no tokens and no runs today.
  await expect(panel.getByText("0 in · 0 out")).toBeVisible();
  await expect(panel.getByText("0 of 3", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("No runs yet. Without an AI key the site uses Sample text and no tokens."),
  ).toBeVisible();
  const usage = (await (await page.request.get("/api/site/gen/usage")).json()) as Record<string, unknown>;
  expect(usage).toMatchObject({ month_runs: 0, generations_today: 0, daily_limit: 3 });
});
