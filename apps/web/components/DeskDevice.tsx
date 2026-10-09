"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/api";
import type { DeskCommand } from "@/lib/types";

/** What the Desk screen shows. */
type Screen =
  | { kind: "idle" }
  | { kind: "qr"; svg: string; text: string; expiresAt: number }
  | { kind: "ok"; text: string; sub: string }
  | { kind: "text"; text: string; sub: string };

const POLL_MS = 2000;
const IDLE_AFTER_PRINT_MS = 2600;

function chime(): void {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  } catch {
    // Sound is a nicety; browsers may block it before a user gesture.
  }
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * The Desk box, simulated in the browser. It behaves like the firmware: polls
 * the API every 2 seconds with its device key (added by the server proxy),
 * runs each command, then acknowledges it.
 */
export function DeskDevice({ hotel, onEvent }: { hotel: string; onEvent: (kind: string) => void }) {
  const [screen, setScreen] = useState<Screen>({ kind: "idle" });
  const [ring, setRing] = useState(false);
  const [paper, setPaper] = useState<string | null>(null);
  const [paperOut, setPaperOut] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const run = useCallback(
    async (command: DeskCommand) => {
      const p = command.payload;
      switch (command.kind) {
        case "show_qr": {
          const svg = await QRCode.toString(str(p.url), {
            type: "svg",
            margin: 1,
            color: { dark: "#0E1512", light: "#FFFFFF" },
          });
          setPaperOut(false);
          setScreen({ kind: "qr", svg, text: str(p.text), expiresAt: Date.parse(str(p.expires_at)) });
          break;
        }
        case "show_ok":
          setScreen({ kind: "ok", text: str(p.text, "Thank you"), sub: str(p.sub) });
          break;
        case "show_text":
          setScreen({ kind: "text", text: str(p.text), sub: str(p.sub) });
          break;
        case "show_idle":
          later(() => {
            setScreen({ kind: "idle" });
            setRing(false);
          }, IDLE_AFTER_PRINT_MS);
          break;
        case "set_ring":
          setRing(str(p.color) === "green");
          break;
        case "beep":
          chime();
          break;
        case "print_slip":
          setPaper(str(p.text));
          setPaperOut(false);
          requestAnimationFrame(() => requestAnimationFrame(() => setPaperOut(true)));
          break;
        default:
          break;
      }
      onEventRef.current(command.kind);
    },
    [later],
  );

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      try {
        const body = await api<{ commands: DeskCommand[] }>("desk/poll");
        if (!alive) return;
        setOnline(true);
        for (const command of body.commands) await run(command);
        if (body.commands.length) {
          await postJson("desk/ack", { ids: body.commands.map((c) => c.id) });
        }
      } catch {
        if (alive) setOnline(false);
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }
    void tick();
    const pending = timers.current;
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      pending.forEach(clearTimeout);
    };
  }, [run]);

  useEffect(() => {
    if (screen.kind !== "qr") return;
    const left = screen.expiresAt - Date.now();
    const t = setTimeout(() => setScreen({ kind: "idle" }), Math.max(0, left));
    return () => clearTimeout(t);
  }, [screen]);

  return (
    <div>
      <div className="device">
        <div className={`ring${ring ? " green" : ""}`} aria-hidden="true" />
        <div className="screen" aria-live="polite" aria-label="Desk screen">
          {screen.kind === "idle" ? (
            <div className="s">
              <div style={{ fontSize: 26, fontWeight: 700 }}>Seedha</div>
              <small>{hotel} · Ready</small>
            </div>
          ) : null}
          {screen.kind === "qr" ? (
            <div className="s">
              <div
                className="qrbox"
                role="img"
                aria-label="Consent QR code"
                dangerouslySetInnerHTML={{ __html: screen.svg }}
              />
              <small>{screen.text}</small>
            </div>
          ) : null}
          {screen.kind === "ok" ? (
            <div className="s">
              <div className="check">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  aria-hidden="true"
                >
                  <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{screen.text}</div>
              <small>{screen.sub}</small>
              <small style={{ fontSize: 12, opacity: 0.85 }}>Proof added tonight</small>
            </div>
          ) : null}
          {screen.kind === "text" ? (
            <div className="s">
              <div style={{ fontSize: 22, fontWeight: 600 }}>{screen.text}</div>
              <small>{screen.sub}</small>
            </div>
          ) : null}
        </div>
        <div className="printslot" aria-hidden="true" />
        <div className="paperwrap">
          {paper ? (
            <pre className={`paper${paperOut ? " out" : ""}`} aria-label="Printed slip">
              {paper}
            </pre>
          ) : null}
        </div>
      </div>
      <p className="calc" role="status">
        Desk box (simulated in the browser):{" "}
        {online === null
          ? "connecting"
          : online
            ? "online, polling every 2 seconds"
            : "offline. Is the API running?"}
      </p>
    </div>
  );
}
