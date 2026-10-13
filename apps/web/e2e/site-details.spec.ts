import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { axeViolations, resetSampleHotel, scrollsSideways, signIn } from "./helpers";

/**
 * Hotel Site V2, owner side (docs/HOTEL_SITE_V2.md): the "Hotel details"
 * editors on the Website screen (rooms, amenities, nearby places, how to
 * reach, house rules, contact, map position), one Save that PUTs the whole
 * object, plain-word errors (client checks and the API's own 422), "Print
 * cards" previews with the PDF downloads, "Card QR" (preview, the exact URL,
 * SVG and PNG), "Card scans this month" and ratings moderation.
 * Sample hotel only; it is reset before and after.
 *
 * The PDF and QR files come from GET /site/cards.pdf and /site/cards/qr.*
 * (helper V2-API). Without those routes in the API under test, the download
 * test fails on the 404: it asserts the contract, not a stand-in. The rooms
 * and ratings tests need the API's `rooms` in /site/details and GET
 * /site/ratings (minisite A1).
 */

test.describe.configure({ mode: "serial" });

// One sign-in for the whole file (the Direct beta login is rate limited): every
// test uses this one signed-in page.
let context: BrowserContext;
let page: Page;

type TabName = "Hotel details" | "Print cards" | "Ratings";

async function openTab(page: Page, name: TabName) {
  await page.goto("/site");
  await page.getByRole("group", { name: "Website sections" }).getByRole("button", { name }).click();
}

function place(page: Page, n: number) {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: `Place ${n}`, exact: true }) });
}

test.beforeAll(async ({ browser, baseURL }) => {
  context = await browser.newContext({ baseURL });
  page = await context.newPage();
  await signIn(page);
  await resetSampleHotel(page);
});

test.afterAll(async () => {
  await resetSampleHotel(page);
  await context.close();
});

test("owner edits amenities and a nearby place, saves, reloads and sees them", async () => {
  await openTab(page, "Hotel details");
  await expect(page.getByRole("heading", { name: "Hotel details", level: 2 })).toBeVisible();
  await expect(page.getByText("Sample facts", { exact: true })).toBeVisible();
  await expect(page.getByText("20 of 40 chosen")).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();

  // Amenities: search narrows the list; tick one more.
  await page.getByLabel("Search amenities").fill("yoga");
  const yoga = page.getByRole("checkbox", { name: /Yoga space/ });
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await yoga.check();
  await page.getByLabel("Search amenities").fill("");
  await expect(page.getByText("21 of 40 chosen")).toBeVisible();
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();

  // A fifth nearby place, placed west of the hotel with the compass.
  await page.getByRole("button", { name: "Add a place" }).click();
  const fifth = place(page, 5);
  await fifth.getByLabel("Name in English").fill("Bhatta Falls");
  await fifth.getByLabel("Name in Hindi (optional)").fill("भट्टा फ़ॉल्स");
  await fifth.getByLabel("Minutes").fill("25");
  await fifth.getByLabel("Kind").selectOption("waterfall");
  await fifth.getByRole("button", { name: "West of the hotel, for Bhatta Falls", exact: true }).click();
  await expect(fifth.getByLabel("Degrees from north")).toHaveValue("270");
  await expect(
    fifth.getByRole("button", { name: "West of the hotel, for Bhatta Falls", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Save hotel details" }).click();
  await expect(
    page.getByText("Saved. The hosted public sample page keeps its fixed sample facts."),
  ).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();
  // Exact: the toast above keeps its text ("...fixed sample facts.") in its live region.
  await expect(page.getByText("Sample facts", { exact: true })).toHaveCount(0);

  const saved = (await (await page.request.get("/api/site/details")).json()) as {
    amenities: string[];
    nearby: {
      name_en: string;
      name_hi: string;
      minutes: number;
      kind: string;
      bearing: number;
      mode: string;
    }[];
    sample: boolean;
  };
  expect(saved.sample).toBe(false);
  expect(saved.amenities).toContain("yoga");
  expect(saved.amenities).toHaveLength(21);
  expect(saved.nearby[4]).toEqual({
    name_en: "Bhatta Falls",
    name_hi: "भट्टा फ़ॉल्स",
    minutes: 25,
    mode: "drive",
    kind: "waterfall",
    bearing: 270,
  });

  await page.reload();
  await page
    .getByRole("group", { name: "Website sections" })
    .getByRole("button", { name: "Hotel details" })
    .click();
  await expect(page.getByRole("checkbox", { name: /Yoga space/ })).toBeChecked();
  await expect(place(page, 5).getByLabel("Name in English")).toHaveValue("Bhatta Falls");
  await expect(place(page, 5).getByLabel("Degrees from north")).toHaveValue("270");
});

test("invalid input shows the error in plain words, and the API's 422 does too", async () => {
  await openTab(page, "Hotel details");
  const first = place(page, 1);
  await first.getByLabel("Name in English").fill("<b>Mall Road</b>");
  await first.getByLabel("Minutes").fill("0");
  let puts = 0;
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes("/api/site/details")) puts += 1;
  });
  await page.getByRole("button", { name: "Save hotel details" }).click();
  const summary = page.getByRole("alert").filter({ hasText: "to save" });
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Nearby place 1, name in English: Use plain text without < or >.");
  await expect(summary).toContainText("Nearby place 1, minutes: Use 1 to 600 minutes.");
  await expect(first.getByLabel("Name in English")).toHaveAttribute("aria-invalid", "true");
  expect(puts).toBe(0);
  await page.getByRole("button", { name: "Undo changes" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();

  // The real API refuses markup with a 422 and field details (through the proxy's PUT).
  const refused = await page.request.put("/api/site/details", {
    data: { contact: { email: "not an email" }, good_to_know: [{ text_en: "<i>x</i>" }] },
  });
  expect(refused.status()).toBe(422);
  const body = (await refused.json()) as { error: { code: string; details: { field: string }[] } };
  expect(body.error.code).toBe("invalid_input");
  expect(body.error.details.map((d) => d.field).sort()).toEqual(["contact.email", "good_to_know.0.text_en"]);

  // A 422 the client checks cannot catch shows next to the box in plain words.
  await page.route("**/api/site/details", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    return route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "invalid_input",
          message: "Some fields are not valid",
          details: [{ field: "contact.email", problem: "String should match pattern '^$|x'" }],
        },
      }),
    });
  });
  await page.getByLabel("Email").fill("stay@deodar.example");
  await page.getByRole("button", { name: "Save hotel details" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "to save" })).toContainText(
    "Email: Use an email like name@example.com.",
  );
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await page.unroute("**/api/site/details");
});

test("Print cards shows previews, PDF and QR downloads, and the scans empty state", async () => {
  await openTab(page, "Print cards");
  await expect(page.getByRole("heading", { name: "Print cards", level: 2 })).toBeVisible();

  // Card scans this month: nothing scanned on a fresh sample hotel.
  await expect(page.getByRole("heading", { name: "Card scans this month" })).toBeVisible();
  await expect(page.getByText("No scans yet this month.")).toBeVisible();

  for (const title of ["Wallet card", "In-room card", "Desk tent card"]) {
    await expect(page.getByRole("heading", { name: title, exact: true, level: 3 })).toBeVisible();
  }
  // Faces as the PDF prints them: the room QR on the front, the tent's two faces on one sheet.
  for (const [name, src] of [
    ["Wallet card, back", "card-wallet"],
    ["In-room card, front", "card-room"],
    ["Desk tent card, printed sheet", "card-desk"],
  ] as const) {
    await expect(
      page.getByRole("img", { name: new RegExp(`^${name}: .*QR code to .*\\?src=${src}`) }),
    ).toBeVisible();
  }
  await expect(page.getByRole("img", { name: /^In-room card, back: .*Check-in from 12:00/ })).toBeVisible();
  // No prices on cards.
  await expect(page.locator("figure").filter({ hasText: "₹" })).toHaveCount(0);

  // At true aspect ratio: CR80 85.6 x 54 mm.
  const wallet = page.locator('svg[data-card-face="front"]').first();
  const box = await wallet.boundingBox();
  expect(box).not.toBeNull();
  if (box) expect(Math.abs(box.width / box.height - 85.6 / 54)).toBeLessThan(0.02);

  // Downloads: the PDF per kind and "all", the QR as SVG and PNG per card.
  const allPdf = page.getByRole("link", { name: "Download all cards (PDF)" });
  await expect(allPdf).toHaveAttribute("href", "/api/site/cards.pdf?kind=all");
  for (const kind of ["all", "wallet", "room", "tent"]) {
    const res = await page.request.get(`/api/site/cards.pdf?kind=${kind}`);
    expect(res.status(), `cards.pdf?kind=${kind}`).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect(res.headers()["content-disposition"] ?? "").toContain("attachment");
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
  for (const card of ["wallet", "room", "desk"]) {
    const svg = await page.request.get(`/api/site/cards/qr.svg?card=${card}`);
    expect(svg.status(), `qr.svg?card=${card}`).toBe(200);
    expect(svg.headers()["content-type"]).toContain("image/svg+xml");
    const png = await page.request.get(`/api/site/cards/qr.png?card=${card}`);
    expect(png.status(), `qr.png?card=${card}`).toBe(200);
    expect(png.headers()["content-type"]).toContain("image/png");
  }
  const download = page.waitForEvent("download");
  await allPdf.click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

  // Card QR: per card the QR, the exact URL it opens (/h/<slug>?src=card-*) and SVG and PNG downloads.
  const qr = page.getByRole("region", { name: "Card QR" });
  await expect(qr).toBeVisible();
  for (const [title, card] of [
    ["Wallet card", "wallet"],
    ["In-room card", "room"],
    ["Desk tent card", "desk"],
  ] as const) {
    await expect(
      qr.getByRole("img", { name: new RegExp(`^QR code of the ${title.toLowerCase()} to `) }),
    ).toBeVisible();
    await expect(qr.getByText(new RegExp(`/h/[a-z0-9-]+\\?src=card-${card}$`))).toBeVisible();
    await expect(
      qr.getByRole("link", { name: `Download QR of the ${title.toLowerCase()} as SVG` }),
    ).toHaveAttribute("href", `/api/site/cards/qr.svg?card=${card}`);
    await expect(
      qr.getByRole("link", { name: `Download QR of the ${title.toLowerCase()} as PNG` }),
    ).toHaveAttribute("href", `/api/site/cards/qr.png?card=${card}`);
  }
  const png = page.waitForEvent("download");
  await qr.getByRole("link", { name: "Download QR of the wallet card as PNG" }).click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);
});

test("owner sets a room's size, beds, guests, features and photo, saves and sees them after reload", async () => {
  await openTab(page, "Hotel details");
  const rooms = page.getByRole("region", { name: "Rooms" });
  await expect(rooms).toBeVisible();
  await expect(page.getByRole("heading", { name: "House rules", level: 3 })).toBeVisible();
  const first = rooms.getByRole("listitem").first();
  const name = (await first.getByRole("heading", { level: 4 }).textContent()) ?? "";
  await first.getByLabel("Size in sq ft (optional)").fill("40");
  await page.getByRole("button", { name: "Save hotel details" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "to save" })).toContainText("Use 50 to 5000 sq ft.");
  await first.getByLabel("Size in sq ft (optional)").fill("320");
  await first.getByLabel("Most guests (optional)").fill("3");
  await first.getByLabel("Beds in English").fill("1 queen bed");
  // The sample rooms come with facts (A1): feature 2 keeps its saved value.
  const feature2 = await first.getByLabel("Feature 2 in English").inputValue();
  await first.getByLabel("Feature 1 in English").fill("Mountain view");
  await page.getByRole("button", { name: "Save hotel details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();
  const saved = (await (await page.request.get("/api/site/details")).json()) as {
    rooms: {
      name: string;
      size_sqft: number | null;
      max_guests: number | null;
      beds_en: string;
      features_en: string[];
    }[];
  };
  const room = saved.rooms.find((r) => r.name === name);
  expect(room).toMatchObject({
    size_sqft: 320,
    max_guests: 3,
    beds_en: "1 queen bed",
    features_en: ["Mountain view", feature2].filter(Boolean),
  });
  await openTab(page, "Hotel details");
  await expect(
    page
      .getByRole("region", { name: "Rooms" })
      .getByRole("listitem")
      .first()
      .getByLabel("Size in sq ft (optional)"),
  ).toHaveValue("320");
});

test("Ratings explains the rules and shows the honest empty state", async () => {
  await openTab(page, "Ratings");
  await expect(page.getByRole("heading", { name: "Ratings", level: 2 })).toBeVisible();
  await expect(page.getByText("Stars cannot be edited.", { exact: false })).toBeVisible();
  await expect(page.getByText(/only from 3 ratings/)).toBeVisible();
  // The sample hotel has zero ratings after a reset.
  await expect(page.getByText(/^No ratings yet\./)).toBeVisible();
});

test("Hotel details, Print cards and Ratings fit 390 and 1440 with no sideways scroll and pass axe, light and dark", async ({
  baseURL,
}) => {
  const found: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await context.addCookies([{ name: "seedha_theme", value: theme, url: baseURL ?? "" }]);
    for (const tab of ["Hotel details", "Print cards", "Ratings"] as const) {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await openTab(page, tab);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await expect(page.getByRole("heading", { name: tab, level: 2 })).toBeVisible();
        expect(await scrollsSideways(page), `${tab} at ${width}px scrolls sideways`).toBe(false);
        for (const v of await axeViolations(page)) found.push(`${tab} ${theme} ${width}px: ${v}`);
      }
    }
  }
  await context.addCookies([{ name: "seedha_theme", value: "light", url: baseURL ?? "" }]);
  expect(found).toEqual([]);
});
