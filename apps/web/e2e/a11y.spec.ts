import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * M11 accessibility pass: every page has no WCAG 2.1 A/AA violation that axe
 * can detect, in light and dark themes, on a laptop and a phone.
 */

const OWNER_PAGES = [
  "/home",
  "/upload",
  "/flip",
  "/repeat",
  "/scenario",
  "/approvals",
  "/savings",
  "/ask",
  "/site",
  "/proof",
  "/pro",
  "/settings",
  "/desk",
  "/onboard",
  "/my-place",
  "/inbox",
  "/assistant",
  "/calendar",
  "/billing",
];
const PUBLIC_PAGES = [
  "/",
  "/careers",
  "/link",
  "/link/DEODAR-RS26",
  "/plans",
  "/rate-card",
  "/about",
  "/privacy",
  "/terms",
  "/cookies",
  "/data-deletion",
  "/security",
  "/contact",
  "/faq",
  "/login",
  "/signup",
  "/demo",
  "/no-such-page",
];

test("no axe violations on any page, both themes, laptop and phone", async ({ page, context, baseURL }) => {
  test.setTimeout(300_000);
  // Final states only: entrance motion (hero blur-in, screen enter) would let
  // axe measure text mid-fade. Contrast is the same once motion settles.
  await page.emulateMedia({ reducedMotion: "reduce" });
  // One login for the whole sweep: owner login is rate limited.
  await signIn(page);

  const found: string[] = [];
  for (const theme of ["light", "dark"]) {
    await context.addCookies([
      { name: "seedha_theme", value: theme, url: baseURL ?? "http://localhost:3001" },
    ]);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [...OWNER_PAGES, ...PUBLIC_PAGES]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        for (const v of result.violations) {
          found.push(
            `${theme} ${width}px ${path}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
          );
        }
      }
    }
  }
  expect(found).toEqual([]);
});

test("keyboard: skip link, and the UPI sheet holds and returns focus", async ({ page }) => {
  await page.goto("/link");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();

  const pay = page.getByRole("button", { name: /Pay .* with UPI/ });
  await pay.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Pay with UPI" });
  // Order inside the sheet: Google Pay, PhonePe, Paytm, Pay ₹8,600, Cancel. Focus starts on Pay.
  await expect(sheet.getByRole("button", { name: /^Pay ₹/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sheet.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sheet.getByRole("button", { name: "Google Pay" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(sheet.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(pay).toBeFocused();
});

test("footer links are 44px tap targets on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  for (const path of ["/plans", "/link"]) {
    await page.goto(path);
    const heights = await page
      .locator("footer.site-footer a")
      .evaluateAll((links) => links.map((a) => a.getBoundingClientRect().height));
    expect(heights.length, path).toBeGreaterThan(0);
    expect(Math.min(...heights), path).toBeGreaterThanOrEqual(44);
  }
});
