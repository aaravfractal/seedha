import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * POLISH_BUILD A: the Overview room board. Room nights and each room's lines
 * come from GET /rooms/nights and GET /rooms/{night}/{room}; the browser only
 * formats them.
 */

const board = (page: Page) => page.getByTestId("room-board");
const grid = (page: Page) => page.getByTestId("room-grid");
const sheet = (page: Page) => page.getByTestId("room-sheet");

/** The first sold room whose channel charges commission (not walk-in or direct). */
async function firstOtaTile(page: Page) {
  const tile = grid(page)
    .locator('button:not([data-ch="empty"]):not([data-ch="walkin"]):not([data-ch="direct"])')
    .first();
  await expect(tile).toBeVisible();
  return tile;
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId("night-scrubber")).toBeVisible();
});

test("a room opens a sheet with its money lines and initials only", async ({ page }) => {
  const tile = await firstOtaTile(page);
  await expect(tile).toHaveAttribute("aria-label", /^Room \d+, .+/);
  await tile.click();
  const s = sheet(page);
  await expect(s).toBeVisible();
  await expect(s.getByRole("heading", { name: /^Room \d+$/ })).toBeVisible();
  const money = s.getByTestId("room-money");
  for (const line of ["List rate", "Discount", "Commission", "GST on commission", "Fees", "Net kept"]) {
    await expect(money.getByText(line, { exact: true })).toBeVisible();
  }
  await expect(money).toContainText("₹");
  await expect(s.getByTestId("room-initials")).toHaveText(/^[A-Z]{1,3}$/);
  // Initials only: no two capitalised words in a row (a full name) in the sheet header.
  await expect(s.locator("p, b").filter({ hasText: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/ })).toHaveCount(0);
  const ifDirect = s.getByTestId("room-if-direct");
  await expect(ifDirect).toContainText("If this room had been direct");
  await expect(ifDirect).toContainText("Illustration");
  await expect(s.getByText(/Sample|Demo/)).toHaveCount(0);
  await expect(s.getByRole("link", { name: "Open in Desk" })).toHaveAttribute("href", /\/desk\?room=\d+$/);
  await s.getByRole("button", { name: "Print slip" }).click();
  await expect(page.getByText("Slip sent to the Desk")).toBeVisible();
});

test("arrow keys move between rooms, Enter opens, Escape closes and returns focus", async ({ page }) => {
  const tiles = grid(page).getByRole("button");
  await tiles.first().focus();
  await expect(tiles.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(1)).toBeFocused();
  await expect(tiles.nth(1)).toHaveAttribute("tabindex", "0");
  await expect(tiles.first()).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("ArrowLeft");
  await expect(tiles.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(tiles.last()).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(tiles.first()).toBeFocused();
  await page.keyboard.press(" ");
  await expect(sheet(page)).toBeVisible();
});

test("channel chips filter the rooms and dim the others", async ({ page }) => {
  const chips = board(page).getByRole("group", { name: "Show rooms by channel" });
  const mmt = chips.getByRole("button", { name: /MakeMyTrip/ });
  await expect(mmt).toHaveAttribute("aria-pressed", "false");
  const count = await grid(page).locator('button[data-ch="mmt"]').count();
  expect(count).toBeGreaterThan(0);
  await expect(mmt).toHaveText(new RegExp(`MakeMyTrip\\s*${count}$`));
  await mmt.click();
  await expect(mmt).toHaveAttribute("aria-pressed", "true");
  await expect(grid(page).locator('button[data-ch="mmt"]:not([data-dim])')).toHaveCount(count);
  await expect(grid(page).locator('button:not([data-ch="mmt"]):not([data-dim])')).toHaveCount(0);
  await mmt.click();
  await expect(mmt).toHaveAttribute("aria-pressed", "false");
  await expect(grid(page).locator("button[data-dim]")).toHaveCount(0);
});

test("the night scrubber changes the summary and the counts", async ({ page }) => {
  const summary = page.getByTestId("night-summary");
  const radios = page.getByTestId("night-scrubber").getByRole("radio");
  await expect(radios).toHaveCount(7);
  await expect(radios.last()).toHaveAttribute("aria-checked", "true");
  await expect(summary).toContainText(/\d+ of \d+ rooms sold · ₹[\d,]+ net kept/);
  await expect(summary).not.toContainText(/direct share/i);
  await expect(board(page).getByRole("heading", { name: "Last night" })).toBeVisible();
  const before = await summary.textContent();
  await radios.first().click();
  await expect(radios.first()).toHaveAttribute("aria-checked", "true");
  await expect(board(page).getByRole("heading", { name: /^Night of / })).toBeVisible();
  await expect(summary).not.toHaveText(before ?? "");
  await page.keyboard.press("End");
  await expect(radios.last()).toHaveAttribute("aria-checked", "true");
  await expect(summary).toHaveText(before ?? "");
});

test("Message guest shows only for a guest who consented at the Desk", async ({ page }) => {
  let consented = false;
  await page.route(/\/api\/rooms\/\d{4}-\d{2}-\d{2}\/\d+$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      json: consented
        ? { ...body, consent_status: "consented_at_desk", consent_id: 4242 }
        : { ...body, consent_status: "not_consented", consent_id: null },
    });
  });
  const tile = await firstOtaTile(page);
  await tile.click();
  await expect(sheet(page).getByText("Not consented")).toBeVisible();
  await expect(sheet(page).getByRole("link", { name: "Message guest" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  consented = true;
  await tile.click();
  await expect(sheet(page).getByText("Consented at Desk")).toBeVisible();
  await expect(sheet(page).getByRole("link", { name: "Message guest" })).toHaveAttribute(
    "href",
    "/inbox?thread=4242",
  );
});

test("reduced motion makes the board and sheet instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const tile = await firstOtaTile(page);
  expect(await tile.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await tile.click();
  await expect(sheet(page)).toBeVisible();
  expect(await sheet(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("Open in Desk preselects the room", async ({ page }) => {
  const tile = await firstOtaTile(page);
  const room = (await tile.getAttribute("aria-label"))?.match(/^Room (\d+)/)?.[1] ?? "";
  await tile.click();
  await sheet(page).getByRole("link", { name: "Open in Desk" }).click();
  await expect(page).toHaveURL(new RegExp(`/desk\\?room=${room}$`));
  await expect(page.locator("#guestSel")).toHaveValue(room);
});
