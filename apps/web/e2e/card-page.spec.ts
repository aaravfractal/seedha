import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { axeViolations, scrollsSideways, signInOnce } from "./helpers";

/**
 * The card link page (docs/CARD_PAGE.md, PART 2): /h/<slug>?src=card-* shows
 * the card welcome panel before the mini-site: thanks, one feedback form (name,
 * booking reference optional, phone last 4 only when asked, overall and food
 * stars, review, reward, WhatsApp consent unticked), and Book again into
 * Seedha Link with the stay prefilled. The owner reads private notes on the
 * Website screen's Ratings tab.
 *
 * MOCKED (NEEDS F1): the card verify and feedback POSTs and the owner's
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
const API = `/api/public/site/${SLUG}`;

/**
 * Mock the card verify and feedback routes; `verify` answers in turn, then
 * repeats its last answer. `feedback` is the JSON answer (status 200).
 */
async function mockCard(page: Page, opts: { verify?: unknown[]; feedback?: unknown } = {}): Promise<Sent[]> {
  const sent: Sent[] = [];
  const answers = [...(opts.verify ?? [{ state: "not_found" }])];
  const reply = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(`**${CARD}/verify`, async (route: Route) => {
    sent.push({ path: "verify", body: route.request().postDataJSON() as unknown });
    return reply(route, answers.length > 1 ? answers.shift() : answers[0]);
  });
  await page.route(`**${API}/feedback`, async (route: Route) => {
    sent.push({ path: "feedback", body: route.request().postDataJSON() as unknown });
    return reply(route, opts.feedback ?? { verified: false, reward: "none", state: "saved" });
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
  await expect(panel.getByText("The booking ID on your booking confirmation")).toBeVisible();
  await expect(panel.getByLabel("Last 4 digits of your phone")).toHaveCount(0);
  const book = panel.locator("[data-book-again]");
  if (text.includes("Book direct next time:")) await expect(book).toContainText("Sample");
  expect(await book.getByRole("link", { name: "Open booking" }).getAttribute("href")).toMatch(
    /^\/link\?room=[^&]+$/,
  );

  expect(await layoutShift(page)).toBeLessThan(0.01);
  expect(await scrollsSideways(page)).toBe(false);
  expect(await axeViolations(page)).toEqual([]);
  // Radios and the checkbox: the whole label is the target.
  for (const target of await panel
    .locator(
      "button, a, input:not([type=radio],[type=checkbox]), label:has(input[type=radio],input[type=checkbox])",
    )
    .all()) {
    const box = await target.boundingBox();
    if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
});

test("feedback: checks each field, phone asked only when needed, consent unticked, sent once (mocked, NEEDS F1)", async ({
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
    feedback: { verified: true, reward: "breakfast", state: "saved" },
  });
  await page.goto(`${PAGE}?src=card-room`);
  const panel = page.locator("[data-card-welcome]");
  const send = panel.getByRole("button", { name: "Send feedback" });
  const consent = panel.getByRole("checkbox", {
    name: "Send my reward code on WhatsApp. Reply STOP any time.",
  });
  await expect(consent).not.toBeChecked();
  expect(await panel.getByRole("link", { name: "How we use your number" }).getAttribute("href")).toBe(
    "/privacy",
  );

  // Name and overall stars are needed; the first bad field is marked and focused.
  await send.click();
  await expect(panel.getByRole("alert")).toHaveText("Type your name, up to 60 characters.");
  await expect(panel.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
  await expect(panel.getByLabel("Your name")).toBeFocused();
  await panel.getByLabel("Your name").fill("Asha Rawat");
  await send.click();
  await expect(panel.getByRole("alert")).toHaveText("Choose from 1 to 5 stars for your overall stay.");
  const overall = panel.getByRole("radiogroup", { name: "Overall stay" });
  await expect(overall.getByRole("radio")).toHaveCount(5);
  await expect(
    panel.getByRole("radiogroup", { name: "Food quality (optional)" }).getByRole("radio"),
  ).toHaveCount(5);
  await overall.getByRole("radio", { name: "5 stars" }).check();
  await panel
    .getByRole("radiogroup", { name: "Food quality (optional)" })
    .getByRole("radio", { name: "4 stars" })
    .check();

  // WhatsApp is needed only once consent is ticked.
  await consent.check();
  await send.click();
  await expect(panel.getByLabel("WhatsApp number")).toHaveAttribute("aria-invalid", "true");
  await panel.getByLabel("WhatsApp number").fill("+91 98765 43210");

  // A bad reference stays here; the phone's last 4 only once the API asks.
  const ref = panel.getByLabel("Booking reference");
  await ref.fill("DV 0142");
  await send.click();
  await expect(panel.getByRole("alert")).toContainText("letters, digits and dashes only");
  await expect(panel.getByLabel("Last 4 digits of your phone")).toHaveCount(0);
  await ref.fill("CL2101");
  await send.click();
  const last4 = panel.getByLabel("Last 4 digits of your phone");
  await expect(last4).toBeVisible();
  await expect(panel.getByRole("alert")).toHaveText(
    "Add the last 4 digits of your phone to check this booking.",
  );
  await last4.fill("12");
  await send.click();
  await expect(panel.getByRole("alert")).toHaveText("Type exactly 4 digits.");
  await last4.fill("4821");
  await panel.getByLabel("Your review (optional)").fill("  Warm rooms and a kind team.  ");
  await send.click();

  const done = panel.getByRole("status");
  await expect(done).toContainText("Your feedback reached the hotel.");
  await expect(done).toContainText("Your booking is verified, so your rating counts on this page.");
  await expect(done).toContainText("they send your code on WhatsApp");
  // The verified stay fills Book again (room, next check-in, nights, the guest's own code).
  expect(sent.filter((x) => x.path === "verify").map((x) => x.body)).toEqual([
    { booking_ref: "CL2101" },
    { booking_ref: "CL2101", phone_last4: "4821" },
  ]);
  expect(await panel.getByRole("link", { name: "Open booking" }).getAttribute("href")).toBe(
    "/link/DV-BRK-01?room=Deluxe+Valley+View&in=2027-03-12&nights=2",
  );
  expect((await done.textContent()) ?? "").not.toMatch(/instant|—|!/i);
  await expect(send).toHaveCount(0);
  const posts = sent.filter((x) => x.path === "feedback");
  expect(posts).toHaveLength(1);
  expect(posts[0]?.body).toMatchObject({
    name: "Asha Rawat",
    whatsapp: "+91 98765 43210",
    booking_ref: "CL2101",
    phone_last4: "4821",
    overall: 5,
    food: 4,
    review: "Warm rooms and a kind team.",
    consent: true,
  });
  expect(await axeViolations(page)).toEqual([]);
});

test("feedback: no consent sends no number; unverified stays private; errors (mocked, NEEDS F1)", async ({
  page,
}) => {
  const sent = await mockCard(page, { feedback: { verified: false, reward: "none", state: "saved" } });
  await page.goto(`${PAGE}?src=card-wallet`);
  const panel = page.locator("[data-card-welcome]");
  await panel.getByLabel("Your name").fill("Ravi");
  await panel.getByLabel("WhatsApp number").fill("98765 43210");
  await panel
    .getByRole("radiogroup", { name: "Overall stay" })
    .getByRole("radio", { name: "3 stars" })
    .check();

  // Rewards come from the site payload (NEEDS F1): without a reference, discounts are off.
  const rewards = panel.getByRole("radiogroup", { name: "Choose a thank-you for your next direct stay" });
  if (await rewards.count()) {
    await expect(rewards.getByRole("radio", { name: "No reward, thanks" })).toBeChecked();
    await expect(panel.getByText("Discounts are for verified stays.")).toBeVisible();
    for (const radio of await rewards.getByRole("radio").all()) {
      const value = await radio.getAttribute("value");
      if (value === "pct5" || value === "flat100") await expect(radio).toBeDisabled();
      else await expect(radio).toBeEnabled();
    }
  }

  await page.route(
    `**${API}/feedback`,
    (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: '{"error":{"code":"rate_limited"}}',
      }),
    { times: 1 },
  );
  await panel.getByRole("button", { name: "Send feedback" }).click();
  await expect(panel.getByRole("alert")).toHaveText("Too many tries. Wait a minute and try again.");
  await panel.getByRole("button", { name: "Send feedback" }).click();
  await expect(panel.getByRole("status")).toContainText("your rating stays private to the hotel");
  const body = sent.filter((x) => x.path === "feedback").at(-1)?.body as Record<string, unknown>;
  expect(body).toMatchObject({ name: "Ravi", overall: 3, reward: "none", consent: false });
  expect(body).not.toHaveProperty("whatsapp");
});

test("Book again opens Seedha Link with the room prefilled; Hindi; 1440 clean", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${PAGE}?src=card-desk&lang=hi`);
  const panel = page.locator("[data-card-welcome]");
  await expect(panel.getByRole("heading", { level: 2 })).toContainText("ठहरने के लिए धन्यवाद");
  await expect(panel.getByText("आपकी बुकिंग पुष्टि पर दी गई बुकिंग आईडी")).toBeVisible();
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
