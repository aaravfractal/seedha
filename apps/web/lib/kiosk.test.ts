import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_KIOSK,
  STATUS_LABEL,
  applyCommand,
  describeScreen,
  expireQr,
  safeUrl,
  toIdle,
  urlHost,
} from "./kiosk.ts";
import type { KioskCommand, KioskState } from "./kiosk.ts";

const cmd = (kind: string, payload: Record<string, unknown> = {}): KioskCommand => ({ id: 1, kind, payload });
const QR_URL = "https://abc-def.trycloudflare.com/consent/tok_123";

function run(state: KioskState, ...commands: KioskCommand[]) {
  const effects: string[] = [];
  let next = state;
  for (const c of commands) {
    const r = applyCommand(next, c);
    next = r.state;
    effects.push(...r.effects);
  }
  return { state: next, effects };
}

test("show_qr keeps the API URL exactly as sent", () => {
  const { state } = run(
    INITIAL_KIOSK,
    cmd("show_qr", {
      url: QR_URL,
      text: "Room 101, scan to get your perk",
      expires_at: "2026-10-11T10:10:00Z",
    }),
  );
  assert.equal(state.screen.kind, "qr");
  assert.ok(state.screen.kind === "qr" && state.screen.url === QR_URL);
  assert.ok(state.screen.kind === "qr" && state.screen.expiresAt === Date.parse("2026-10-11T10:10:00Z"));
  assert.equal(urlHost(QR_URL), "abc-def.trycloudflare.com");
});

test("a URL that is not http(s) is never shown as a QR", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("/consent/tok"), null);
  assert.equal(safeUrl(42), null);
  assert.equal(safeUrl("http://192.168.0.10:3000/consent/x"), "http://192.168.0.10:3000/consent/x");
  const { state } = run(INITIAL_KIOSK, cmd("show_qr", { url: "data:text/html,hi" }));
  assert.equal(state.screen.kind, "bad_link");
  assert.match(describeScreen(state), /could not be read/);
});

test("consent: thank you, consent saved and one chime", () => {
  const { state, effects } = run(
    INITIAL_KIOSK,
    cmd("set_ring", { color: "off" }),
    cmd("show_qr", { url: QR_URL, text: "Scan", expires_at: "2026-10-11T10:10:00Z" }),
    cmd("show_ok", { text: "Thank you, Neha ji", sub: "Consent saved" }),
    cmd("set_ring", { color: "green" }),
    cmd("beep", { pattern: "chime" }),
  );
  assert.equal(state.screen.kind, "ok");
  assert.equal(state.status, "saved");
  assert.equal(effects.filter((e) => e === "chime").length, 1);
  assert.equal(describeScreen(state), "Thank you, Neha ji. Consent saved.");
});

test("print_slip keeps the slip on screen through the idle that follows", () => {
  const { state, effects } = run(
    { ...INITIAL_KIOSK, status: "saved" },
    cmd("show_text", { text: "Printing slip", sub: "Please take your receipt" }),
    cmd("print_slip", { text: "Hotel Deodar View\nHotel kept   Rs 2,675" }),
    cmd("show_idle"),
  );
  assert.deepEqual(effects, ["cancel_idle", "idle_soon"]);
  assert.equal(state.slip?.seq, 1);
  const idle = toIdle(state);
  assert.equal(idle.screen.kind, "idle");
  assert.equal(idle.status, "ready");
  assert.equal(idle.slip?.text, "Hotel Deodar View\nHotel kept   Rs 2,675");
});

test("a new check-in puts the last slip away; empty slips are ignored", () => {
  const printed = run(INITIAL_KIOSK, cmd("print_slip", { text: "slip" })).state;
  assert.equal(run(printed, cmd("print_slip", { text: "" })).state.slip?.seq, 1);
  const next = run(printed, cmd("show_qr", { url: QR_URL, expires_at: "x" })).state;
  assert.equal(next.slip, null);
});

test("the screen starts ready and says so", () => {
  assert.equal(INITIAL_KIOSK.status, "ready");
  assert.equal(describeScreen(INITIAL_KIOSK), "Front desk ready.");
  const saved = run(INITIAL_KIOSK, cmd("set_ring", { color: "green" })).state;
  assert.equal(saved.status, "saved");
  assert.equal(run(saved, cmd("set_ring", { color: "off" })).state.status, "ready");
});

test("an expired QR goes back to idle; unknown commands change nothing", () => {
  const qr = run(INITIAL_KIOSK, cmd("show_qr", { url: QR_URL, expires_at: "2026-10-11T10:10:00Z" })).state;
  assert.equal(expireQr(qr, Date.parse("2026-10-11T10:09:59Z")).screen.kind, "qr");
  assert.equal(expireQr(qr, Date.parse("2026-10-11T10:10:00Z")).screen.kind, "idle");
  assert.equal(run(qr, cmd("reboot")).state, qr);
});

test("copy has no em dashes or exclamation marks", () => {
  const states: KioskState[] = [
    INITIAL_KIOSK,
    run(INITIAL_KIOSK, cmd("show_qr", { url: "nope" })).state,
    run(INITIAL_KIOSK, cmd("show_ok", { text: "Thank you", sub: "Consent saved" })).state,
  ];
  for (const s of states) {
    const text = describeScreen(s);
    assert.ok(!/[—!]/.test(text), text);
  }
  for (const text of Object.values(STATUS_LABEL)) assert.ok(!/[—!]/.test(text), text);
});

test("QR URLs with whitespace or control characters are refused", () => {
  assert.equal(safeUrl(" https://seedha.example/consent/abc"), null);
  assert.equal(safeUrl("https://seedha.example/consent/a\nb"), null);
  assert.equal(safeUrl("https://seedha.example/consent/abc"), "https://seedha.example/consent/abc");
});

test("a show_qr command with no payload shows the bad-link screen instead of throwing", () => {
  const command = { id: 9, kind: "show_qr", payload: null } as unknown as KioskCommand;
  const { state } = applyCommand(INITIAL_KIOSK, command);
  assert.equal(state.screen.kind, "bad_link");
});
