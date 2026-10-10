import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Owner flows the loop test does not cover (code quality review Q30). */

async function withStatements(page: Page): Promise<void> {
  const pipeline = (await (await page.request.get("/api/pipeline")).json()) as {
    steps: { key: string; done: boolean }[];
  };
  if (pipeline.steps.find((s) => s.key === "up")?.done) return;
  await page.goto("/upload");
  await page.getByRole("button", { name: "Use sample statements" }).click();
  await expect(page.getByText("1,500 rows matched. 3 need a look.")).toBeVisible({ timeout: 60_000 });
}

test("Saturday move: accept, then undo", async ({ page }) => {
  await signIn(page);
  await withStatements(page);
  await page.goto("/scenario");
  await expect(page.getByText(/Hold 6 Saturday rooms off Agoda/)).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Accepted. 6 Saturday rooms are held for direct guests.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Accept" })).toBeEnabled();
  await expect(page.getByText(/Accepted\./)).toHaveCount(0);
});

test("Approvals: an edit with a price is refused, a perk edit is saved, nothing is sent", async ({
  page,
}) => {
  await signIn(page);
  // Neha says yes at the Desk and checks out: a fresh draft appears.
  await page.goto("/desk");
  await page.selectOption("#guestSel", "104");
  await page.getByRole("button", { name: /Show QR/ }).click();
  const phone = page.frameLocator('iframe[title="Guest phone: consent page"]');
  await phone.locator("#whatsapp").fill("98111 22244");
  await phone.getByRole("checkbox").check();
  await phone.getByRole("button", { name: "Yes, send me offers" }).click();
  await expect(phone.getByText("You are in.")).toBeVisible();
  await page.getByRole("button", { name: "Check out and print" }).click();
  await expect(page.getByLabel("Printed slip")).toContainText("DEODAR-NG26");

  await page.goto("/approvals");
  const card = page.getByRole("article", { name: "Draft for Neha Gupta" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Edit" }).click();
  const box = card.locator("textarea");
  const original = await box.inputValue();
  await box.fill(`Save ₹500 on your next stay. ${original}`);
  await card.getByRole("button", { name: "Save draft" }).click();
  await expect(card.getByRole("alert")).toContainText("Offer a perk, not a price.");

  await box.fill(`Namaste Neha ji, the mountains miss you. ${original}`);
  await card.getByRole("button", { name: "Save draft" }).click();
  await expect(card.getByText(/the mountains miss you/)).toBeVisible();
  // Editing never sends (rule 7): the draft still waits for approval.
  await expect(card.getByRole("button", { name: "Approve and send" })).toBeVisible();

  // The consent proof dialog opens from the card and closes with Escape.
  await card.getByRole("button", { name: /Open consent proof/ }).click();
  const dialog = page.getByRole("dialog", { name: "Consent proof" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
