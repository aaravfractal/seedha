/**
 * Client copy of the API's draft edit rules (apps/api/app/services/messages.py
 * edit_problem and services/drafter.py MONEY_PATTERN). Both are checked
 * against the same cases in apps/api/tests/fixtures/draft_rules.json, so they
 * cannot drift apart unnoticed.
 */

export const STOP_LINE = "Reply STOP to opt out.";
const MAX_LENGTH = 600;
// ₹, rs/inr/rupee, percentages and any number of 3 or more digits (D6).
const MONEY = /(₹|\brs\.?\s*\d|\binr\b|\d\s*%|\brupees?\b|\d[\d,]*\d[\d,]*\d)/i;
// Any web address other than the perk link.
const OTHER_LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|in|net|org|io|co|me|ly|app)\b)/i;

/** Same rules the API applies before it saves an edit. */
export function editProblem(text: string, code: string, link: string): string | null {
  const t = text.trim();
  if (!t) return "The message cannot be empty.";
  if (t.length > MAX_LENGTH) return `Keep the message under ${MAX_LENGTH} characters.`;
  if (!t.includes(STOP_LINE)) return `Keep "${STOP_LINE}" in the message.`;
  if (!t.includes(link)) return `Keep the booking link ${link} in the message.`;
  if (!t.replaceAll(link, "").includes(code)) return `Keep the code ${code} in the message.`;
  if (MONEY.test(t.replaceAll(link, "").replaceAll(code, "")))
    return "Offer a perk, not a price. Remove amounts, percentages and long numbers.";
  if (OTHER_LINK.test(t.replaceAll(link, "")))
    return "Keep only the booking link. Other links are not allowed.";
  return null;
}
