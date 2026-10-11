import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * POLISH_BUILD C: every Pro card expands in place into its live mini view.
 * Escape and the Close button collapse it, focus returns to the card, and
 * only one card is open at a time. B6's five views are only opened and
 * closed here; content is asserted for B5's five.
 */

const CARDS = [
  { id: "audit", name: "Seedha Audit" },
  { id: "pulse", name: "Seedha Pulse" },
  { id: "rate-watch", name: "Rate Watch" },
  { id: "tonight", name: "Tonight Card" },
  { id: "discount-split", name: "Who Paid the Discount" },
  { id: "floor", name: "Floor by Channel" },
  { id: "displacement", name: "Group Displacement" },
  { id: "khata", name: "Agent Khata" },
  { id: "rollup", name: "Two-Property Rollup" },
  { id: "proof", name: "Seedha Proof" },
] as const;

const trigger = (page: Page, id: string) => page.getByTestId(`pro-card-${id}`).locator(`#pro-${id}-trigger`);
const view = (page: Page, id: string) => page.getByTestId(`pro-view-${id}`);

async function openPro(page: Page): Promise<void> {
  await signIn(page);
  await page.goto("/pro");
  await expect(trigger(page, "audit")).toBeVisible();
}

test("each card expands and collapses with Escape and Close, focus returns", async ({ page }) => {
  await openPro(page);
  for (const card of CARDS) {
    const t = trigger(page, card.id);
    await expect(t).toHaveAttribute("aria-expanded", "false");
    await expect(t).toHaveAttribute("aria-controls", `pro-${card.id}-view`);
    await t.click();
    await expect(t).toHaveAttribute("aria-expanded", "true");
    const region = page.getByRole("region", { name: `${card.name}, live view` });
    await expect(region).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(region).toHaveCount(0);
    await expect(t).toBeFocused();
    await expect(t).toHaveAttribute("aria-expanded", "false");

    await t.press("Enter");
    await expect(region).toBeVisible();
    await region.getByRole("button", { name: `Close ${card.name}` }).click();
    await expect(region).toHaveCount(0);
    await expect(t).toBeFocused();
  }
});

test("only one card is open at a time", async ({ page }) => {
  await openPro(page);
  await trigger(page, "audit").click();
  await expect(view(page, "audit")).toBeVisible();
  await trigger(page, "proof").click();
  await expect(view(page, "proof")).toBeVisible();
  await expect(view(page, "audit")).toHaveCount(0);
  await expect(page.locator('[data-open="true"]')).toHaveCount(1);
  await expect(trigger(page, "audit")).toHaveAttribute("aria-expanded", "false");
});

test("B5 views show their live content", async ({ page }) => {
  await openPro(page);

  await trigger(page, "audit").click();
  const audit = view(page, "audit");
  // Before any upload the card offers the upload; after it, the disputes.
  const auditLink = audit.getByRole("link", { name: /^(Open the disputes|Upload statements)$/ });
  await expect(auditLink).toHaveAttribute("href", /^\/upload(#disputes)?$/);

  await trigger(page, "pulse").click();
  const pulse = view(page, "pulse");
  await expect(
    pulse.getByText("It is a channel decision. It does not predict demand.", { exact: false }),
  ).toBeVisible();
  await pulse.getByRole("button", { name: "Diwali" }).click();
  await expect(pulse.getByRole("button", { name: "Diwali" })).toHaveAttribute("aria-pressed", "true");
  await expect(pulse.getByRole("heading", { name: "Diwali" })).toBeVisible();
  await expect(pulse).not.toContainText("₹");

  await trigger(page, "rate-watch").click();
  const rate = view(page, "rate-watch");
  await expect(rate).toContainText("From your screenshot. No scraping.");
  await expect(rate).toContainText("₹3,950");
  await expect(rate).toContainText("₹4,300");
  await expect(rate).toContainText("₹350");
  await expect(page.getByTestId("pro-card-rate-watch")).toContainText("Sample");

  await trigger(page, "tonight").click();
  const tonight = view(page, "tonight");
  await expect(tonight.getByText("Rooms left", { exact: true })).toBeVisible();
  await expect(tonight.getByText("Best channel", { exact: true })).toBeVisible();

  await trigger(page, "proof").click();
  const proof = view(page, "proof");
  await expect(proof.getByText("Proven", { exact: true })).toBeVisible();
  await expect(proof.getByText("Latest bundle", { exact: true })).toBeVisible();
  await expect(proof.getByRole("link", { name: "Open Proof" })).toHaveAttribute("href", "/proof");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a card opens instantly with no transform in flight", async ({ page }) => {
    await openPro(page);
    await trigger(page, "rate-watch").click();
    const region = view(page, "rate-watch");
    // Read the state in the very next frame: no fade, no layout transform.
    const state = await region.evaluate(
      (el) =>
        new Promise<{ opacity: string; transform: string }>((resolve) =>
          requestAnimationFrame(() => {
            const card = el.closest("article") as HTMLElement;
            resolve({ opacity: getComputedStyle(el).opacity, transform: card.style.transform || "none" });
          }),
        ),
    );
    expect(state.opacity).toBe("1");
    expect(state.transform).toBe("none");
  });
});

test("axe is clean with a card open, light and dark", async ({ page }) => {
  await openPro(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await trigger(page, "audit").click();
    await expect(view(page, "audit").getByRole("link").first()).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.keyboard.press("Escape");
  }
});
