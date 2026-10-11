import { expect, test, type Locator, type Page } from "@playwright/test";

// Seedha Pulse section on the public website (docs/PULSE_SECTION.md, VERIFY).
// Sample events, a channel decision per event, no rupee figures.

const EVENTS = [
  "Dussehra",
  "Diwali",
  "Guru Nanak Jayanti",
  "Winter Line Carnival",
  "New Year's Eve",
  "Republic Day weekend",
];

async function openPulse(page: Page): Promise<Locator> {
  await page.goto("/");
  const pulse = page.locator("#pulse");
  await pulse.scrollIntoViewIfNeeded();
  await expect(pulse.getByRole("heading", { level: 2 })).toHaveText("Every festival, one channel decision.");
  return pulse;
}

/** The channel row for `name` on the decision card. */
function row(card: Locator, name: string): Locator {
  return card.getByRole("listitem").filter({ hasText: name });
}

test.describe("desktop 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("six events render with Sample labels and a node click changes the card", async ({ page }) => {
    const pulse = await openPulse(page);
    const nodes = pulse.getByRole("list", { name: /Season timeline/ }).getByRole("button");
    await expect(nodes).toHaveCount(6);
    const card = pulse.locator("[data-pulse-card]");
    for (const [i, name] of EVENTS.entries()) {
      await nodes.nth(i).click();
      await expect(nodes.nth(i)).toHaveAttribute("aria-current", "step");
      await expect(card).toContainText(name);
      await expect(card.getByText("Sample", { exact: true }).first()).toBeVisible();
    }
    // Earlier nodes are ticked and read as done.
    await expect(nodes.nth(0)).toContainText("done");
  });

  test("arrow keys, Home and End move between events", async ({ page }) => {
    const pulse = await openPulse(page);
    const nodes = pulse.getByRole("list", { name: /Season timeline/ }).getByRole("button");
    await nodes.nth(0).click();
    const story = pulse.getByRole("group", { name: /Season story/ });
    await story.focus();
    const card = pulse.locator("[data-pulse-card]");
    await page.keyboard.press("ArrowDown");
    await expect(card).toContainText("Diwali");
    await page.keyboard.press("ArrowRight");
    await expect(card).toContainText("Guru Nanak Jayanti");
    await page.keyboard.press("ArrowUp");
    await expect(card).toContainText("Diwali");
    await page.keyboard.press("End");
    await expect(card).toContainText("Republic Day weekend");
    // Clamped at the end: no wrap back to the first event.
    await page.keyboard.press("ArrowDown");
    await expect(nodes.nth(5)).toHaveAttribute("aria-current", "step");
    await page.keyboard.press("Home");
    await expect(card).toContainText("Dussehra");
  });

  test("the channel rail shows Held back for the right events", async ({ page }) => {
    const pulse = await openPulse(page);
    const nodes = pulse.getByRole("list", { name: /Season timeline/ }).getByRole("button");
    const card = pulse.locator("[data-pulse-card]");
    const live = pulse.locator("[data-pulse-live]");
    const held: Record<number, string[]> = {
      0: ["MakeMyTrip", "Booking.com", "Agoda"],
      3: ["Agoda"],
      5: ["Agoda"],
    };
    for (const [i, channels] of Object.entries(held)) {
      await nodes.nth(Number(i)).click();
      await expect(card).toContainText(EVENTS[Number(i)] ?? "");
      for (const name of channels) {
        await expect(row(card, name)).toContainText("Held back");
        await expect(live).toContainText(`${name} held back`);
      }
      await expect(row(card, "Direct")).not.toContainText("Held back");
    }
    await nodes.nth(4).click();
    await expect(card).toContainText("New Year's Eve");
    await expect(card).not.toContainText("Held back");
    await expect(live).toContainText("All channels open.");
  });

  test("Play season advances and stops on input", async ({ page }) => {
    const pulse = await openPulse(page);
    const nodes = pulse.getByRole("list", { name: /Season timeline/ }).getByRole("button");
    await nodes.nth(0).click();
    const play = pulse.getByRole("button", { name: "Play season" });
    await expect(play).toHaveAttribute("aria-pressed", "false");
    await play.click();
    await expect(play).toHaveAttribute("aria-pressed", "true");
    await expect(nodes.nth(1)).toHaveAttribute("aria-current", "step", { timeout: 5000 });
    await page.keyboard.press("Shift");
    await expect(play).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(3500);
    await expect(nodes.nth(1)).toHaveAttribute("aria-current", "step");
  });

  test("Event Radar appears once, after the section, and no rupee figure in Pulse", async ({ page }) => {
    const pulse = await openPulse(page);
    await expect(page.locator("#event-radar")).toHaveCount(1);
    await expect(pulse.locator("#event-radar")).toHaveCount(0);
    await expect(pulse.getByRole("link", { name: "See Event Radar (Beta)" })).toHaveAttribute(
      "href",
      "#event-radar",
    );
    const text = await pulse.innerText();
    expect(text).not.toMatch(/₹|\bRs\b/);
    expect(text).toContain("Sample events for a Mussoorie hotel. Confirm dates locally before you act.");
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("shows the plain list: six cards, no sticky, no Play season", async ({ page }) => {
    const pulse = await openPulse(page);
    for (const name of EVENTS) await expect(pulse.getByText(name, { exact: true }).first()).toBeVisible();
    await expect(pulse.getByText("Sample", { exact: true })).toHaveCount(6);
    await expect(pulse.getByRole("list", { name: /Season timeline/ })).toHaveCount(0);
    await expect(pulse.getByRole("button", { name: "Play season" })).toHaveCount(0);
    const sticky = await pulse.evaluate(
      (root) =>
        [...root.querySelectorAll("*")].filter((el) => getComputedStyle(el).position === "sticky").length,
    );
    expect(sticky).toBe(0);
  });
});

test.describe("mobile 390", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("chips swap the card, swipe moves, and the page never scrolls sideways", async ({ page }) => {
    const pulse = await openPulse(page);
    const chips = pulse.getByRole("list", { name: /Season events/ }).getByRole("button");
    await expect(chips).toHaveCount(6);
    const card = pulse.locator("[data-pulse-card]");
    await chips.nth(3).click();
    await expect(chips.nth(3)).toHaveAttribute("aria-current", "step");
    await expect(card).toContainText("Winter Line Carnival");
    await chips.nth(1).click();
    await expect(card).toContainText("Diwali");

    // Swipe left on the card: next event. Card top under the header, clear of the cookie banner.
    await card.evaluate((el) => el.scrollIntoView({ block: "start" }));
    const box = await card.boundingBox();
    if (!box) throw new Error("card not laid out");
    const y = box.y + 60;
    await page.mouse.move(box.x + box.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 6 });
    await page.mouse.up();
    await expect(card).toContainText("Guru Nanak Jayanti");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("#event-radar")).toHaveCount(1);
  });
});
