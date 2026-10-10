/** Client copy of the API's draft edit rules (apps/api/app/services/messages.py). */

export const STOP_LINE = "Reply STOP to opt out.";
const MAX_LENGTH = 600;
const MONEY = /(₹|\brs\.?\s*\d|\binr\b|\d\s*%|\brupees?\b)/i;

/** Same rules the API applies before it saves an edit. */
export function editProblem(text: string, code: string, link: string): string | null {
  const t = text.trim();
  if (!t) return "The message cannot be empty.";
  if (t.length > MAX_LENGTH) return `Keep the message under ${MAX_LENGTH} characters.`;
  if (!t.includes(STOP_LINE)) return `Keep "${STOP_LINE}" in the message.`;
  if (!t.includes(link)) return `Keep the booking link ${link} in the message.`;
  if (!t.replaceAll(link, "").includes(code)) return `Keep the code ${code} in the message.`;
  if (MONEY.test(t.replaceAll(link, "").replaceAll(code, "")))
    return "Offer a perk, not a price. Remove amounts and percentages.";
  return null;
}
