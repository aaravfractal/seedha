import { expect, test } from "@playwright/test";
import { axeViolations, scrollsSideways, signIn } from "./helpers";

/**
 * Live features smoke: the front desk screen, the Calendar's Add events sheet and
 * the Proof screen in light and dark, on a phone (390) and a laptop (1440).
 * No sideways scroll, the key text on screen, and no axe WCAG 2.1 A/AA
 * violation. Read only: the sheet is closed without reading or saving, and
 * no check-in is started, so nothing needs cleaning up.
 */

const THEMES = ["light", "dark"] as const;
const WIDTHS = [390, 1440] as const;

test("Front desk screen, Calendar sheet and Proof: both themes, phone and laptop", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(240_000);
  // Final states only, as in a11y.spec.ts: no contrast measured mid-fade.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);

  const found: string[] = [];
  for (const theme of THEMES) {
    await context.addCookies([{ name: "seedha_theme", value: theme, url: baseURL ?? "" }]);
    for (const width of WIDTHS) {
      const where = `${theme} ${width}px`;
      await page.setViewportSize({ width, height: 900 });

      await page.goto("/desk/device");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByText("Connected, checking every 2 seconds")).toBeVisible();
      await expect(page.getByTestId("desk-status")).toHaveAccessibleName("Front desk screen: ready");
      await expect(page.getByText(/ · Ready$/)).toBeVisible();
      await expect(page.getByText("Staff: check in or check out")).toBeVisible();
      if (width === 390)
        await expect(page.getByText("Turn your phone sideways for a bigger QR.")).toBeVisible();
      expect(await scrollsSideways(page), `${where} /desk/device scrolls sideways`).toBe(false);
      found.push(...(await axeViolations(page)).map((v) => `${where} /desk/device: ${v}`));

      await page.goto("/calendar");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.getByRole("button", { name: "Add events" }).click();
      const sheet = page.getByRole("dialog", { name: "Add events from your source." });
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("Seedha does not fetch or scrape websites.");
      await expect(sheet.getByLabel("Paste the event notice")).toBeVisible();
      await expect(sheet.getByLabel("Official source link")).toBeVisible();
      await expect(sheet.getByRole("button", { name: "Read events" })).toBeVisible();
      expect(await scrollsSideways(page), `${where} /calendar sheet scrolls sideways`).toBe(false);
      found.push(...(await axeViolations(page)).map((v) => `${where} /calendar sheet: ${v}`));
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);

      await page.goto("/proof");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // PROOF_RPC_URL is empty in e2e: the root stays on Seedha's server.
      await expect(page.getByRole("region", { name: "Local only" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Write tonight's proof" })).toBeVisible();
      await expect(page.getByText(/mainnet/i)).toHaveCount(0);
      expect(await scrollsSideways(page), `${where} /proof scrolls sideways`).toBe(false);
      found.push(...(await axeViolations(page)).map((v) => `${where} /proof: ${v}`));
    }
  }
  expect(found).toEqual([]);
});
