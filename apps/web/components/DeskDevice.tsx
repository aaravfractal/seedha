"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/api";
import type { DeskCommand, Slip } from "@/lib/types";
import { armChime, chime } from "./desk/chime";
import { OnScreenSlip } from "./desk/OnScreenSlip";
import type { SlipJob } from "./desk/OnScreenSlip";
import styles from "./desk/Desk.module.css";

/** What the front desk screen shows. */
type Screen =
  | { kind: "idle" }
  | { kind: "qr"; svg: string; text: string; expiresAt: number }
  | { kind: "ok"; text: string; sub: string }
  | { kind: "text"; text: string; sub: string };

const POLL_MS = 2000;
const IDLE_AFTER_SLIP_MS = 2600;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function Check() {
  return (
    <div className={`${styles.badge} ${styles.badgeOk}`} aria-hidden="true">
      <svg width="44%" height="44%" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
        <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/**
 * A preview of the front desk screen (the phone or tablet at reception). It
 * polls the desk command queue every 2 seconds through the server proxy, runs
 * each command, then acknowledges it. The checkout slip shows on screen.
 */
export function DeskDevice({
  hotel,
  knownSlips,
  onEvent,
  onOnline,
}: {
  hotel: string;
  knownSlips: readonly Slip[];
  onEvent: (kind: string) => void;
  onOnline?: (online: boolean) => void;
}) {
  const [screen, setScreen] = useState<Screen>({ kind: "idle" });
  const [shown, setShown] = useState<{ seq: number; job: SlipJob } | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latest = useRef({ onEvent, onOnline, knownSlips });

  useEffect(() => {
    latest.current = { onEvent, onOnline, knownSlips };
  }, [onEvent, onOnline, knownSlips]);

  useEffect(() => armChime(), []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const showSlip = useCallback((job: SlipJob) => {
    setShown((prev) => ({ seq: (prev?.seq ?? 0) + 1, job }));
  }, []);

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
          later(() => setScreen({ kind: "idle" }), IDLE_AFTER_SLIP_MS);
          break;
        case "beep":
          chime();
          break;
        case "print_slip": {
          const text = str(p.text);
          showSlip({ slip: latest.current.knownSlips.find((s) => s.text === text) ?? null, text });
          break;
        }
        default:
          break;
      }
      latest.current.onEvent(command.kind);
    },
    [later, showSlip],
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

  return (
    <div className={styles.deviceCol}>
      <div className={styles.device}>
        <div className={styles.screen} role="status" aria-live="polite" aria-label="Front desk screen">
          {screen.kind === "idle" ? (
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
              <Check />
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
      </div>
      <div className={styles.slipWell}>
        {shown ? (
          <figure key={shown.seq} className={styles.paper} aria-label="Slip on screen">
            <OnScreenSlip job={shown.job} />
          </figure>
        ) : null}
      </div>
      <p className={styles.status} role="status">
        Front desk screen:{" "}
        {online === null
          ? "connecting"
          : online
            ? "online, checking every 2 seconds"
            : "offline. Is the Seedha server running?"}
      </p>
    </div>
  );
}
