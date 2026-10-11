import { expect, test } from "@playwright/test";
import type { Locator, Page, Response } from "@playwright/test";
import { signIn } from "./helpers";
import { getJson, inr } from "./polish-helpers";

/**
 * Wave 3 T2, the Pro page against the real API: the ten cards open one at a
 * time from the keyboard, the floor slider re-asks GET /pro/floor and the
 * table shows its numbers, the displacement calculator shows GET
 * /pro/displacement, and the rollup toggle is a pressed-button group whose
 * figures come from GET /pro/rollup. Read-only.
 */

const IDS = [
  "audit",
  "pulse",
  "rate-watch",
  "tonight",
  "discount-split",
  "floor",
  "displacement",
  "khata",
  "rollup",
  "proof",
] as const;

type FloorRow = {
  channel_key: string;
  channel_name: string;
  floor_rate: number;
  at_rate: { net_kept: number };
  worth_taking: boolean;
};
type Floor = { target: number; rate: number; rows: FloorRow[] };
type Displacement = {
  group_rooms: number;
  group_rate: number;
  nights: number;
  rooms_pushed_out: number;
  free_rooms: number;
  rooms_count: number;
  group_net: number;
  displaced_net: number;
  difference: number;
  average_net_per_room_night: number;
};
type RollupView = {
  name: string;
  city: string;
  lines: { list_amount: number; net_kept: number };
  paid_to_channels: number;
};
type Rollup = { selected: string; view: RollupView };

const trigger = (page: Page, id: string) => page.locator(`#pro-${id}-trigger`);
const view = (page: Page, id: string) => page.getByTestId(`pro-view-${id}`);

function isApi(path: RegExp) {
  return (r: Response) => path.test(new URL(r.url()).pathname + new URL(r.url()).search);
}

/** A GET /api/pro/displacement response for exactly these inputs. */
function displacementFor(rooms: number, ratePaise: number, nights: number) {
  return (r: Response) => {
    const url = new URL(r.url());
    const q = url.searchParams;
    return (
      url.pathname === "/api/pro/displacement" &&
      q.get("group_rooms") === String(rooms) &&
      q.get("group_rate") === String(ratePaise) &&
      q.get("nights") === String(nights)
    );
  };
}

async function openPro(page: Page): Promise<void> {
  await signIn(page);
  await page.goto("/pro");
  await expect(trigger(page, "audit")).toBeVisible();
}

/** The floor table against one GET /pro/floor answer. */
async function expectFloorTable(region: Locator, floor: Floor): Promise<void> {
  await expect(region.getByRole("table").locator("caption")).toHaveText(
    `At ${inr(floor.rate)} a night. Each floor keeps you at least ${inr(floor.target)} a night.`,
  );
  for (const row of floor.rows) {
    const cells = region.getByRole("row", { name: new RegExp(`^${row.channel_name}`) }).getByRole("cell");
    await expect(cells.nth(1)).toHaveText(inr(row.at_rate.net_kept));
    await expect(cells.nth(2)).toHaveText(inr(row.floor_rate));
    await expect(cells.nth(3)).toHaveText(row.worth_taking ? "Yes" : "No");
  }
}

test("keyboard: each card opens with Space, the last one closes, one at a time", async ({ page }) => {
  await openPro(page);
  let previous: string | null = null;
  for (const id of IDS) {
    const t = trigger(page, id);
    await t.focus();
    await page.keyboard.press(" ");
    await expect(t).toHaveAttribute("aria-expanded", "true");
    await expect(view(page, id)).toBeVisible();
    await expect(page.locator('[data-open="true"]')).toHaveCount(1);
    if (previous) {
      await expect(trigger(page, previous)).toHaveAttribute("aria-expanded", "false");
      await expect(view(page, previous)).toHaveCount(0);
    }
    previous = id;
  }
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-open="true"]')).toHaveCount(0);
  await expect(trigger(page, "proof")).toBeFocused();
});

test("floor slider: each move re-asks the API and the table shows its numbers", async ({ page }) => {
  await openPro(page);
  const first = page.waitForResponse(isApi(/^\/api\/pro\/floor\?rate=400000$/));
  await trigger(page, "floor").click();
  const region = view(page, "floor");
  const start = (await (await first).json()) as Floor;
  expect(start.rate).toBe(400000);
  await expectFloorTable(region, start);

  const slider = region.getByRole("slider", { name: /Room rate for one night/ });
  await expect(slider).toHaveAttribute("aria-valuetext", "₹4,000");
  const moved = page.waitForResponse(isApi(/^\/api\/pro\/floor\?rate=450000$/));
  await slider.focus();
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", "₹4,500");
  const next = (await (await moved).json()) as Floor;
  // A direct read of the API for the same rate agrees with what the page got.
  expect(await getJson<Floor>(page, "pro/floor?rate=450000")).toEqual(next);
  await expectFloorTable(region, next);
  const mmtBefore = start.rows.find((r) => r.channel_key === "mmt")?.at_rate.net_kept;
  const mmtAfter = next.rows.find((r) => r.channel_key === "mmt")?.at_rate.net_kept;
  expect(mmtAfter).toBeGreaterThan(mmtBefore ?? 0);

  // Home drops to the lowest rate, where some channel is not worth taking.
  const low = page.waitForResponse(isApi(/^\/api\/pro\/floor\?rate=100000$/));
  await page.keyboard.press("Home");
  const bottom = (await (await low).json()) as Floor;
  await expectFloorTable(region, bottom);
  expect(bottom.rows.some((r) => !r.worth_taking)).toBe(true);
  await expect(region.getByRole("cell", { name: "No", exact: true }).first()).toBeVisible();
});

test("displacement calculator answers from the API and flags bad input", async ({ page }) => {
  await openPro(page);
  const first = page.waitForResponse(displacementFor(10, 300000, 2));
  await trigger(page, "displacement").click();
  const region = view(page, "displacement");
  const base = (await (await first).json()) as Displacement;
  expect([base.group_rooms, base.group_rate, base.nights]).toEqual([10, 300000, 2]);
  expect(
    await getJson<Displacement>(page, "pro/displacement?group_rooms=10&group_rate=300000&nights=2"),
  ).toEqual(base);

  const expectResult = async (d: Displacement) => {
    const result = region.locator("dl");
    await expect(result.locator("dd").nth(0)).toHaveText(inr(d.group_net));
    await expect(result.locator("dd").nth(1)).toHaveText(inr(-d.displaced_net));
    await expect(result.locator("dd").nth(2)).toHaveText(inr(Math.abs(d.difference)));
    await expect(result).toContainText(
      d.difference >= 0 ? "The group leaves you more by" : "The group leaves you less by",
    );
    await expect(result).toContainText(`Rooms pushed out: ${d.rooms_pushed_out} a night`);
    expect(d.group_net).toBe(d.group_rooms * d.nights * d.group_rate);
    expect(d.difference).toBe(d.group_net - d.displaced_net);
  };
  await expectResult(base);

  // A bigger, cheaper group: the API is asked again and the screen follows.
  const again = page.waitForResponse(displacementFor(20, 150000, 2));
  await region.getByLabel("Group rooms").fill("20");
  await region.getByLabel("Group rate per room night, in rupees").fill("1500");
  const big = (await (await again).json()) as Displacement;
  expect(big.rooms_pushed_out).toBeGreaterThan(base.rooms_pushed_out);
  await expectResult(big);

  // More rooms than the hotel has: an inline error, the field marked invalid.
  const rooms = region.getByLabel("Group rooms");
  await rooms.fill(String(base.rooms_count + 1));
  await expect(rooms).toHaveAttribute("aria-invalid", "true");
  const describedBy = (await rooms.getAttribute("aria-describedby")) ?? "";
  await expect(region.locator(`[id="${describedBy}"]`)).toBeVisible();
  await rooms.fill("10");
  await expect(rooms).not.toHaveAttribute("aria-invalid", "true");
});

test("rollup toggle: aria-pressed follows the choice, figures come from the API", async ({ page }) => {
  await openPro(page);
  await trigger(page, "rollup").click();
  const region = view(page, "rollup");
  const group = region.getByRole("group", { name: "Property" });
  const buttons = { all: "Both", a: "This hotel", b: "Second hotel" } as const;

  for (const key of ["a", "b", "all"] as const) {
    const expected = await getJson<Rollup>(page, `pro/rollup?property=${key}`);
    await group.getByRole("button", { name: buttons[key], exact: true }).click();
    for (const [other, label] of Object.entries(buttons)) {
      await expect(group.getByRole("button", { name: label, exact: true })).toHaveAttribute(
        "aria-pressed",
        other === key ? "true" : "false",
      );
    }
    await expect(region).toContainText(`${expected.view.name}, ${expected.view.city}`);
    const stat = (label: string) => region.locator(`dl div:has(> dt:text-is("${label}")) > dd`);
    await expect(stat("Room revenue at list")).toHaveText(inr(expected.view.lines.list_amount));
    await expect(stat("Paid to channels")).toHaveText(inr(expected.view.paid_to_channels));
    await expect(stat("You kept")).toHaveText(inr(expected.view.lines.net_kept));
  }
  await region.getByRole("button", { name: "Close Two-Property Rollup" }).click();
  await expect(trigger(page, "rollup")).toBeFocused();
});
