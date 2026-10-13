import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { axeViolations, scrollsSideways } from "./helpers";

/**
 * The verified guest's one-time rating page /rate/<token>: noindex, EN and
 * HI, a 1 to 5 star radio group, an optional comment (200 characters, no
 * < or >), sent once; the open, used and invalid states. The open and used
 * flows mock GET and POST /api/public/rate/<token>, so they test the page
 * alone; the last test asks the real API with an unknown token. The real
 * one-time token from a booking NEEDS A1 (routers/ratings.py).
 */

const TOKEN = "e2e-rate-token";

async function mockRate(page: Page, state: "open" | "used" | "invalid", post = 204): Promise<string[]> {
  const sent: string[] = [];
  await page.route(`**/api/public/rate/${TOKEN}`, async (route) => {
    if (route.request().method() === "POST") {
      sent.push(route.request().postData() ?? "");
      if (post === 204) return route.fulfill({ status: 204, body: "" });
      return route.fulfill({
        status: post,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "rating_used", message: "Already rated" } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hotel: "Deodar View", slug: "deodar-view", state }),
    });
  });
  return sent;
}

test("open: choose stars, write a comment, send once; noindex; 390 px clean", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sent = await mockRate(page, "open");
  await page.goto(`/rate/${TOKEN}`);
  expect(await page.locator("meta[name='robots']").getAttribute("content")).toMatch(/noindex/);
  await expect(page.getByRole("heading", { level: 1, name: "Rate your stay" })).toBeVisible();
  await expect(page.getByText("at Deodar View")).toBeVisible();
  const group = page.getByRole("group", { name: "How was your stay?" });
  await expect(group.getByRole("radio")).toHaveCount(5);
  await page.getByRole("button", { name: "Send rating" }).click();
  await expect(page.getByText("Choose from 1 to 5 stars.")).toBeVisible();
  expect(sent).toHaveLength(0);

  await group.getByRole("radio", { name: "4 stars" }).check();
  const comment = page.getByLabel("A short comment (optional)");
  await comment.fill("Quiet <b>");
  await expect(page.getByText("Please leave out the < and > signs.")).toBeVisible();
  await comment.fill("Quiet rooms and kind staff");
  expect(await scrollsSideways(page)).toBe(false);
  expect(await axeViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Send rating" }).click();
  await expect(page.getByRole("heading", { name: "Thank you. Your rating is saved." })).toBeVisible();
  expect(sent.map((b) => JSON.parse(b) as unknown)).toEqual([
    { stars: 4, comment: "Quiet rooms and kind staff" },
  ]);
});

test("Hindi at 1440, and a second send shows the used state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockRate(page, "open", 409);
  await page.goto(`/rate/${TOKEN}`);
  await page.getByRole("button", { name: "हिन्दी" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "अपने ठहराव को रेटिंग दें" })).toBeVisible();
  await page.getByRole("radio", { name: "5 स्टार" }).check();
  expect(await scrollsSideways(page)).toBe(false);
  expect(await axeViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "रेटिंग भेजें" }).click();
  await expect(page.getByRole("heading", { name: "यह लिंक पहले ही इस्तेमाल हो चुका है।" })).toBeVisible();
});

test("used and invalid links show no form", async ({ page }) => {
  await mockRate(page, "used");
  await page.goto(`/rate/${TOKEN}`);
  await expect(page.getByRole("heading", { name: "This link has already been used." })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.unroute(`**/api/public/rate/${TOKEN}`);
  await mockRate(page, "invalid");
  await page.reload();
  await expect(page.getByRole("heading", { name: "This rating link does not work." })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});

test("real API: an unknown token is invalid", async ({ page }) => {
  await page.goto("/rate/not-a-real-token-0000");
  await expect(page.getByRole("heading", { name: "This rating link does not work." })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
});
