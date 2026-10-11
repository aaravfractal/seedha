import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { axeViolations, signIn } from "./helpers";
import { ensureBillRequest, setTheme, threadId } from "./polish-helpers";

/**
 * Wave 3 T2: axe (WCAG 2.1 A/AA) on the polish screens in their open states,
 * at 1440 and 390, light and dark: the room sheet on /home, a thread with the
 * stay invoice panel on /inbox, and a calculator card on /pro. Motion is
 * reduced so axe reads final colours, not a fade in flight.
 *
 * The whole /inbox page is checked with a thread open (message log, invoice
 * row) and again with the stay invoice preview dialog open; the Floor and
 * Khata cards with their scrolling tables are checked at both widths
 * (review fixes F1 to F4 closed the gaps T2 reported).
 */

const SIZES = [1440, 390] as const;
const THEMES = ["light", "dark"] as const;

async function sweep(
  page: Page,
  run: (label: string) => Promise<void>,
  context: Parameters<typeof setTheme>[0],
  baseURL: string | undefined,
): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of THEMES) {
    await setTheme(context, baseURL, theme);
    for (const width of SIZES) {
      await page.setViewportSize({ width, height: 900 });
      await run(`${theme} ${width}px`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    }
  }
}

test("room sheet open on /home: no axe violations", async ({ page, context, baseURL }) => {
  await signIn(page);
  const found: string[] = [];
  await sweep(
    page,
    async (label) => {
      await page.goto("/home");
      const tile = page
        .getByTestId("room-grid")
        .locator('button:not([data-ch="empty"]):not([data-ch="walkin"])');
      await tile.first().click();
      await expect(page.getByTestId("room-sheet").getByTestId("room-money")).toBeVisible();
      for (const v of await axeViolations(page)) found.push(`${label} /home sheet: ${v}`);
    },
    context,
    baseURL,
  );
  expect(found).toEqual([]);
});

test("the stay invoice panel in a thread: no axe violations", async ({ page, context, baseURL }) => {
  await signIn(page);
  const farhan = await threadId(page, "Farhan Thapar");
  await ensureBillRequest(page, farhan);
  const found: string[] = [];
  await sweep(
    page,
    async (label) => {
      await page.goto(`/inbox?thread=${farhan}`);
      const convo = page.getByRole("region", { name: "Conversation with Farhan Thapar" });
      await expect(convo.getByRole("log", { name: "Messages with Farhan Thapar" })).toBeVisible();
      const slot = convo.getByTestId("invoice-slot");
      await expect(slot).toContainText(/Stay invoice ready to attach · [A-Z]+\/\d{4}\/\d{4}/);
      for (const v of await axeViolations(page)) found.push(`${label} /inbox thread: ${v}`);

      await slot.getByRole("button", { name: "Preview" }).click();
      const dialog = page.getByRole("dialog", { name: "Stay invoice preview" });
      const panel = dialog.getByRole("region", { name: /^Stay invoice / });
      await expect(panel.getByRole("link", { name: "Download PDF" })).toBeVisible();
      for (const v of await axeViolations(page)) found.push(`${label} /inbox invoice preview: ${v}`);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    },
    context,
    baseURL,
  );
  expect(found).toEqual([]);
});

test("calculator cards open on /pro: no axe violations", async ({ page, context, baseURL }) => {
  await signIn(page);
  const found: string[] = [];
  await sweep(
    page,
    async (label) => {
      await page.goto("/pro");
      for (const id of ["floor", "displacement", "khata"]) {
        await page.locator(`#pro-${id}-trigger`).click();
        const region = page.getByTestId(`pro-view-${id}`);
        await expect(region.locator(id === "displacement" ? "dl" : "table")).toBeVisible();
        for (const v of await axeViolations(page)) found.push(`${label} /pro ${id}: ${v}`);
      }
    },
    context,
    baseURL,
  );
  expect(found).toEqual([]);
});
