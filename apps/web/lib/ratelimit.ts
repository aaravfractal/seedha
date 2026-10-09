/**
 * In-memory sliding-window rate limit, per key. Used for owner login so a
 * script cannot guess the passcode. One server process is enough for the
 * prototype; several processes need a shared store (docs/decisions.md D-071).
 */

export type Limit = { count: number; seconds: number };

export const LOGIN_LIMIT: Limit = { count: 10, seconds: 15 * 60 };

const MAX_KEYS = 10_000;

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly clock: () => number;

  constructor(clock: () => number = () => Date.now() / 1000) {
    this.clock = clock;
  }

  /** Record a hit. Returns 0 when allowed, else whole seconds until the next slot. */
  check(key: string, limit: Limit): number {
    const now = this.clock();
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - limit.seconds);
    if (recent.length >= limit.count) {
      this.hits.set(key, recent);
      return Math.ceil((recent[0] ?? now) + limit.seconds - now);
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > MAX_KEYS) this.prune(now, limit.seconds);
    return 0;
  }

  private prune(now: number, seconds: number): void {
    for (const [key, times] of this.hits) {
      if ((times.at(-1) ?? 0) <= now - seconds) this.hits.delete(key);
    }
  }
}

/**
 * The caller's address as seen by the nearest proxy: the last entry of
 * X-Forwarded-For (earlier entries are whatever the client claimed).
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || headers.get("x-real-ip")?.trim() || "unknown";
}
