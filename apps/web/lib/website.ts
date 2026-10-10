/**
 * Small pure helpers for the public website. Money is integer paise from
 * GET /public/sample; plan prices come from lib/plans.ts.
 */
import { PLANS } from "./plans.ts";

/** 1 -> "1st", 2 -> "2nd", 5 -> "5th", 11 -> "11th". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** The flip toast: where the biggest channel by bookings lands by money kept. */
export function flipToast(
  byBookings: string[],
  byMoney: string[],
  names: Record<string, string>,
): string | null {
  const top = byBookings[0];
  if (!top) return null;
  const to = byMoney.indexOf(top);
  if (to <= 0) return null;
  return `${names[top] ?? top} drops from 1st to ${ordinal(to + 1)}`;
}

/** Seedha Base for 12 months on monthly billing, in paise (the calculator's cost line). */
export function baseYearCostPaise(): number {
  const base = PLANS.find((p) => p.name === "Base");
  return (base?.monthly ?? 0) * 12 * 100;
}

export type Growth = {
  perMonth: number;
  perYear: number;
  cost: number;
  afterSeedha: number;
  /** Cumulative extra kept and cumulative Seedha cost at the end of months 1 to 12. */
  months: { month: number; kept: number; cost: number }[];
};

/** Growth calculator: `nights` room nights a month moved direct, each keeping `perNight` paise more. */
export function growth(nights: number, perNight: number, yearCost: number = baseYearCostPaise()): Growth {
  const perMonth = nights * perNight;
  const perYear = perMonth * 12;
  const monthlyCost = yearCost / 12;
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    kept: perMonth * (i + 1),
    cost: monthlyCost * (i + 1),
  }));
  return { perMonth, perYear, cost: yearCost, afterSeedha: perYear - yearCost, months };
}

export const COOKIE_CHOICE = "seedha_cookies";
export type CookieChoice = "all" | "necessary";

/** Read the stored cookie choice from a document.cookie string. */
export function readCookieChoice(cookie: string): CookieChoice | null {
  const match = cookie.match(/(?:^|;\s*)seedha_cookies=(all|necessary)(?:;|$)/);
  return match ? (match[1] as CookieChoice) : null;
}

/** Ease-out cubic, used by the count-up. */
export function easeOutCubic(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return 1 - (1 - c) ** 3;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-04-01", "2026-09-30" -> "Apr to Sep 2026" (years shown on both ends when they differ). */
export function periodLabel(start: string, end: string): string {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const from = MONTHS[(sm ?? 1) - 1] ?? "";
  const to = MONTHS[(em ?? 1) - 1] ?? "";
  return sy === ey ? `${from} to ${to} ${ey}` : `${from} ${sy} to ${to} ${ey}`;
}
