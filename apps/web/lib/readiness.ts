/**
 * Direct readiness: three parts from GET /overview, each its actual figure
 * against a goal the owner sets. No rupees. A part scores
 * min(100, round(actual / goal x 100)); the total is the rounded mean.
 * Shares are tenths of a percent, as the API sends them.
 */
import { count, pctTenths } from "./format.ts";

export type ReadinessGoals = { directTenths: number; freeTenths: number; codedBookings: number };

/** Suggested goals, shown as suggestions until the owner sets their own. */
export const SUGGESTED_GOALS: ReadinessGoals = { directTenths: 200, freeTenths: 300, codedBookings: 10 };

export type ReadinessInputs = {
  directTenths: number | null;
  freeTenths: number | null;
  codedBookings: number;
};

export type ReadinessPart = {
  key: "direct" | "free" | "coded";
  label: string;
  actual: string;
  goal: string;
  score: number;
  formula: string;
};

export type Readiness = { parts: ReadinessPart[]; total: number };

/** min(100, round(actual / goal x 100)); a goal of 0 or less counts as met. */
export function partScore(actual: number, goal: number): number {
  if (goal <= 0) return 100;
  return Math.min(100, Math.round((Math.max(0, actual) * 100) / goal));
}

function part(
  key: ReadinessPart["key"],
  label: string,
  actual: number,
  goal: number,
  show: (n: number) => string,
): ReadinessPart {
  const score = partScore(actual, goal);
  return {
    key,
    label,
    actual: show(actual),
    goal: show(goal),
    score,
    formula: `${show(actual)} of a ${show(goal)} goal = ${score} of 100`,
  };
}

/** The three parts and their mean. Missing shares count as 0. */
export function readiness(inputs: ReadinessInputs, goals: ReadinessGoals): Readiness {
  const parts = [
    part("direct", "Direct bookings", inputs.directTenths ?? 0, goals.directTenths, pctTenths),
    part("free", "Commission-free share", inputs.freeTenths ?? 0, goals.freeTenths, pctTenths),
    part("coded", "Coded direct bookings", inputs.codedBookings, goals.codedBookings, count),
  ];
  const total = Math.round(parts.reduce((sum, p) => sum + p.score, 0) / parts.length);
  return { parts, total };
}

/** Parse an owner-entered goal: whole percent for shares, whole count for bookings. */
export function parseGoal(text: string, kind: "percent" | "count"): number | null {
  const t = text.trim();
  if (kind === "percent") {
    if (!/^\d{1,3}(\.\d)?$/.test(t)) return null;
    const tenths = Math.round(Number(t) * 10);
    return tenths >= 1 && tenths <= 1000 ? tenths : null;
  }
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}
