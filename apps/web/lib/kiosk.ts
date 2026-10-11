/**
 * The Desk kiosk (/desk/device): a phone or tablet acting as the Desk box.
 * It runs the same queued commands as the firmware and the simulator
 * (show_qr, show_ok, show_text, show_idle, set_ring, beep, print_slip).
 * Pure state logic lives here so it can be tested without a browser.
 * The kiosk never builds a URL: it shows exactly the URL the API sent.
 */

export type KioskCommand = { id: number; kind: string; payload: Record<string, unknown> };

export type KioskScreen =
  | { kind: "idle" }
  | { kind: "qr"; url: string; text: string; expiresAt: number }
  | { kind: "ok"; text: string; sub: string }
  | { kind: "text"; text: string; sub: string }
  | { kind: "bad_link" };

export type KioskSlip = { seq: number; text: string };

export type KioskState = {
  screen: KioskScreen;
  /** The ring the API asked for. Paper out (red) is layered on top in `ringFor`. */
  ring: "off" | "green";
  slip: KioskSlip | null;
};

/** Side effects the page runs after a command. */
export type KioskEffect = "chime" | "idle_soon" | "cancel_idle";

export type RingColour = "white" | "green" | "red";

export const INITIAL_KIOSK: KioskState = { screen: { kind: "idle" }, ring: "off", slip: null };

/** Back to idle a moment after printing, like the firmware. */
export const IDLE_AFTER_PRINT_MS = 2600;
export const POLL_MS = 2000;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** The API's URL if it is an absolute http(s) URL, else null. Never rewritten. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/** Host shown under the QR so the owner can see which address the guest will open. */
export function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Apply one queued command. Unknown commands change nothing. */
export function applyCommand(
  state: KioskState,
  command: KioskCommand,
): { state: KioskState; effects: KioskEffect[] } {
  const p = command.payload;
  switch (command.kind) {
    case "show_qr": {
      const url = safeUrl(p.url);
      const expiresAt = Date.parse(str(p.expires_at));
      const screen: KioskScreen = url
        ? { kind: "qr", url, text: str(p.text, "Scan to get your perk"), expiresAt }
        : { kind: "bad_link" };
      // A new guest at the desk: the last guest's slip is put away.
      return { state: { ...state, screen, slip: null }, effects: ["cancel_idle"] };
    }
    case "show_ok":
      return {
        state: { ...state, screen: { kind: "ok", text: str(p.text, "Thank you"), sub: str(p.sub) } },
        effects: ["cancel_idle"],
      };
    case "show_text":
      return {
        state: { ...state, screen: { kind: "text", text: str(p.text), sub: str(p.sub) } },
        effects: ["cancel_idle"],
      };
    case "show_idle":
      return { state, effects: ["idle_soon"] };
    case "set_ring":
      return { state: { ...state, ring: str(p.color) === "green" ? "green" : "off" }, effects: [] };
    case "beep":
      return { state, effects: ["chime"] };
    case "print_slip": {
      const text = str(p.text);
      if (!text) return { state, effects: [] };
      return { state: { ...state, slip: { seq: (state.slip?.seq ?? 0) + 1, text } }, effects: [] };
    }
    default:
      return { state, effects: [] };
  }
}

/** The delayed idle after a print: screen idle, ring off, slip kept on screen. */
export function toIdle(state: KioskState): KioskState {
  return { ...state, screen: { kind: "idle" }, ring: "off" };
}

/** A QR past its expiry goes back to idle (the token no longer works). */
export function expireQr(state: KioskState, now: number): KioskState {
  if (state.screen.kind !== "qr" || !(state.screen.expiresAt <= now)) return state;
  return { ...state, screen: { kind: "idle" } };
}

/** Ring colour: red while the printer needs paper, green after consent, else white. */
export function ringFor(state: KioskState, paperOut: boolean): RingColour {
  if (paperOut) return "red";
  return state.ring === "green" ? "green" : "white";
}

export const RING_LABEL: Record<RingColour, string> = {
  white: "Desk light white: ready",
  green: "Desk light green: consent saved",
  red: "Desk light red: printer needs paper",
};

/** One sentence for screen readers when the screen changes. */
export function describeScreen(state: KioskState, paperOut: boolean): string {
  const s = state.screen;
  const paper = paperOut ? " Printer needs paper. Slips show on this screen." : "";
  switch (s.kind) {
    case "idle":
      return paperOut ? "Printer needs paper. Slips show on this screen." : "Desk ready.";
    case "qr":
      return `${s.text}. Consent QR code on screen.${paper}`;
    case "ok":
      return `${s.text}. ${s.sub ? `${s.sub}.` : ""}${paper}`.trim();
    case "text":
      return `${s.text}. ${s.sub ? `${s.sub}.` : ""}${paper}`.trim();
    case "bad_link":
      return `The consent link from Seedha could not be read. Start the check-in again.${paper}`;
  }
}
