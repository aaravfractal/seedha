"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import { api, postJson } from "@/lib/api";
import type { DeskCommand, Slip } from "@/lib/types";
import { armChime, chime } from "./desk/chime";
import { ThermalSlip } from "./desk/ThermalSlip";
import type { PrintJob } from "./desk/ThermalSlip";
import styles from "./desk/Desk.module.css";

/** What the Desk screen shows (480 x 320). */
type Screen =
  | { kind: "idle" }
  | { kind: "qr"; svg: string; text: string; expiresAt: number }
  | { kind: "ok"; text: string; sub: string }
  | { kind: "text"; text: string; sub: string };

type Led = "white" | "green" | "red";

/** Actions the page can run on the simulated box. */
export type DeskHandle = {
  /** Paper is back: print whatever waited. */
  paperLoaded: () => void;
};

const POLL_MS = 2000;
const IDLE_AFTER_PRINT_MS = 2600;
const LED_LABEL: Record<Led, string> = {
  white: "Desk light white: ready",
  green: "Desk light green: consent saved",
  red: "Desk light red: printer needs paper",
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function Check({ tone }: { tone: "ok" | "bad" }) {
  return (
    <div className={`${styles.badge} ${tone === "ok" ? styles.badgeOk : styles.badgeBad}`} aria-hidden="true">
      {tone === "ok" ? (
        <svg width="44%" height="44%" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
          <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
          <path d="M12 5v9M12 19v.5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

/**
 * The Desk box, simulated in the browser. It behaves like the firmware: polls
 * the API every 2 seconds with its device key (added by the server proxy),
 * runs each command, then acknowledges it. "No paper" is a simulator-only
 * state: slips wait in the box until paper is loaded.
 */
export function DeskDevice({
  hotel,
  noPaper,
  knownSlips,
  onEvent,
  onOnline,
  ref,
}: {
  hotel: string;
  noPaper: boolean;
  knownSlips: readonly Slip[];
  onEvent: (kind: string) => void;
  onOnline?: (online: boolean) => void;
  ref?: Ref<DeskHandle>;
}) {
  const [screen, setScreen] = useState<Screen>({ kind: "idle" });
  const [ring, setRing] = useState(false);
  const [paper, setPaper] = useState<{ seq: number; job: PrintJob } | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latest = useRef({ onEvent, onOnline, knownSlips, noPaper });
  const pending = useRef<PrintJob | null>(null);

  useEffect(() => {
    latest.current = { onEvent, onOnline, knownSlips, noPaper };
  }, [onEvent, onOnline, knownSlips, noPaper]);

  useEffect(() => armChime(), []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const print = useCallback((job: PrintJob, force = false) => {
    if (latest.current.noPaper && !force) {
      pending.current = job;
      return;
    }
    pending.current = null;
    setPaper((prev) => ({ seq: (prev?.seq ?? 0) + 1, job }));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      paperLoaded: () => {
        if (pending.current) print(pending.current, true);
      },
    }),
    [print],
  );

  const run = useCallback(
    async (command: DeskCommand) => {
      const p = command.payload;
      switch (command.kind) {
        case "show_qr": {
          const svg = await QRCode.toString(str(p.url), {
            type: "svg",
            margin: 1,
            color: { dark: "#000000", light: "#FFFFFF" },
          });
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
        case "print_slip": {
          const text = str(p.text);
          print({ slip: latest.current.knownSlips.find((s) => s.text === text) ?? null, text });
          break;
        }
        default:
          break;
      }
      latest.current.onEvent(command.kind);
    },
    [later, print],
  );

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const report = (value: boolean) => {
      setOnline(value);
      latest.current.onOnline?.(value);
    };
    async function tick() {
      try {
        const body = await api<{ commands: DeskCommand[] }>("desk/poll");
        if (!alive) return;
        report(true);
        for (const command of body.commands) await run(command);
        if (body.commands.length) {
          await postJson("desk/ack", { ids: body.commands.map((c) => c.id) });
        }
      } catch {
        if (alive) report(false);
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }
    void tick();
    const owned = timers.current;
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      owned.forEach(clearTimeout);
    };
  }, [run]);

  useEffect(() => {
    if (screen.kind !== "qr") return;
    const left = screen.expiresAt - Date.now();
    const t = setTimeout(() => setScreen({ kind: "idle" }), Math.max(0, left));
    return () => clearTimeout(t);
  }, [screen]);

  const led: Led = noPaper ? "red" : ring ? "green" : "white";
  const last = paper?.job ?? null;

  return (
    <div className={styles.deviceCol}>
      <div className={styles.device}>
        <div className={`${styles.led} ${styles[`led_${led}`]}`} role="img" aria-label={LED_LABEL[led]} />
        <div className={styles.panel}>
          <div className={styles.screen} role="status" aria-live="polite" aria-label="Desk screen">
            {noPaper ? (
              <div className={styles.state} key="err">
                <Check tone="bad" />
                <p className={styles.big}>Printer needs paper</p>
                <p className={styles.small}>Load a 58 mm roll to keep printing.</p>
              </div>
            ) : screen.kind === "idle" ? (
              <div className={styles.state} key="idle">
                <p className={styles.huge}>Seedha</p>
                <p className={styles.small}>{hotel} · Ready</p>
              </div>
            ) : screen.kind === "qr" ? (
              <div className={`${styles.state} ${styles.qrState}`} key="qr">
                <div
                  className={styles.qr}
                  role="img"
                  aria-label="Consent QR code"
                  dangerouslySetInnerHTML={{ __html: screen.svg }}
                />
                <p className={styles.mid}>{screen.text}</p>
              </div>
            ) : screen.kind === "ok" ? (
              <div className={styles.state} key="ok">
                <Check tone="ok" />
                <p className={styles.big}>{screen.text}</p>
                <p className={styles.small}>{screen.sub ? `${screen.sub} · ` : ""}Proof added tonight</p>
              </div>
            ) : (
              <div className={styles.state} key="text">
                <p className={styles.big}>{screen.text}</p>
                <p className={styles.small}>{screen.sub}</p>
              </div>
            )}
          </div>
          <div className={styles.panelFoot}>
            <span className={styles.brand}>Seedha</span>
            <button
              type="button"
              className={styles.printBtn}
              disabled={!last || noPaper}
              onClick={() => last && print(last)}
            >
              Print
            </button>
          </div>
        </div>
        <div className={styles.slot} aria-hidden="true" />
      </div>
      <div className={styles.paperWell}>
        {paper ? (
          <figure key={paper.seq} className={styles.paper} aria-label="Printed slip">
            <ThermalSlip job={paper.job} />
          </figure>
        ) : null}
      </div>
      <p className={styles.status} role="status">
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
