import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Consent proof, live features (B2). The e2e servers run with PROOF_RPC_URL
 * empty, so the real API is local only; the Polygon Amoy testnet states are
 * checked against a mocked GET /api/proof.
 */

type DeskGuest = { room: number | null; consent: boolean; checked_out: boolean };

/** One guest says yes at the Desk so tonight has something to prove. */
async function oneConsent(page: Page): Promise<void> {
  const state = (await (await page.request.get("/api/desk/state")).json()) as { guests: DeskGuest[] };
  // Rooms 104 and 207 belong to the owner and loop specs.
  const guest = state.guests.find(
    (g) => g.room !== null && !g.consent && !g.checked_out && g.room !== 104 && g.room !== 207,
  );
  expect(guest, "a guest without consent tonight").toBeTruthy();
  const checkin = await page.request.post("/api/desk/checkin", { data: { room: guest?.room } });
  expect(checkin.ok()).toBe(true);
  const { url } = (await checkin.json()) as { url: string };
  await page.goto(new URL(url).pathname);
  await page.locator("#whatsapp").fill("98111 33355");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Yes, send me offers" }).click();
  await expect(page.getByText("You are in.")).toBeVisible();
}

test("local only: writing tonight's proof stores it on Seedha", async ({ page }) => {
  await signIn(page);
  await oneConsent(page);
  await page.goto("/proof");

  const card = page.getByRole("region", { name: "Local only" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("kept on Seedha's server");
  await expect(page.getByText(/mainnet/i)).toHaveCount(0);

  const write = page.getByRole("button", { name: "Write tonight's proof" });
  await expect(write).toBeEnabled();
  await write.click();
  await expect(page.getByRole("status").filter({ hasText: "Tonight's proof written." })).toBeVisible();
  await expect(page.getByText("Stored on Seedha").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /View on Amoy explorer/ })).toHaveCount(0);
  // Everything is sealed now, so there is nothing new to write.
  await expect(page.getByRole("button", { name: "Write tonight's proof" })).toBeDisabled();
});

test("Polygon Amoy testnet: a verified bundle shows its block and explorer link", async ({ page }) => {
  await signIn(page);
  const hash = `0x${"ab".repeat(32)}`;
  const address = "0x1234567890abcdef1234567890abcdef12345678";
  await page.route("**/api/proof", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const real = await route.fetch();
    const body = (await real.json()) as Record<string, unknown>;
    const bundle = {
      id: 9001,
      created_at: "2026-10-10T15:30:00Z",
      item_count: 2,
      merkle_root: "c".repeat(64),
      chain_status: "verified",
      chain_tx: hash,
      chain_block: 4242424,
      network_label: "Polygon Amoy testnet",
      explorer_url: `https://amoy.polygonscan.com/tx/${hash}`,
    };
    await route.fulfill({
      response: real,
      json: {
        ...body,
        chain_live: true,
        bundles: [bundle],
        chain: {
          mode: "amoy",
          network_label: "Polygon Amoy testnet",
          address,
          balance_pol: "0.004",
          low_balance: true,
          reason: null,
          address_url: `https://amoy.polygonscan.com/address/${address}`,
        },
      },
    });
  });
  await page.goto("/proof");

  await expect(page.getByText("Verified on Polygon Amoy testnet, block 4242424")).toBeVisible();
  const tx = page.getByRole("link", { name: /View on Amoy explorer \(amoy\.polygonscan\.com\)/ });
  await expect(tx).toHaveAttribute("href", `https://amoy.polygonscan.com/tx/${hash}`);
  await expect(tx).toHaveAttribute("target", "_blank");
  await expect(tx).toHaveAttribute("rel", "noopener noreferrer");

  const card = page.getByRole("region", { name: "Polygon Amoy testnet" });
  await expect(card).toContainText("0x1234…5678");
  await expect(card).toContainText("0.004 POL");
  await expect(card).toContainText("Testnet tokens have no value.");
  await expect(page.getByText(/mainnet/i)).toHaveCount(0);

  // Settings shows the quiet top-up hint for the same low wallet.
  await page.goto("/settings");
  const notice = page.getByRole("status").filter({ hasText: "Proof wallet is low on test POL" });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("link", { name: "Top up from the Polygon faucet" })).toHaveAttribute(
    "href",
    "https://faucet.polygon.technology",
  );
});
