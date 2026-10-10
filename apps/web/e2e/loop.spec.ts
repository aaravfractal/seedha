import { expect, test } from "@playwright/test";

/**
 * The full 8-step loop from the prototype, on the real API and the sample
 * hotel: upload -> read -> flip -> repeat guests -> Desk consent -> slip ->
 * approve win-back -> coded direct booking with the correct saving.
 */
test("the full 8-step loop", async ({ page, context }) => {
  await page.goto("/login");
  await page.fill("#passcode", process.env.E2E_PASSCODE ?? "");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText("0 of 8 steps done. Tap any step to run it.")).toBeVisible();

  // 1-2. Upload and read the six sample statements.
  await page.goto("/upload");
  await page.getByRole("button", { name: "Use sample statements" }).click();
  await expect(page.getByText("1,500 rows matched. 3 need a look.")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("MakeMyTrip #MM48213")).toBeVisible();

  // 3. The flip: MakeMyTrip drops from 1st to 5th by money kept.
  await page.getByRole("link", { name: "See my real money" }).click();
  await expect(page.getByText("₹10,39,108")).toBeVisible();
  await expect(page.locator(".row .nm").first()).toHaveText("MakeMyTrip");
  await page.getByRole("button", { name: "By money kept" }).click();
  await expect(page.locator(".toast")).toHaveText("MakeMyTrip drops from 1st to 5th");
  await expect(page.locator(".row .nm").nth(4)).toHaveText("MakeMyTrip");
  await expect(page.locator(".row").nth(4)).toContainText("₹2,737");

  // 4. Repeat guests.
  await page.goto("/repeat");
  await expect(page.getByText("₹41,800")).toBeVisible();
  await expect(page.locator(".stat b").first()).toHaveText("12");

  // 5. Check-in consent for Rahul at the Desk.
  await page.goto("/desk");
  await expect(page.getByText("online, polling every 2 seconds")).toBeVisible();
  await page.selectOption("#guestSel", "207");
  await page.getByRole("button", { name: "Show QR" }).click();
  await expect(page.getByRole("img", { name: "Consent QR code" })).toBeVisible();
  const phone = page.frameLocator('iframe[title="Guest phone: consent page"]');
  await expect(phone.getByText("Welcome, Rahul ji.")).toBeVisible();
  const yes = phone.getByRole("button", { name: "Yes, send me offers" });
  await expect(yes).toBeDisabled();
  await phone.locator("#whatsapp").fill("98765 43210");
  await expect(yes).toBeDisabled();
  await phone.getByRole("checkbox").check();
  await yes.click();
  await expect(phone.getByText("You are in.")).toBeVisible();
  await expect(page.getByText("Thank you, Rahul ji")).toBeVisible();

  // 6. Checkout slip with the perk code.
  await page.getByRole("button", { name: "Check out and print" }).click();
  await expect(page.getByLabel("Printed slip")).toContainText("DEODAR-RS26");
  await expect(page.getByLabel("Printed slip")).toContainText("Hotel kept");

  // 7. Owner approves the win-back message.
  await page.goto("/approvals");
  const draft = page.locator(".bub").first();
  await expect(draft).toContainText("Namaste Rahul ji");
  await expect(draft).toContainText("Reply STOP to opt out.");
  await page.getByRole("button", { name: "Approve and send" }).click();
  await expect(page.locator(".bub.me").first()).toContainText("Sent");

  // 8. The guest books directly with the code; the saving is counted.
  const guest = await context.newPage();
  await guest.goto("/link/DEODAR-RS26");
  await expect(guest.locator("nav.seg")).toHaveCount(0);
  await expect(guest.getByText("Free breakfast on your next direct stay. Your code is valid.")).toBeVisible();
  // The guest's name stays hidden until the code is accepted with a booking.
  await expect(guest.getByText("Rahul")).toHaveCount(0);
  await guest.getByRole("button", { name: "Pay ₹8,600 with UPI" }).click();
  await guest
    .getByRole("dialog", { name: "Pay with UPI" })
    .getByRole("button", { name: "Pay ₹8,600" })
    .click();
  await expect(guest.getByText("Booked. Thank you, Rahul ji.")).toBeVisible();
  await expect(guest.getByText(/Breakfast is on us/)).toBeVisible();

  await page.goto("/savings");
  // Rahul's row: ₹2,233 avoided (₹1,892 commission + ₹341 GST), ₹2,199 net (ruling 5).
  // The ledger also holds the sample hotel's four earlier coded bookings (D-080).
  const rahul = page.locator(".item").filter({ hasText: "Code DEODAR-RS26 · ₹8,600 booked direct" });
  await expect(rahul).toHaveCount(1);
  await expect(rahul).toContainText("₹1,892 commission + ₹341 GST");
  await expect(rahul.locator("b.num")).toHaveText("+₹2,199");

  await page.goto("/home");
  await expect(page.getByText("All 8 steps done. The full loop works.")).toBeVisible();
});

test("a perk code cannot be redeemed twice", async ({ page }) => {
  await page.goto("/link/DEODAR-RS26");
  await expect(page.getByText("This code was already used.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay .* with UPI/ })).toBeDisabled();
});
