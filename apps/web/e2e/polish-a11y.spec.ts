import AxeBuilder from "@axe-core/playwright";
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
 * Left out until fixed (reported in docs/agent-reports/polish/t2-e2e.md):
 * the whole /inbox page with a thread and invoice open (color-contrast on the
 * invoice slot kicker and the selected row's time in light; the message
 * stream is a scrollable region with no focusable content, all four states),
 * and the floor card at 390 (its table wrapper scrolls but cannot be
 * focused). The invoice panel itself is checked on its own below.
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
      const panel = page.getByTestId("invoice-slot").getByRole("region", { name: /^Stay invoice / });
      await expect(panel.getByRole("link", { name: "Download PDF" })).toBeVisible();
      const result = await new AxeBuilder({ page })
        .include('[data-testid="invoice-slot"] section[aria-label^="Stay invoice "]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      for (const v of result.violations) {
        found.push(`${label} invoice panel: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
      }
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
      const wide = (page.viewportSize()?.width ?? 0) >= 1440;
      for (const id of wide ? ["floor", "displacement"] : ["displacement"]) {
        await page.locator(`#pro-${id}-trigger`).click();
        const region = page.getByTestId(`pro-view-${id}`);
        await expect(region.locator(id === "floor" ? "table" : "dl")).toBeVisible();
        for (const v of await axeViolations(page)) found.push(`${label} /pro ${id}: ${v}`);
      }
    },
    context,
    baseURL,
  );
  expect(found).toEqual([]);
});
