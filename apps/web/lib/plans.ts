/** Plan prices in whole rupees a month (early estimates, as in the prototype). */
export type Plan = {
  name: "Base" | "Pro" | "Max";
  monthly: number;
  features: string[];
  recommended?: boolean;
};

export const PLANS: Plan[] = [
  {
    name: "Base",
    monthly: 1499,
    features: [
      "Statement reading and the flip",
      "Repeat guests and Saturday move",
      "Front desk screen with slips",
      "Win-back, Seedha Link, savings ledger",
      "Six Hindi WhatsApp answers",
      "Simple one-page website",
    ],
  },
  {
    name: "Pro",
    monthly: 2499,
    recommended: true,
    features: [
      "Everything in Base",
      "Full website, packages and rate card",
      "Audit: money to claim back",
      "Pulse: event alerts",
      "Rate Watch",
      "Proof: tamper-proof consent",
    ],
  },
  {
    name: "Max",
    monthly: 3999,
    features: ["Everything in Pro", "Two properties, one login", "One WhatsApp for both"],
  },
];

export const SITE_SETUP_RUPEES = 4999;
/** One-time clean-up of six months of old statements. */
export const STATEMENT_CLEANUP_RUPEES = 2999;
export const YEARLY_MONTHS_PAID = 10;

/** Yearly billing: 2 months free. Returns whole rupees (per month shown rounded half-up). */
export function yearlyPrice(monthly: number): { perMonth: number; perYear: number } {
  const perYear = monthly * YEARLY_MONTHS_PAID;
  return { perMonth: Math.floor((perYear * 2 + 12) / 24), perYear };
}
