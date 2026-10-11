import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { signIn } from "./helpers";
import {
  deduction,
  expectedSummary,
  getJson,
  inr,
  longDay,
  roomNights,
  shortDay,
  threads,
} from "./polish-helpers";
import type { Night, RoomDetail } from "./polish-helpers";

/**
 * Wave 3 T2, room board against the real API (seeded through the CLI with
 * seven desk nights): the sheet's lines equal GET /rooms/{night}/{room},
 * keyboard movement by the rendered columns, chips and scrubber against
 * GET /rooms/nights, consent-only Message guest on a seeded consented
 * guest, and the phone layout. Read-only apart from a slip print.
 */

const board = (page: Page) => page.getByTestId("room-board");
const grid = (page: Page) => page.getByTestId("room-grid");
const sheet = (page: Page) => page.getByTestId("room-sheet");
const scrubber = (page: Page) => page.getByTestId("night-scrubber");
const tileFor = (page: Page, room: number) =>
  grid(page).getByRole("button", { name: new RegExp(`^Room ${room},`) });

/** The value cell of one money line on the sheet. */
const line = (money: Locator, label: string) => money.locator(`div:has(> dt:text-is("${label}")) > dd`);

/** Wait until the sheet (and scrim) have finished their entrance animation. */
async function settled(el: Locator): Promise<void> {
  await el.evaluate((node) =>
    Promise.all(
      [node, node.parentElement].flatMap((n) => (n ? n.getAnimations().map((a) => a.finished) : [])),
    ),
  );
}

/** Pick a night on the scrubber by its date and wait for the board to show it. */
async function showNight(page: Page, nights: Night[], night: Night): Promise<void> {
  const last = nights.at(-1)?.night === night.night;
  await scrubber(page)
    .getByRole("radio", { name: `${longDay(night.night)}${last ? ", last night" : ""}`, exact: true })
    .click();
  await expect(page.getByTestId("night-summary")).toHaveText(expectedSummary(night));
}

/** Columns in the rendered grid: tiles that share the first tile's top edge. */
async function renderedColumns(page: Page): Promise<number> {
  return grid(page)
    .getByRole("button")
    .evaluateAll(
      (tiles) =>
        tiles.filter((t) => (t as HTMLElement).offsetTop === (tiles[0] as HTMLElement).offsetTop).length,
    );
}

/** Every line on the open sheet against the API's detail JSON for that room. */
async function expectSheetMatches(page: Page, d: RoomDetail): Promise<void> {
  const s = sheet(page);
  await expect(s.getByRole("heading", { name: `Room ${d.room}`, exact: true })).toBeVisible();
  await expect(s).toContainText(`Night of ${longDay(d.night)}`);
  await expect(s.getByTestId("room-initials")).toHaveText(d.guest_initials);
  expect(d.guest_initials).toMatch(/^[A-Z]{1,3}$/);
  await expect(s).toContainText(d.channel_name);
  await expect(s).toContainText(`${d.nights} night${d.nights === 1 ? "" : "s"}`);

  const money = s.getByTestId("room-money");
  await expect(line(money, "List rate")).toHaveText(inr(d.list_amount));
  await expect(line(money, "Discount")).toHaveText(deduction(d.discount));
  await expect(line(money, "Fees")).toHaveText(deduction(d.fees));
  await expect(line(money, "Net kept")).toHaveText(inr(d.net_kept));
  const noCommission = d.commission === 0 && d.gst_on_commission === 0 && d.if_direct === null;
  if (noCommission) {
    // Walk-in and direct rooms pay no commission: no commission lines at all.
    await expect(line(money, "Commission")).toHaveCount(0);
    await expect(line(money, "GST on commission")).toHaveCount(0);
    await expect(s.getByTestId("room-if-direct")).toHaveCount(0);
  } else {
    await expect(line(money, "Commission")).toHaveText(deduction(d.commission));
    await expect(line(money, "GST on commission")).toHaveText(deduction(d.gst_on_commission));
  }
  // The deterministic identity the API promises: list - deductions = net kept.
  expect(d.list_amount - d.discount - d.commission - d.gst_on_commission - d.fees).toBe(d.net_kept);

  if (d.if_direct) {
    const box = s.getByTestId("room-if-direct");
    await expect(box).toContainText(`+${inr(d.if_direct.extra_kept)} more kept`);
    await expect(box).toContainText(`Commission ${inr(d.if_direct.commission_avoided)}`);
    await expect(box).toContainText(`GST on it ${inr(d.if_direct.gst_avoided)}`);
    await expect(box).toContainText(`UPI fee of ${inr(d.if_direct.upi_fee)}`);
  }

  const consented = d.consent_status === "consented_at_desk" && d.consent_id !== null;
  await expect(s.getByText(consented ? "Consented at Desk" : "Not consented", { exact: true })).toBeVisible();
  await expect(s.getByRole("link", { name: "Message guest" })).toHaveCount(consented ? 1 : 0);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await expect(board(page)).toBeVisible();
  await expect(scrubber(page)).toBeVisible();
});

test("sheet lines equal the API detail for an OTA, a walk-in and a direct room", async ({ page }) => {
  const nights = await roomNights(page);
  const last = nights.at(-1);
  expect(last, "the API has board nights").toBeTruthy();
  if (!last) return;
  const sold = last.tiles.filter((t) => t.sold && t.channel_key);
  const picks = [
    sold.find((t) => !["walkin", "direct"].includes(t.channel_key ?? "")),
    sold.find((t) => t.channel_key === "walkin"),
    sold.find((t) => t.channel_key === "direct"),
  ].filter((t) => t !== undefined);
  expect(picks.length, "last night has an OTA, a walk-in and a direct room").toBe(3);

  for (const pick of picks) {
    const d = await getJson<RoomDetail>(page, `rooms/${last.night}/${pick.room}`);
    expect(d.room).toBe(pick.room);
    expect(d.channel_key).toBe(pick.channel_key);
    const tile = tileFor(page, pick.room);
    await tile.click();
    await expect(sheet(page)).toBeVisible();
    await expectSheetMatches(page, d);
    // Close button shuts the sheet and focus goes back to the room tile.
    await sheet(page).getByRole("button", { name: "Close" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(tile).toBeFocused();
  }

  // Print slip on the OTA room: the API accepts it and the owner sees a toast.
  const first = picks[0];
  if (!first) return;
  await tileFor(page, first.room).click();
  const slip = page.waitForResponse(
    (r) => r.url().endsWith(`/api/rooms/${last.night}/${first.room}/slip`) && r.request().method() === "POST",
  );
  await sheet(page).getByRole("button", { name: "Print slip" }).click();
  expect((await slip).ok()).toBe(true);
  await expect(page.getByText("Slip sent to the Desk")).toBeVisible();
});

test("arrow keys move by the rendered columns; Enter opens; Escape returns focus", async ({ page }) => {
  const tiles = grid(page).getByRole("button");
  const total = await tiles.count();
  const cols = await renderedColumns(page);
  expect(cols).toBeGreaterThan(1);
  expect(total).toBeGreaterThan(cols);
  // Only one tile is in the tab order (roving tabindex).
  await expect(grid(page).locator('button[tabindex="0"]')).toHaveCount(1);

  await tiles.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(tiles.nth(cols)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(cols + 1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(tiles.nth(1)).toBeFocused();
  // Up from the first row stays put; Left from the first tile stays put.
  await page.keyboard.press("ArrowUp");
  await expect(tiles.nth(1)).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowLeft");
  await expect(tiles.first()).toBeFocused();

  // Enter on a second-row tile opens its sheet; focus moves into the dialog.
  await page.keyboard.press("ArrowDown");
  const target = tiles.nth(cols);
  await expect(target).toBeFocused();
  const label = (await target.getAttribute("aria-label")) ?? "";
  const room = /^Room (\d+)/.exec(label)?.[1] ?? "";
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: `Room ${room}` });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  // Tab stays inside the sheet.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(target).toBeFocused();
  await expect(target).toHaveAttribute("tabindex", "0");
});

test("chips: counts equal by_channel, a chip dims every other room", async ({ page }) => {
  const nights = await roomNights(page);
  const last = nights.at(-1);
  if (!last) throw new Error("no board nights");
  const chips = board(page).getByRole("group", { name: "Show rooms by channel" });
  const empty = last.tiles.filter((t) => !t.sold).length;
  expect(empty).toBe(last.rooms_total - last.rooms_sold);
  const expected = [
    ...last.by_channel.map((c) => ({ key: c.channel_key, name: c.channel_name, rooms: c.rooms })),
    { key: "empty", name: "Empty", rooms: empty },
  ];
  await expect(grid(page).getByRole("button")).toHaveCount(last.rooms_total);

  for (const c of expected) {
    const chip = chips.locator(`button[data-ch="${c.key}"]`);
    await expect(chip).toHaveText(new RegExp(`${c.name}\\s*${c.rooms}$`));
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(chips.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(grid(page).locator("button:not([data-dim])")).toHaveCount(c.rooms);
    await expect(grid(page).locator(`button[data-ch="${c.key}"]:not([data-dim])`)).toHaveCount(c.rooms);
    await expect(grid(page).locator("button[data-dim]")).toHaveCount(last.rooms_total - c.rooms);
    // A dimmed room still opens: dimming is a filter, not a lock.
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(grid(page).locator("button[data-dim]")).toHaveCount(0);
  }
});

test("scrubber: every night shows that night's numbers from /rooms/nights", async ({ page }) => {
  const nights = await roomNights(page);
  expect(nights).toHaveLength(7);
  await expect(scrubber(page).getByRole("radio")).toHaveCount(nights.length);
  const chips = board(page).getByRole("group", { name: "Show rooms by channel" });

  for (const [i, n] of nights.entries()) {
    await showNight(page, nights, n);
    const isLast = i === nights.length - 1;
    await expect(board(page).getByRole("heading", { level: 2 })).toHaveText(
      isLast ? "Last night" : `Night of ${shortDay(n.night)}`,
    );
    await expect(scrubber(page).locator('[aria-checked="true"]')).toHaveCount(1);
    await expect(grid(page).getByRole("button")).toHaveCount(n.rooms_total);
    for (const c of n.by_channel) {
      await expect(grid(page).locator(`button[data-ch="${c.channel_key}"]`)).toHaveCount(c.rooms);
      await expect(chips.locator(`button[data-ch="${c.channel_key}"]`)).toHaveText(
        new RegExp(`${c.channel_name}\\s*${c.rooms}$`),
      );
    }
    await expect(grid(page).locator('button[data-ch="empty"]')).toHaveCount(n.rooms_total - n.rooms_sold);
  }

  // Keyboard: Left steps back one night, Home goes to the first, End to the last.
  const radios = scrubber(page).getByRole("radio");
  await radios.last().focus();
  await page.keyboard.press("ArrowLeft");
  const prev = nights.at(-2);
  if (prev) await expect(page.getByTestId("night-summary")).toHaveText(expectedSummary(prev));
  await page.keyboard.press("Home");
  const first = nights[0];
  if (first) await expect(page.getByTestId("night-summary")).toHaveText(expectedSummary(first));
  await expect(radios.first()).toBeFocused();
  await page.keyboard.press("End");
  const last = nights.at(-1);
  if (last) await expect(page.getByTestId("night-summary")).toHaveText(expectedSummary(last));
});

test("Message guest only for a seeded guest who consented at the Desk", async ({ page }) => {
  const nights = await roomNights(page);
  const names = await threads(page);
  // Search the board nights, newest first, for a night with a consented
  // guest who has a thread, and a not-consented room on that same night.
  let consented: RoomDetail | null = null;
  let notConsented: RoomDetail | null = null;
  for (const n of [...nights].reverse()) {
    const details: RoomDetail[] = [];
    for (const t of n.tiles.filter((x) => x.sold)) {
      details.push(await getJson<RoomDetail>(page, `rooms/${n.night}/${t.room}`));
    }
    for (const d of details) {
      if (d.consent_status !== "consented_at_desk") expect(d.consent_id).toBeNull();
    }
    const found = details.find(
      (d) => d.consent_status === "consented_at_desk" && names.some((x) => x.consent_id === d.consent_id),
    );
    if (found) {
      consented = found;
      notConsented = details.find((d) => d.consent_id === null) ?? null;
      break;
    }
  }

  if (!consented) {
    // No consented guest on any board night: no sheet may offer Message guest.
    const last = nights.at(-1);
    const sold = last?.tiles.find((t) => t.sold);
    if (!last || !sold) throw new Error("no sold room on the last night");
    await tileFor(page, sold.room).click();
    await expect(sheet(page).getByText("Not consented", { exact: true })).toBeVisible();
    await expect(sheet(page).getByRole("link", { name: "Message guest" })).toHaveCount(0);
    return;
  }

  const hit: RoomDetail = consented;
  const night = nights.find((n) => n.night === hit.night);
  if (!night) throw new Error("consented night not on the board");
  await showNight(page, nights, night);

  if (notConsented) {
    await tileFor(page, notConsented.room).click();
    await expectSheetMatches(page, notConsented);
    await expect(sheet(page)).toContainText("Seedha messages only guests who said yes at the Desk.");
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
  }

  const guest = names.find((x) => x.consent_id === hit.consent_id);
  const fullName = guest?.guest_name ?? "";
  await tileFor(page, hit.room).click();
  await expectSheetMatches(page, hit);
  // Initials only: the consented guest's full name never reaches the board.
  const initials = fullName
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("");
  expect(hit.guest_initials).toBe(initials);
  for (const part of fullName.split(/\s+/)) await expect(sheet(page)).not.toContainText(part);
  await expect(sheet(page)).not.toContainText("Seedha messages only guests who said yes at the Desk.");

  const message = sheet(page).getByRole("link", { name: "Message guest" });
  await expect(message).toHaveAttribute("href", `/inbox?thread=${hit.consent_id}`);
  await message.click();
  await expect(page).toHaveURL(new RegExp(`/inbox\\?thread=${hit.consent_id}$`));
  await expect(page.getByRole("region", { name: `Conversation with ${fullName}` })).toBeVisible();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("four tiles a row, arrows follow them, the sheet sits at the bottom", async ({ page }) => {
    expect(await renderedColumns(page)).toBe(4);
    const tiles = grid(page).getByRole("button");
    await tiles.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(tiles.nth(4)).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

    const tile = grid(page).locator('button:not([data-ch="empty"])').first();
    await tile.click();
    const s = sheet(page);
    await expect(s.getByTestId("room-money")).toBeVisible();
    await settled(s);
    const box = await s.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(390);
    expect(Math.abs(box.y + box.height - 844)).toBeLessThanOrEqual(1);
    expect(box.y).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(s).toHaveCount(0);
    await expect(tile).toBeFocused();
  });
});

test("desktop: the sheet is a side sheet on the right", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await grid(page).locator('button:not([data-ch="empty"])').first().click();
  const s = sheet(page);
  await expect(s.getByTestId("room-money")).toBeVisible();
  await settled(s);
  const box = await s.boundingBox();
  if (!box) throw new Error("no sheet box");
  expect(Math.round(box.x + box.width)).toBe(1440);
  expect(box.width).toBeLessThanOrEqual(440);
  expect(Math.round(box.height)).toBe(900);
  // The scrim closes it too.
  await page.mouse.click(100, 450);
  await expect(s).toHaveCount(0);
});
