import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * The sample hotel's guest inbox (POLISH_BUILD B): the eight seeded threads,
 * the profile column, a suggested draft the owner edits and sends (simulated),
 * "Simulate incoming message", the /inbox?thread=<id> deep link and the
 * invoice slot under a bill request's draft. Nothing is sent automatically.
 */

type ThreadRow = { consent_id: number; guest_name: string; unread: number };
type Bubble = { direction: "in" | "out"; body: string };

async function threadId(page: Page, name: string): Promise<number> {
  const body = (await (await page.request.get("/api/inbox/threads")).json()) as { threads: ThreadRow[] };
  const row = body.threads.find((t) => t.guest_name === name);
  expect(row, `${name} has a thread`).toBeTruthy();
  return row?.consent_id ?? 0;
}

async function bubbles(page: Page, id: number): Promise<Bubble[]> {
  const res = await page.request.get(`/api/inbox/threads/${id}/messages`);
  return ((await res.json()) as { messages: Bubble[] }).messages;
}

test("seeded threads, profile, draft and send, invoice slot", async ({ page }) => {
  await signIn(page);
  await page.goto("/inbox");
  const guests = page.getByRole("region", { name: "Guests" });
  for (const name of ["Farhan Thapar", "Kavya Zutshi", "Pooja Ahuja", "Nikhil Chauhan", "Tarun Zutshi"]) {
    await expect(guests.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(guests.getByText("unread").first()).toBeAttached();

  // A bill request: the suggested reply is in the box and the invoice slot shows.
  await guests.getByRole("button", { name: /Farhan Thapar/ }).click();
  await expect(page).toHaveURL(/\/inbox\?thread=\d+$/);
  const convo = page.getByRole("region", { name: "Conversation with Farhan Thapar" });
  await expect(convo.getByRole("log")).toContainText("invoice for my stay");
  const box = convo.getByRole("textbox", { name: /Message to/ });
  await expect(box).toHaveValue(/stay invoice/);
  const slot = convo.getByTestId("invoice-slot");
  await expect(slot).toBeVisible();
  await expect(slot).toContainText("Stay invoice ready to attach");
  // The invoice preview: numbered by code, PDF download, attach to the reply.
  const invoice = slot.getByRole("region", { name: /Stay invoice [A-Z]+\/\d{4}\/\d{4}/ });
  await expect(invoice).toBeVisible();
  const download = invoice.getByRole("link", { name: /Download PDF/ });
  const href = (await download.getAttribute("href")) ?? "";
  expect(href).toMatch(/^\/api\/inbox\/threads\/\d+\/invoice\.pdf$/);
  const pdf = await page.request.get(href);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await invoice.getByRole("button", { name: "Attach to reply" }).click();
  await expect(invoice.getByRole("button", { name: "Attached" })).toBeDisabled();
  await expect(slot.getByRole("status")).toContainText("Attached.");
  await expect(convo.getByText("Suggested reply in the box. Edit it, then send.")).toBeVisible();

  // Profile column: consent, stays, last invoice, notes and what Seedha remembers.
  const profile = page.getByRole("complementary", { name: "About Farhan Thapar" });
  await expect(profile).toContainText("Said yes at the Desk");
  await expect(profile).toContainText("Stays on record");
  await expect(profile).toContainText("Last invoice");
  await expect(profile.getByRole("heading", { name: "What Seedha remembers" })).toBeVisible();
  await expect(profile).toContainText("Prefers a mountain-view room");
  await expect(profile.getByRole("heading", { name: "Notes" })).toBeVisible();

  // The draft is editable; nothing went out until Send, and the send is simulated.
  const id = await threadId(page, "Farhan Thapar");
  const before = await bubbles(page, id);
  expect(before.at(-1)?.direction).toBe("in");
  await box.fill("Namaste Farhan ji, sharing your stay invoice here. Thank you for staying with us.");
  await convo.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Sent (simulated, no WhatsApp keys)")).toBeVisible();
  await expect(convo.getByRole("log")).toContainText("sharing your stay invoice here");
  const after = await bubbles(page, id);
  expect(after).toHaveLength(before.length + 1);
  expect(after.at(-1)?.body).toContain("Reply STOP to opt out.");
  await expect(slot).toHaveCount(0);
});

test("simulate incoming message and the deep link", async ({ page }) => {
  await signIn(page);
  await page.goto("/inbox");
  await expect(page.getByRole("region", { name: "Guests" }).getByRole("listitem").first()).toBeVisible();

  // Overflow menu: one realistic guest text lands on a seeded thread.
  await page.getByRole("button", { name: "More inbox actions" }).click();
  const simulated = page.waitForResponse(
    (r) => r.url().endsWith("/api/inbox/simulate") && r.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Simulate incoming message" }).click();
  const res = await simulated;
  expect(res.ok()).toBe(true);
  const got = (await res.json()) as { consent_id: number; guest_name: string };
  await expect(page.getByText(`New message from ${got.guest_name}`)).toBeVisible();
  const convo = page.getByRole("region", { name: `Conversation with ${got.guest_name}` });
  const last = (await bubbles(page, got.consent_id)).at(-1);
  expect(last?.direction).toBe("in");
  expect(last?.body.trim().toUpperCase()).not.toBe("STOP");
  await expect(convo.getByRole("log")).toContainText(last?.body ?? "");
  // The new message gets a suggestion in the box; the owner still decides.
  await expect(convo.getByRole("textbox", { name: /Message to/ })).not.toHaveValue("");

  // Deep link: /inbox?thread=<id> opens that conversation directly.
  const kavya = await threadId(page, "Kavya Zutshi");
  await page.goto(`/inbox?thread=${kavya}`);
  const opened = page.getByRole("region", { name: "Conversation with Kavya Zutshi" });
  await expect(opened).toBeVisible();
  await expect(opened.getByRole("log")).toContainText("Diwali");
  await expect(opened.getByTestId("invoice-slot")).toHaveCount(0);
});

test("Settings: simulate incoming message links to the thread", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Notifications" }).click();
  await page.getByRole("button", { name: "Simulate" }).click();
  const open = page.getByRole("link", { name: "Open the conversation" });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page).toHaveURL(/\/inbox\?thread=\d+$/);
  await expect(page.getByRole("region", { name: /^Conversation with / })).toBeVisible();
});
