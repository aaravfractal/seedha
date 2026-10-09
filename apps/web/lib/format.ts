/**
 * Display formatting. Money arrives from the API as integer paise and is only
 * turned into rupee text here, at the edge (CLAUDE.md section 7).
 */

const MINUS = "−";
const RUPEE = "₹";

/** Indian digit grouping for a non-negative whole number: 1039108 -> 10,39,108. */
function groupIndian(whole: bigint): string {
  const digits = whole.toString();
  if (digits.length <= 3) return digits;
  const tail = digits.slice(-3);
  let head = digits.slice(0, -3);
  const groups: string[] = [];
  while (head.length > 2) {
    groups.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  return [head, ...groups, tail].join(",");
}

/** Paise to whole rupees, half-up on the magnitude (same rule as the API). */
function paiseToRupees(paise: number): bigint {
  const magnitude = BigInt(Math.abs(Math.trunc(paise)));
  return (magnitude + 50n) / 100n;
}

/** Format integer paise as "₹10,39,108" or "−₹802". */
export function inr(paise: number): string {
  const sign = paise < 0 ? MINUS : "";
  return `${sign}${RUPEE}${groupIndian(paiseToRupees(paise))}`;
}

/** Format a share given in tenths of a percent: 107 -> "10.7%". */
export function pctTenths(tenths: number): string {
  const whole = Math.trunc(tenths / 10);
  const fraction = Math.abs(tenths % 10);
  return `${whole}.${fraction}%`;
}

/** Group a plain count: 1500 -> "1,500". */
export function count(n: number): string {
  return groupIndian(BigInt(Math.trunc(n)));
}
