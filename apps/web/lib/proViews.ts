/**
 * Pure helpers for the Seedha Pro mini views. They build API paths, read
 * owner input and size bars. No money is computed here: every rupee figure a
 * view shows comes from the API (rule 1); the only arithmetic is turning a
 * whole-rupee input into paise for the request and bar widths for display.
 */

import type { RollupKey } from "./types-pro.ts";

export const PAISE_PER_RUPEE = 100;

/** The floor slider: room rate in whole rupees. */
export const RATE_MIN = 1000;
export const RATE_MAX = 12000;
export const RATE_STEP = 100;
export const RATE_START = 4000;

/** How long input settles before the API is asked again. */
export const DEBOUNCE_MS = 250;

/** Snap a slider value to the step and keep it in range. */
export function clampRate(rupees: number): number {
  if (!Number.isFinite(rupees)) return RATE_START;
  const snapped = Math.round(rupees / RATE_STEP) * RATE_STEP;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, snapped));
}

/** GET /pro/floor for a room rate in whole rupees. */
export function floorPath(rateRupees: number): string {
  return `pro/floor?rate=${clampRate(rateRupees) * PAISE_PER_RUPEE}`;
}

/**
 * A whole number typed by the owner, or null when it is empty, has anything
 * but digits, or falls outside [min, max].
 */
export function parseWhole(text: string, min: number, max: number): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,7}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= min && value <= max ? value : null;
}

export type GroupInput = { rooms: string; rate: string; nights: string };

export type GroupLimits = { maxRooms: number };

export const GROUP_RATE_MIN = 500;
export const GROUP_RATE_MAX = 100000;
export const GROUP_NIGHTS_MAX = 30;

/** Which group fields are not valid, by name, with the message to show. */
export function groupErrors(
  input: GroupInput,
  limits: GroupLimits,
): Partial<Record<keyof GroupInput, string>> {
  const errors: Partial<Record<keyof GroupInput, string>> = {};
  if (parseWhole(input.rooms, 1, limits.maxRooms) === null) {
    errors.rooms = `Enter 1 to ${limits.maxRooms} rooms.`;
  }
  if (parseWhole(input.rate, GROUP_RATE_MIN, GROUP_RATE_MAX) === null) {
    errors.rate = "Enter whole rupees from 500 to 1,00,000.";
  }
  if (parseWhole(input.nights, 1, GROUP_NIGHTS_MAX) === null) {
    errors.nights = `Enter 1 to ${GROUP_NIGHTS_MAX} nights.`;
  }
  return errors;
}

/** GET /pro/displacement for valid input, or null while any field is not valid. */
export function displacementPath(input: GroupInput, limits: GroupLimits): string | null {
  if (Object.keys(groupErrors(input, limits)).length > 0) return null;
  const rooms = Number(input.rooms.trim());
  const rate = Number(input.rate.trim()) * PAISE_PER_RUPEE;
  const nights = Number(input.nights.trim());
  return `pro/displacement?group_rooms=${rooms}&group_rate=${rate}&nights=${nights}`;
}

/** Bar widths in percent (display only) for two non-negative parts. */
export function splitWidths(first: number, second: number): [number, number] {
  const whole = Math.max(first, 0) + Math.max(second, 0);
  if (whole === 0) return [0, 0];
  const left = (Math.max(first, 0) / whole) * 100;
  return [left, 100 - left];
}

/** A commission rate in basis points as words: 2200 -> "22%", 1250 -> "12.5%". */
export function bpsLabel(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const rest = bps % 100;
  if (rest === 0) return `${whole}%`;
  return `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}%`;
}

/** GET /pro/rollup for one toggle position. */
export function rollupPath(key: RollupKey): string {
  return `pro/rollup?property=${key}`;
}
