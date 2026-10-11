import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import QRCode from "qrcode";
import { signIn } from "./helpers";

/**
 * The full-screen Desk kiosk (/desk/device) on a landscape tablet: idle ->
 * check-in -> the QR carries the URL the API sent -> the guest says yes ->
 * green ring and the slip on screen. These tests write a consent and a
 * checkout, so the sample hotel is reset afterwards and the 8-step loop
 * still starts from "0 of 8 done".
 */

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1280, height: 800 } });

test.afterAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  const reset = await page.request.post("/api/demo/reset");
  expect(reset.ok()).toBe(true);
  await context.close();
});

/** Start a check-in from the kiosk's staff panel and return the QR's URL. */
async function showQr(page: Page, room: string): Promise<string> {
  await page.getByText("Staff: check in or check out").click();
  await page.locator("#kioskRoom").selectOption(room);
  await page.getByRole("button", { name: "Show QR" }).click();
  const qr = page.getByRole("img", { name: "Consent QR code" });
  await expect(qr).toBeVisible();
  await expect(qr.locator("svg")).toBeVisible();
  return (await qr.getAttribute("data-url")) ?? "";
}

/** The guest opens the link on their own phone and says yes. */
async function guestSaysYes(browser: Browser, url: string, phone: string): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guest = await context.newPage();
  await guest.goto(url);
  await guest.locator("#whatsapp").fill(phone);
  const yes = guest.getByRole("button", { name: "Yes, send me offers" });
  await expect(yes).toBeDisabled();
  await guest.getByRole("checkbox").check();
  await yes.click();
  await expect(guest.getByText("You are in.")).toBeVisible();
  await context.close();
}

test("kiosk: idle, QR from the API, consent, green ring and slip", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/desk/device");
  const origin = new URL(page.url()).origin;

  // Own frame: a main landmark, no site header or footer.
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator(".site-header")).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.getByText("Connected, checking every 2 seconds")).toBeVisible();
  const ring = page.getByTestId("desk-ring");
  await expect(ring).toHaveAccessibleName("Desk light white: ready");
  await expect(page.getByText("Desk ready.")).toBeAttached();

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // Check-in: the QR encodes exactly the API's consent URL on the configured origin.
  const url = await showQr(page, "101");
  expect(url.startsWith(`${origin}/consent/`)).toBe(true);
  const expected = await QRCode.toString(url, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const modules = /stroke="#000000" d="([^"]+)"/.exec(expected)?.[1];
  expect(modules).toBeTruthy();
  const drawn = page.getByRole("img", { name: "Consent QR code" }).locator('path[stroke="#000000"]');
  await expect(drawn).toHaveAttribute("d", modules ?? "");
  await expect(page.getByText(`Opens ${new URL(url).host}`)).toBeVisible();

  // The guest says yes on their phone: thank you, green ring, pulsing.
  await guestSaysYes(browser, url, "98111 33355");
  await expect(page.getByText("Thank you, Kritika ji", { exact: true })).toBeVisible();
  await expect(ring).toHaveAccessibleName("Desk light green: consent saved");
  const stage = page.locator('[data-ring="green"]');
  await expect(stage).toBeVisible();
  expect(await stage.evaluate((el) => getComputedStyle(el).animationName)).toContain("kioskPulse");

  // Checkout: the slip shows on screen as a receipt.
  await page.getByRole("button", { name: "Check out and print" }).click();
  const slip = page.getByRole("figure", { name: "Slip on screen" });
  await expect(slip).toContainText("Hotel kept");
  await expect(slip).toContainText("DEODAR-");
  await expect(page.getByText("This screen has no printer, so the slip is shown here.")).toBeVisible();

  // Simulated paper out: red ring, clearly labelled, slip still on screen.
  await page.getByRole("button", { name: "Simulated: no paper" }).click();
  await expect(ring).toHaveAccessibleName("Desk light red: printer needs paper");
  await expect(page.getByText("Printer needs paper, so the slip is shown here.")).toBeVisible();
  await expect(slip).toBeVisible();
});

test("kiosk: reduced motion keeps the green ring still", async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await page.goto("/desk/device");
  await expect(page.getByText("Connected, checking every 2 seconds")).toBeVisible();
  const url = await showQr(page, "102");
  await guestSaysYes(browser, url, "98111 33366");
  const stage = page.locator('[data-ring="green"]');
  await expect(stage).toBeVisible();
  expect(await stage.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("kiosk: a phone held upright gets a hint and still works", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/desk/device");
  await expect(page.getByText("Turn your phone sideways for a bigger QR.")).toBeVisible();
  await expect(page.getByText("Connected, checking every 2 seconds")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
