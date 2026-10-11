/**
 * Pure helpers for the guest inbox screen (components/inbox). Kept free of
 * React so node --test can check them.
 */

/** Only the fields these helpers read (structural, so any ThreadDetail fits). */
type Bubble = { key: string; direction: "in" | "out" };
type DetailLike = { can_reply: boolean; messages: Bubble[] };
type DraftLike = { attach: { kind: string; consent_id: number } | null };

/** The thread id from a deep link such as /inbox?thread=12, or null. */
export function threadFromQuery(search: string): number | null {
  const raw = new URLSearchParams(search).get("thread");
  if (raw === null || !/^\d{1,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

/**
 * The guest's newest message key when it still waits for an answer (the
 * last bubble is theirs and the 24-hour window is open), else null. The
 * screen asks for one suggested draft per such message; it never sends.
 */
export function awaitingReply(detail: DetailLike): string | null {
  if (!detail.can_reply) return null;
  const last = detail.messages.at(-1);
  return last && last.direction === "in" ? last.key : null;
}

/** True when a draft asks the owner to attach the guest's stay invoice. */
export function wantsInvoice(draft: DraftLike | null): boolean {
  return draft?.attach?.kind === "stay_invoice";
}

/** The toast after the owner taps Send (the only place "simulated" shows). */
export function sentNote(simulated: boolean): string {
  return simulated ? "Sent (simulated, no WhatsApp keys)" : "Sent on WhatsApp";
}
