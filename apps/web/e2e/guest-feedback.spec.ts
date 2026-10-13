import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { axeViolations, scrollsSideways, signInOnce } from "./helpers";

/**
 * Card page feedback, owner side (docs/CARD_PAGE.md speed addendum, F3):
 * Settings "Guest rewards" toggles and the Website "Guest feedback" list
 * with owner-approved "Send reward code".
 *
 * MOCKED: /api/settings/rewards and /api/site/guest-feedback* are answered
 * by page.route with the agreed contract, because the API side (F1) is built
 * in parallel. Sign-in and every other call use the real API.
 */

type Feedback = {
  id: number;
  created_at: string;
  verified: boolean;
  name: string;
  overall: number;
  food: number | null;
  review: string;
  reward: string;
  consent: boolean;
  has_phone: boolean;
  status: "new" | "reward_sent" | "hidden";
  read: boolean;
  booking_ref: string | null;
};

function sampleFeedback(): Feedback[] {
  return [
    {
      id: 1,
      created_at: "2026-10-01T08:00:00Z",
      verified: false,
      name: "Sample guest Ravi",
      overall: 4,
      food: null,
      review: "Quiet rooms, sample data.",
      reward: "breakfast",
      consent: false,
      has_phone: false,
      status: "new",
      read: true,
      booking_ref: null,
    },
    {
      id: 2,
      created_at: "2026-10-10T09:30:00Z",
      verified: true,
      name: "Sample guest Meera",
      overall: 5,
      food: 4,
      review: "Lovely view of the deodars, sample data.",
      reward: "pct5",
      consent: true,
      has_phone: true,
      status: "new",
      read: false,
      booking_ref: "CL2101",
    },
  ];
}

async function mockApi(page: Page) {
  let rewards = { breakfast: true, pct5: false, flat100: false };
  const feedback = sampleFeedback();
  const puts: unknown[] = [];
  const json = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/api/settings/rewards", async (route) => {
    if (route.request().method() === "PUT") {
      rewards = route.request().postDataJSON() as typeof rewards;
      puts.push(rewards);
    }
    await json(route, rewards);
  });
  await page.route("**/api/site/guest-feedback**", async (route) => {
    const req = route.request();
    const m = /guest-feedback\/(\d+)(\/send-reward)?$/.exec(new URL(req.url()).pathname);
    if (!m) return json(route, feedback);
    const item = feedback.find((f) => f.id === Number(m[1]));
    if (!item) return route.fulfill({ status: 404, body: "{}" });
    if (m[2]) {
      item.status = "reward_sent";
      return json(route, { code: "SAMPLE5-7Q2K", sent: "simulated" });
    }
    const body = req.postDataJSON() as { read?: boolean; hidden?: boolean };
    if (body.read !== undefined) item.read = body.read;
    if (body.hidden !== undefined) item.status = body.hidden ? "hidden" : "new";
    return json(route, item);
  });
  return { puts };
}

async function openFeedback(page: Page) {
  await page.goto("/site");
  await page
    .getByRole("group", { name: "Website sections" })
    .getByRole("button", { name: "Ratings" })
    .click();
  await expect(page.getByRole("heading", { name: "Guest feedback", level: 2 })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

let state: string;
test.beforeAll(async ({ browser }) => {
  state = await signInOnce(browser);
});

test("[mocked API] Settings: guest reward toggles save with PUT", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, storageState: state });
  const page = await context.newPage();
  const { puts } = await mockApi(page);
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Hotel" }).click();
  await expect(page.getByRole("heading", { name: "Guest rewards" })).toBeVisible();
  await expect(page.getByText("Check your OTA contracts before offering direct discounts.")).toBeVisible();

  const breakfast = page.getByRole("switch", { name: /Free breakfast/ });
  const pct5 = page.getByRole("switch", { name: /5% off your next direct stay/ });
  const flat = page.getByRole("switch", { name: /₹100 off your next direct stay/ });
  await expect(breakfast).toHaveAttribute("aria-checked", "true");
  await expect(pct5).toHaveAttribute("aria-checked", "false");
  await expect(flat).toHaveAttribute("aria-checked", "false");

  await pct5.click();
  await expect(pct5).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("5% off your next direct stay is now on.")).toBeVisible();
  expect(puts).toEqual([{ breakfast: true, pct5: true, flat100: false }]);
  await context.close();
});

test("[mocked API] Website: guest feedback list, approve and send a reward, read, hide", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL, storageState: state });
  const page = await context.newPage();
  await mockApi(page);
  await openFeedback(page);

  const list = page.getByRole("list", { name: "Guest feedback, newest first" });
  const items = list.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("Sample guest Meera");
  const meera = items.first();
  const ravi = items.nth(1);
  await expect(meera).toContainText("Verified");
  await expect(meera).toContainText("5% off next direct stay");
  await expect(meera.getByRole("img", { name: "5 of 5 stars" })).toBeVisible();
  await expect(meera.getByRole("img", { name: "4 of 5 stars" })).toBeVisible();
  await expect(ravi).toContainText("Not verified");
  await expect(ravi).toContainText("Food");
  await expect(ravi).toContainText("Not rated");

  // No consent and no phone: the send is off and says why.
  await expect(ravi.getByRole("button", { name: /Send reward code/ })).toBeDisabled();
  await expect(ravi).toContainText("The guest did not agree to WhatsApp messages.");

  // Owner approves, then the result is shown honestly as simulated.
  await meera.getByRole("button", { name: /Send reward code/ }).click();
  await meera.getByRole("button", { name: "Approve and send" }).click();
  await expect(meera.getByRole("status")).toContainText("Simulated send");
  await expect(meera.getByRole("status")).toContainText("SAMPLE5-7Q2K");
  await expect(meera.getByRole("button", { name: /Send reward code/ })).toBeDisabled();

  await meera.getByRole("button", { name: /Mark as read/ }).click();
  await expect(meera.getByRole("button", { name: /Mark as read/ })).toHaveCount(0);
  await ravi.getByRole("button", { name: /^Hide feedback/ }).click();
  await expect(ravi.getByText("Hidden", { exact: true })).toBeVisible();
  await expect(ravi.getByRole("button", { name: /^Show feedback/ })).toBeVisible();

  // Existing ratings moderation and private notes still render.
  await expect(page.getByRole("heading", { name: "Ratings", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Private notes", level: 2 })).toBeVisible();
  await context.close();
});

test("[mocked API] guest feedback and rewards are axe clean at 390 and 1440, light and dark", async ({
  browser,
  baseURL,
}) => {
  const found: string[] = [];
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ baseURL, storageState: state, reducedMotion: "reduce" });
    await context.addCookies([
      { name: "seedha_theme", value: theme, url: baseURL ?? "http://localhost:3001" },
    ]);
    const page = await context.newPage();
    await mockApi(page);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await openFeedback(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await scrollsSideways(page)).toBe(false);
      for (const b of await page.locator("[data-guest-feedback] button").all()) {
        const box = await b.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      found.push(...(await axeViolations(page)).map((v) => `${theme} ${width} site: ${v}`));
      await page.goto("/settings");
      await page.getByRole("tab", { name: "Hotel" }).click();
      await expect(page.getByRole("heading", { name: "Guest rewards" })).toBeVisible();
      found.push(...(await axeViolations(page)).map((v) => `${theme} ${width} settings: ${v}`));
    }
    await context.close();
  }
  expect(found).toEqual([]);
});
