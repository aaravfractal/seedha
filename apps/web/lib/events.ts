/**
 * Plain words for owner-added events (Event Radar Lite): reject reasons,
 * source links, the notice counter and labels. Pure helpers, no rupee
 * figures anywhere: the owner sets any rate change (D-097).
 */
import type { EventCategory, EventDemand, EventOrigin, PulseEvent } from "./types-settings.ts";

/** The longest notice the API reads. */
export const NOTICE_MAX = 6000;

export const NO_FETCH_HELP = "Paste from an official source. Seedha does not fetch or scrape websites.";
export const RATE_LINE = "You set any rate change. Seedha never suggests a price.";
export const CLAUDE_NOTE = "Read from your source by Claude, not a forecast.";
export const SAMPLE_NOTE = "No Claude key is set, so Seedha shows a fixed sample event.";

const REASONS: Record<string, string> = {
  money_mentioned: "It mentions a price or amount. Seedha leaves money out of events.",
  web_address: "Its name or town has a web address in it.",
  bad_dates: "Its dates are missing, in the past or too far ahead.",
  bad_length: "Its name or town is too short or too long.",
  bad_category: "Its kind of event was not one Seedha knows.",
  bad_demand: "Its likely demand was not low, medium or high.",
  duplicate: "It appears twice in this notice, so it is kept once.",
  too_many: "There were too many events. Seedha keeps up to 10 per notice and 200 in all.",
  already_saved: "It is already on your calendar.",
};

/** A rejected row's name, or "An event" when the API hid it (it mentioned money or a link). */
export function rejectedName(name: string | null | undefined): string {
  const value = name?.trim();
  return value ? value : "An event";
}

/** A reject reason code in plain words. Unknown codes get a safe general line. */
export function reasonText(reason: string): string {
  return REASONS[reason] ?? "Seedha could not read this one clearly.";
}

/** True when the text is a full https:// address with a host. */
export function isHttpsUrl(text: string): boolean {
  const value = text.trim();
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** The source host for display ("www." dropped), or null for anything but https. */
export function sourceHost(url: string | null | undefined): string | null {
  if (!url || !isHttpsUrl(url)) return null;
  return new URL(url.trim()).hostname.replace(/^www\./i, "");
}

/** The error line under the source link field, or null when it is fine. */
export function sourceUrlError(text: string): string | null {
  const value = text.trim();
  if (!value) return "Add the official source link.";
  if (/^http:\/\//i.test(value)) return "Use the https:// address of the source.";
  if (!isHttpsUrl(value)) return "Enter a full link that starts with https://";
  return null;
}

/** Characters used against the notice limit, with a label for screen readers and sight. */
export function noticeCounter(
  text: string,
  max: number = NOTICE_MAX,
): { count: number; left: number; over: boolean; label: string } {
  const count = [...text].length;
  const left = max - count;
  const used = `${count.toLocaleString("en-IN")} of ${max.toLocaleString("en-IN")} characters`;
  return { count, left, over: left < 0, label: left < 0 ? `${used}. Remove ${-left} to continue.` : used };
}

/**
 * The labels an event carries on the Calendar. Owner events say where they
 * came from; one read by the no-key sample extractor also says so. Missing
 * origin reads as sample.
 */
export function eventLabels(origin: EventOrigin | null | undefined): string[] {
  if (origin === "owner_source") return ["From your sources"];
  // The no-key sample ignores the pasted text, so it never claims to come from the owner's source.
  if (origin === "sample_extraction") return ["Sample extraction"];
  return ["Sample"];
}

/** True for events the owner added (and may delete). */
export function isOwnerEvent(origin: EventOrigin | null | undefined): boolean {
  return origin === "owner_source" || origin === "sample_extraction";
}

/** "own-12" -> 12; anything else -> null. */
export function ownEventId(key: string): number | null {
  const m = /^own-(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}

const DEMAND: Record<EventDemand, string> = { low: "Low", medium: "Medium", high: "High" };

/** Demand as read from the notice (D-097): Claude's reading, or the sample's fixed value. */
export function demandText(demand: EventDemand, sample = false): string {
  const level = DEMAND[demand] ?? "Low";
  return sample
    ? `Likely overnight demand (sample): ${level}`
    : `Likely overnight demand, as Claude read your source: ${level}`;
}

const CATEGORY: Record<EventCategory, string> = {
  festival: "Festival",
  fair: "Fair",
  religious: "Religious",
  sports: "Sports",
  music: "Music",
  conference: "Conference",
  holiday: "Holiday",
  other: "Other",
};

export function categoryText(category: string): string {
  return CATEGORY[category as EventCategory] ?? "Other";
}

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-25".."2026-12-30" -> "25 to 30 Dec"; one day -> "31 Dec"; across months -> "31 Dec to 3 Jan". */
export function dateRange(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  const sMon = SHORT[(sm ?? 1) - 1];
  const eMon = SHORT[(em ?? 1) - 1];
  if (start === end) return `${sd} ${sMon}`;
  if (sm === em) return `${sd} to ${ed} ${eMon}`;
  return `${sd} ${sMon} to ${ed} ${eMon}`;
}

/** Plain words for an extract or save failure. */
export function extractErrorText(status: number, code: string, message: string): string {
  if (status === 429) return "Too many tries in a minute. Wait a moment and try again.";
  if (status === 503 || code === "extract_unavailable") {
    return "Reading notices is not available right now. Try again later.";
  }
  if (code === "bad_source_url") return "Use a full https:// link to the official source.";
  if (code === "empty_notice") return "Paste the notice text first.";
  if (code === "invalid_input") return "Check the notice and the link, then try again.";
  if (status === 413)
    return `The notice is too long. Keep it under ${NOTICE_MAX.toLocaleString("en-IN")} characters.`;
  return message || "That did not work. Try again.";
}

/** Plain words for an event's channel action, for any action the API sends. */
export function actionText(action: PulseEvent["action"] | string): string {
  if (action === "no_discount") return "No OTA discounts";
  if (action === "hold") return "Hold rooms for direct";
  return "Keep your usual mix";
}
