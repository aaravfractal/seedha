import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { axeViolations, scrollsSideways, signInOnce } from "./helpers";

/**
 * The card link page (docs/CARD_PAGE.md, PART 2): /h/<slug>?src=card-* shows
 * the card welcome panel before the mini-site: thanks, Rate your stay (booking
 * reference, phone last 4 only when asked, 1 to 5 stars, one send), a private
 * note to the hotel, and Book again into Seedha Link with the stay prefilled.
 * The owner reads private notes on the Website screen's Ratings tab.
 *
 * MOCKED (NEEDS C1): the card verify, rate and feedback POSTs and the owner's
 * GET/PATCH /api/site/feedback are answered with page.route, so these tests
 * check the page against the contract alone. The last test asks the real API
 * and skips itself when the card routes are not there yet.
 */

const SLUG = "deodar-view";
const PAGE = `/h/${SLUG}`;
const CARD = `/api/public/site/${SLUG}/card`;
const THANKS = /Thanks for staying at .*Deodar View/;

let ownerState = "";
test.beforeAll(async ({ browser }) => {
  ownerState = await signInOnce(browser);
});

type Sent = { path: string; body: unknown };

/** Mock the three card routes; `verify` answers in turn, then repeats its last answer. */
async function mockCard(
  page: Page,
  opts: { verify?: unknown[]; rate?: number; feedback?: number } = {},
): Promise<Sent[]> {
  const sent: Sent[] = [];
  const answers = [...(opts.verify ?? [{ state: "not_found" }])];
  await page.route(`**${CARD}/*`, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.slice(CARD.length + 1);
    sent.push({ path, body: req.postDataJSON() as unknown });
    if (path === "verify") {
      const answer = answers.length > 1 ? answers.shift() : answers[0];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(answer) });
    }
    const status = path === "rate" ? (opts.rate ?? 204) : (opts.feedback ?? 204);
    if (status === 204) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: status === 409 ? "already_rated" : "invalid", message: "No" } }),
    });
  });
  return sent;
}

/** Layout shift so far (no input yet, so every shift counts). */
async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((done) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!e.hadRecentInput) total += e.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => done(total), 300);
      }),
  );
}

test("no card source: no panel, nothing reserved", async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-card-welcome]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-hs-card"))).toBe(false);
});

test("card visit at 390: panel first, in the server HTML, no layout shift, axe clean", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const html = await (await page.request.get(`${PAGE}?src=card-wallet`)).text();
  expect(html).toContain("data-card-welcome");
  expect(html).toContain("data-hs-card");

  await page.goto(`${PAGE}?src=card-wallet`);
  const panel = page.locator("[data-card-welcome]");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("data-card", "wallet");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText(THANKS);
  // Before the hero: the first thing in main.
  const panelBox = await panel.boundingBox();
  const h1Box = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(panelBox && h1Box && panelBox.y < h1Box.y).toBe(true);
  // One card message: no ribbon left in the hero.
  await expect(page.locator("[data-card]")).toHaveCount(1);

  const text = (await panel.textContent()) ?? "";
  expect(text).not.toMatch(/Sample perk:|₹|—|!/);
  await expect(panel.getByText("From your checkout slip")).toBeVisible();
  await expect(panel.getByLabel("Last 4 digits of your phone")).toHaveCount(0);
  const book = panel.locator("[data-book-again]");
  if (text.includes("Book direct next time:")) await expect(book).toContainText("Sample");
  expect(await book.getByRole("link", { name: "Open booking" }).getAttribute("href")).toMatch(
    /^\/link\?room=[^&]+$/,
  );

  expect(await layoutShift(page)).toBeLessThan(0.01);
  expect(await scrollsSideways(page)).toBe(false);
  expect(await axeViolations(page)).toEqual([]);
  for (const target of await panel.locator("button, a, input, summary").all()) {
    const box = await target.boundingBox();
    if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
});

test("rate: bad reference stays here, phone asked only when needed, stars sent once (mocked, NEEDS C1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sent = await mockCard(page, {
    verify: [
      { state: "needs_phone" },
      {
        state: "verified",
        stay_token: "stay-1",
        room_type: "Deluxe Valley View",
        nights: 2,
        next_check_in: "2027-03-12",
        perk_code: "DV-BRK-01",
      },
    ],
  });
  await page.goto(`${PAGE}?src=card-room`);
  const panel = page.locator("[data-card-welcome]");
  const ref = panel.getByLabel("Booking reference");
  await ref.fill("DV 1001");
  await panel.getByRole("button", { name: "Check my stay" }).click();
  await expect(panel.getByRole("alert")).toContainText("letters, digits and dashes only");
  expect(sent).toHaveLength(0);

  await ref.fill("DV-1001");
  await panel.getByRole("button", { name: "Check my stay" }).click();
  const last4 = panel.getByLabel("Last 4 digits of your phone");
  await expect(last4).toBeVisible();
  await last4.fill("48");
  await panel.getByRole("button", { name: "Check my stay" }).click();
  await expect(panel.getByRole("alert")).toHaveText("Type exactly 4 digits.");
  await last4.fill("4821");
  await panel.getByRole("button", { name: "Check my stay" }).click();

  const group = panel.getByRole("group", { name: "How was your stay?" });
  await expect(group.getByRole("radio")).toHaveCount(5);
  expect(sent.map((s) => s.body)).toEqual([
    { booking_ref: "DV-1001" },
    { booking_ref: "DV-1001", phone_last4: "4821" },
  ]);
  // Verified: Book again carries the stay and the guest's own code.
  const book = panel.locator("[data-book-again]");
  await expect(book).toContainText("Your perk code DV-BRK-01 is filled in.");
  expect(await book.getByRole("link", { name: "Open booking" }).getAttribute("href")).toBe(
    "/link/DV-BRK-01?room=Deluxe+Valley+View&in=2027-03-12&nights=2",
  );

  await panel.getByRole("button", { name: "Send rating" }).click();
  await expect(panel.getByRole("alert")).toHaveText("Choose from 1 to 5 stars.");
  await group.getByRole("radio", { name: "5 stars" }).check();
  const comment = panel.getByLabel("A short comment (optional)");
  await comment.fill("Warm <rooms>");
  await expect(panel.getByText("Please leave out the < and > signs.")).toBeVisible();
  await comment.fill("Warm rooms and a kind host");
  expect(await axeViolations(page)).toEqual([]);
  await panel.getByRole("button", { name: "Send rating" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Your rating is saved" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Send rating" })).toHaveCount(0);
  expect(sent.filter((s) => s.path === "rate").map((s) => s.body)).toEqual([
    { stay_token: "stay-1", stars: 5, comment: "Warm rooms and a kind host" },
  ]);
});

test("rate: not found, not ended, already rated, and a 409 on send (mocked, NEEDS C1)", async ({ page }) => {
  await mockCard(page, {
    verify: [
      { state: "not_found" },
      { state: "not_ended" },
      { state: "verified", stay_token: "stay-2" },
      { state: "already_rated" },
    ],
    rate: 409,
  });
  await page.goto(`${PAGE}?src=card-desk`);
  const panel = page.locator("[data-card-welcome]");
  const check = panel.getByRole("button", { name: "Check my stay" });
  await panel.getByLabel("Booking reference").fill("NOPE-1");
  await check.click();
  await expect(panel.getByText("We could not find that booking.")).toBeVisible();
  await check.click();
  await expect(panel.getByText("You can rate after your stay.")).toBeVisible();
  await check.click();
  await panel.getByRole("radio", { name: "3 stars" }).check();
  await panel.getByRole("button", { name: "Send rating" }).click();
  await expect(panel.getByText("This stay has already been rated. Thank you.")).toBeVisible();
  // Without a perk code Book again goes to /link with the first room only.
  expect(await panel.getByRole("link", { name: "Open booking" }).getAttribute("href")).toMatch(
    /^\/link\?room=[^&]+$/,
  );
});

test("private note: 1 to 500 characters, sent privately once (mocked, NEEDS C1)", async ({ page }) => {
  const sent = await mockCard(page);
  await page.goto(`${PAGE}?src=card-wallet`);
  const panel = page.locator("[data-card-welcome]");
  await panel.getByText("Send a private note to the hotel").click();
  await expect(
    panel.getByText("It is not shown on this page and does not count in the rating."),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Send privately" }).click();
  await expect(panel.getByRole("alert")).toHaveText("Write a note first.");
  await panel.getByLabel("Your note").fill("  The hot water ran out on Sunday morning.  ");
  await panel.getByRole("button", { name: "Send privately" }).click();
  await expect(panel.getByText("Sent privately to the hotel. Thank you.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Send privately" })).toHaveCount(0);
  expect(sent).toEqual([{ path: "feedback", body: { message: "The hot water ran out on Sunday morning." } }]);
});

test("Book again opens Seedha Link with the room prefilled; Hindi; 1440 clean", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${PAGE}?src=card-desk&lang=hi`);
  const panel = page.locator("[data-card-welcome]");
  await expect(panel.getByRole("heading", { level: 2 })).toContainText("ठहरने के लिए धन्यवाद");
  await expect(panel.getByText("आपकी चेक-आउट पर्ची से")).toBeVisible();
  expect(await scrollsSideways(page)).toBe(false);
  expect(await axeViolations(page)).toEqual([]);
  const href = (await panel.getByRole("link", { name: "बुकिंग खोलें" }).getAttribute("href")) ?? "";
  const room = new URL(href, "http://x").searchParams.get("room") ?? "";
  expect(room).not.toBe("");
  await page.goto(href);
  await expect(page).toHaveURL(/\/link\?room=/);
  const roomSelect = page.locator("select").filter({ has: page.locator(`option[value="${room}"]`) });
  await expect(roomSelect.first()).toHaveValue(room);
});

test("owner: private notes on the Ratings tab, newest first, mark as read (mocked, NEEDS C1)", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ storageState: ownerState, baseURL });
  const page = await context.newPage();
  const patched: unknown[] = [];
  let notes = [
    { id: 1, message: "Older note about parking.", created_at: "2026-10-01T09:00:00Z", read: true },
    { id: 2, message: "Newer note: the geyser was slow.", created_at: "2026-10-12T09:00:00Z", read: false },
  ];
  await page.route("**/api/site/feedback**", async (route) => {
    const req = route.request();
    if (req.method() === "PATCH") {
      patched.push({ url: new URL(req.url()).pathname, body: req.postDataJSON() as unknown });
      const id = Number(new URL(req.url()).pathname.split("/").pop());
      notes = notes.map((n) => (n.id === id ? { ...n, read: true } : n));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(notes.find((n) => n.id === id)),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(notes) });
  });
  await page.goto("/site");
  await page.getByRole("button", { name: "Ratings", exact: true }).click();
  const list = page.locator("[data-feedback-list]");
  await expect(list.getByRole("heading", { name: "Private notes" })).toBeVisible();
  const items = list.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("Newer note");
  await expect(items.first()).toContainText("Unread");
  await expect(list.getByText("2 notes, 1 unread")).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await items
    .first()
    .getByRole("button", { name: /^Mark as read/ })
    .click();
  await expect(list.getByText("2 notes, all read")).toBeVisible();
  await expect(list.getByRole("button", { name: /^Mark as read/ })).toHaveCount(0);
  expect(patched).toEqual([{ url: "/api/site/feedback/2", body: { read: true } }]);

  // Honest empty state.
  notes = [];
  await page.reload();
  await page.getByRole("button", { name: "Ratings", exact: true }).click();
  await expect(page.getByText("No private notes yet")).toBeVisible();
  await context.close();
});

test("real API: an unknown booking reference is not found (skips until C1's routes exist)", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "http://localhost:3000").origin;
  const res = await page.request.post(`${CARD}/verify`, {
    data: { booking_ref: "NOPE-0000" },
    headers: { origin },
  });
  test.skip(res.status() === 404 || res.status() === 405, "NEEDS C1: card routes not in this API yet");
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { state: string }).state).toBe("not_found");
});
