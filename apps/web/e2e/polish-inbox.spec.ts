import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signIn } from "./helpers";
import { bubbles, ensureBillRequest, getJson, guestWrites, inr, threadId, threads } from "./polish-helpers";
import type { ThreadRow } from "./polish-helpers";

/**
 * Wave 3 T2, the guest inbox against the real API (the CLI seed has eight
 * consented sample threads): list states, deep link, "Simulate incoming
 * message" adds exactly one guest text, a draft only fills the box, Send is
 * simulated, and the stay invoice panel, PDF and Attach. Each test leaves
 * every thread it touched ending on a guest text, as the seed does.
 */

type Invoice = {
  number: string;
  filename: string;
  guest_name: string;
  taxable: number;
  cgst: number;
  sgst: number;
  total_paid: number;
  payment_method: string;
};

const guests = (page: Page) => page.getByRole("region", { name: "Guests" });
const rowFor = (page: Page, name: string) => guests(page).getByRole("button", { name: new RegExp(name) });

async function counts(page: Page, list: ThreadRow[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (const t of list) out.set(t.consent_id, (await bubbles(page, t.consent_id)).length);
  return out;
}

test("the list shows unread, read and replied threads as the API has them", async ({ page }) => {
  await signIn(page);
  const list = await threads(page);
  expect(list.length).toBeGreaterThanOrEqual(8);
  await page.goto("/inbox");
  await expect(guests(page).getByRole("listitem")).toHaveCount(list.length);

  for (const t of list) {
    const row = rowFor(page, t.guest_name);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("aria-current", "false");
    if (t.unread > 0) await expect(row).toContainText(`${t.unread} unread`);
    else await expect(row).not.toContainText("unread");
    if (t.last?.direction === "out" && t.last.sent_by !== "away") await expect(row).toContainText("You: ");
    else await expect(row).not.toContainText("You: ");
  }
  // The seed always has replied threads; simulated texts only add unread ones.
  expect(list.some((t) => t.last?.direction === "out")).toBe(true);
  const unread = await getJson<{ counts: { unread: number } }>(page, "inbox/threads");
  await expect(
    page.getByRole("group", { name: "Filter guests" }).getByRole("button", { name: /^Unread/ }),
  ).toHaveText(new RegExp(`Unread\\s*${unread.counts.unread}$`));

  // Opening an unread thread marks it read: the badge goes, no "You:" preview.
  let target = list.find((t) => t.unread > 0);
  if (!target) {
    const id = list[0]?.consent_id ?? 0;
    await guestWrites(page, id, "Is breakfast served before seven? We leave early.");
    await page.reload();
    target = (await threads(page)).find((t) => t.consent_id === id);
  }
  if (!target) throw new Error("no thread to open");
  const row = rowFor(page, target.guest_name);
  await expect(row).toContainText("unread");
  await row.click();
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(page).toHaveURL(new RegExp(`/inbox\\?thread=${target.consent_id}$`));
  await expect(row).not.toContainText("unread");
  await expect(row).not.toContainText("You: ");
  const after = (await threads(page)).find((t) => t.consent_id === target.consent_id);
  expect(after?.unread).toBe(0);
});

test("simulate adds exactly one guest text; the draft is never sent until Send", async ({ page }) => {
  await signIn(page);
  const list = await threads(page);
  const before = await counts(page, list);

  // Deep link straight into one thread.
  const esha = await threadId(page, "Esha Negi");
  await page.goto(`/inbox?thread=${esha}`);
  await expect(page.getByRole("region", { name: "Conversation with Esha Negi" })).toBeVisible();
  await expect(rowFor(page, "Esha Negi")).toHaveAttribute("aria-current", "true");
  await page.waitForLoadState("networkidle");
  const drafts: { url: string; text: string }[] = [];
  page.on("response", (r) => {
    if (/\/api\/inbox\/threads\/\d+\/draft$/.test(r.url())) {
      void r
        .json()
        .then((b: { text: string }) => drafts.push({ url: r.url(), text: b.text }))
        .catch(() => undefined);
    }
  });

  await page.getByRole("button", { name: "More inbox actions" }).click();
  const simulated = page.waitForResponse(
    (r) => r.url().endsWith("/api/inbox/simulate") && r.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Simulate incoming message" }).click();
  const got = (await (await simulated).json()) as { consent_id: number; guest_name: string };
  await expect(page).toHaveURL(new RegExp(`/inbox\\?thread=${got.consent_id}$`));

  // Exactly one new message, on that thread only, and it is the guest's.
  const now = await bubbles(page, got.consent_id);
  expect(now).toHaveLength((before.get(got.consent_id) ?? 0) + 1);
  const incoming = now.at(-1);
  expect(incoming?.direction).toBe("in");
  for (const t of list) {
    if (t.consent_id !== got.consent_id) {
      expect((await bubbles(page, t.consent_id)).length, t.guest_name).toBe(before.get(t.consent_id));
    }
  }
  const convo = page.getByRole("region", { name: `Conversation with ${got.guest_name}` });
  await expect(convo.getByRole("log")).toContainText(incoming?.body ?? "");

  // The suggestion fills the box; nothing goes out on its own.
  const draftUrl = `/api/inbox/threads/${got.consent_id}/draft`;
  await expect.poll(() => drafts.some((d) => d.url.endsWith(draftUrl))).toBe(true);
  const draft = drafts.find((d) => d.url.endsWith(draftUrl)) ?? { text: "" };
  const box = convo.getByRole("textbox", { name: /Message to/ });
  await expect(box).not.toHaveValue("");
  await page.waitForTimeout(1_000);
  const held = await bubbles(page, got.consent_id);
  expect(held).toHaveLength(now.length);
  expect(held.at(-1)?.direction).toBe("in");
  expect(held.some((m) => m.direction === "out" && m.body === draft.text)).toBe(false);

  // Send: the owner's own text goes out (simulated) with the STOP line.
  const reply = "Thank you for writing. We will check and reply shortly.";
  await box.fill(reply);
  await convo.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Sent (simulated, no WhatsApp keys)")).toBeVisible();
  const sent = await bubbles(page, got.consent_id);
  expect(sent).toHaveLength(now.length + 1);
  expect(sent.at(-1)?.direction).toBe("out");
  expect(sent.at(-1)?.body).toContain(reply);
  expect(sent.at(-1)?.body).toContain("Reply STOP to opt out.");
  await expect(convo.getByRole("log")).toContainText(reply);

  // Clean up: the thread ends on a guest text again (the seed's bill request
  // stays the last text if this was Farhan's thread).
  const original = list.find((t) => t.consent_id === got.consent_id)?.last;
  await guestWrites(
    page,
    got.consent_id,
    original?.direction === "in" ? original.body : (incoming?.body ?? ""),
  );
});

test("invoice draft: panel numbers from the API, the PDF downloads, Attach sends nothing", async ({
  page,
}) => {
  await signIn(page);
  const farhan = await threadId(page, "Farhan Thapar");
  await ensureBillRequest(page, farhan);
  const before = await bubbles(page, farhan);
  const inv = await getJson<Invoice>(page, `inbox/threads/${farhan}/invoice`);

  const drafted = page.waitForResponse((r) => r.url().endsWith(`/api/inbox/threads/${farhan}/draft`));
  await page.goto(`/inbox?thread=${farhan}`);
  const draft = (await (await drafted).json()) as {
    text: string;
    attach: { kind: string; consent_id: number };
  };
  expect(draft.attach).toEqual({ kind: "stay_invoice", consent_id: farhan });
  // The AI text never names the invoice number or an amount (D6).
  expect(draft.text).not.toContain(inv.number);
  expect(draft.text).not.toMatch(/₹|Rs\.? ?\d/);

  const convo = page.getByRole("region", { name: "Conversation with Farhan Thapar" });
  await expect(convo.getByRole("textbox", { name: /Message to/ })).toHaveValue(draft.text);
  // The slot is one compact row; the full panel opens in a preview dialog.
  const slot = convo.getByTestId("invoice-slot");
  await expect(slot).toContainText(`Stay invoice ready to attach · ${inv.number}`);
  const preview = slot.getByRole("button", { name: "Preview" });
  await preview.click();
  const dialog = page.getByRole("dialog", { name: "Stay invoice preview" });
  await expect(dialog).toBeVisible();
  const panel = dialog.getByRole("region", { name: `Stay invoice ${inv.number}` });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(inv.guest_name);
  await expect(panel).toContainText(inv.payment_method);
  const amount = (label: string | RegExp) => panel.getByRole("row", { name: label }).getByRole("cell");
  await expect(amount("Taxable value")).toHaveText(inr(inv.taxable));
  await expect(amount(/^CGST at/)).toHaveText(inr(inv.cgst));
  await expect(amount(/^SGST at/)).toHaveText(inr(inv.sgst));
  await expect(amount("Total paid")).toHaveText(inr(inv.total_paid));
  expect(inv.taxable + inv.cgst + inv.sgst).toBe(inv.total_paid);

  // A real download: the file is a PDF under the API's file name.
  const link = panel.getByRole("link", { name: "Download PDF" });
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toBe(inv.filename);
  const path = await download.path();
  expect(readFileSync(path).subarray(0, 4).toString()).toBe("%PDF");
  const pdf = await page.request.get((await link.getAttribute("href")) ?? "");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Attach marks the reply; nothing is sent until the owner presses Send.
  await panel.getByRole("button", { name: "Attach to reply" }).click();
  const attached = panel.getByRole("button", { name: "Attached" });
  await expect(attached).toBeDisabled();
  await expect(attached).toHaveAttribute("aria-pressed", "true");
  // The row shares the same state; Escape closes the dialog and focus returns to Preview.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(preview).toBeFocused();
  await expect(slot.getByRole("button", { name: "Attached" })).toBeDisabled();
  await expect(slot.getByRole("button", { name: "Attached" })).toHaveAttribute("aria-pressed", "true");
  await expect(slot.getByRole("status")).toContainText("Attached.");
  await page.waitForTimeout(500);
  expect(await bubbles(page, farhan)).toHaveLength(before.length);
});
