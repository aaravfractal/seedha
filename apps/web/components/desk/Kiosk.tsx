"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import type { DeskState, PropertyInfo } from "@/lib/types";
import {
  IDLE_AFTER_PRINT_MS,
  INITIAL_KIOSK,
  POLL_MS,
  RING_LABEL,
  applyCommand,
  describeScreen,
  expireQr,
  ringFor,
  toIdle,
  urlHost,
} from "@/lib/kiosk";
import type { KioskCommand, KioskEffect, KioskState } from "@/lib/kiosk";
import { playChime, unlockAudio } from "./kioskAudio";
import styles from "./Kiosk.module.css";

type LinkState = "connecting" | "online" | "offline" | "paused" | "login";

const LINK_TEXT: Record<LinkState, string> = {
  connecting: "Connecting to Seedha",
  online: "Connected, checking every 2 seconds",
  offline: "Offline. Check the Wi-Fi and the Seedha server.",
  paused: "Paused while this screen is hidden",
  login: "Signed out. Log in again to run the Desk.",
};

const RING_WORD = { white: "Ready", green: "Consent saved", red: "Needs paper" } as const;

/**
 * A full-screen Desk for a phone or tablet. It polls the same device queue
 * as the Desk box (through the server proxy, which adds the device key for
 * an owner session), runs each command and acknowledges it.
 */
export function Kiosk() {
  const property = useApi<PropertyInfo>("property");
  const [kiosk, setKiosk] = useState<KioskState>(INITIAL_KIOSK);
  const [link, setLink] = useState<LinkState>("connecting");
  const [qrSvg, setQrSvg] = useState<{ url: string; svg: string } | null>(null);
  const [paperOut, setPaperOut] = useState(false);
  const [sound, setSound] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [awake, setAwake] = useState(false);

  const state = useRef<KioskState>(INITIAL_KIOSK);
  const soundOn = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commit = useCallback((next: KioskState) => {
    state.current = next;
    setKiosk(next);
  }, []);

  const runEffect = useCallback(
    (effect: KioskEffect) => {
      if (effect === "chime") {
        if (soundOn.current) playChime();
      } else if (effect === "cancel_idle") {
        clearTimeout(idleTimer.current);
      } else {
        clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => commit(toIdle(state.current)), IDLE_AFTER_PRINT_MS);
      }
    },
    [commit],
  );

  // Poll every 2 s like the firmware; stop while the tab is hidden.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;

    async function tick() {
      timer = undefined;
      if (!alive) return;
      if (document.hidden) {
        setLink("paused");
        return;
      }
      running = true;
      try {
        const body = await api<{ commands: KioskCommand[] }>("desk/poll");
        if (!alive) return;
        setLink("online");
        for (const command of body.commands) {
          const result = applyCommand(state.current, command);
          commit(result.state);
          result.effects.forEach(runEffect);
        }
        if (body.commands.length) {
          await postJson("desk/ack", { ids: body.commands.map((c) => c.id) });
        }
      } catch (err) {
        if (alive) setLink(err instanceof ApiError && err.status === 401 ? "login" : "offline");
      } finally {
        running = false;
      }
      if (alive && !document.hidden) timer = setTimeout(tick, POLL_MS);
    }

    function onVisibility() {
      if (document.hidden) {
        clearTimeout(timer);
        timer = undefined;
        setLink("paused");
      } else if (!timer && !running) {
        void tick();
      }
    }

    void tick();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(idleTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [commit, runEffect]);

  // Draw the QR for exactly the URL the API sent.
  const qrUrl = kiosk.screen.kind === "qr" ? kiosk.screen.url : null;
  useEffect(() => {
    if (!qrUrl) return;
    let alive = true;
    void QRCode.toString(qrUrl, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    }).then((svg) => {
      if (alive) setQrSvg({ url: qrUrl, svg });
    });
    return () => {
      alive = false;
    };
  }, [qrUrl]);

  // An expired consent link goes back to idle.
  const expiresAt = kiosk.screen.kind === "qr" ? kiosk.screen.expiresAt : null;
  useEffect(() => {
    if (expiresAt === null) return;
    const t = setTimeout(
      () => commit(expireQr(state.current, Date.now())),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => clearTimeout(t);
  }, [expiresAt, commit]);

  // Keep the screen on where the Wake Lock API exists; harmless elsewhere.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    async function request() {
      if (document.hidden || lock) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (!alive) {
          void lock.release();
          return;
        }
        setAwake(true);
        lock.addEventListener("release", () => {
          lock = null;
          setAwake(false);
        });
      } catch {
        setAwake(false);
      }
    }
    const onVisibility = () => void request();
    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after mount
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleSound() {
    if (sound) {
      soundOn.current = false;
      setSound(false);
      return;
    }
    const ok = unlockAudio();
    soundOn.current = ok;
    setSound(ok);
    if (ok) playChime();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }

  const ring = ringFor(kiosk, paperOut);
  const screen = kiosk.screen;
  const hotel = property.data?.short_name ?? "Front desk";
  const svg = qrSvg && qrUrl === qrSvg.url ? qrSvg.svg : null;

  return (
    <div className={styles.kiosk}>
      <h1 className={styles.srOnly}>Seedha Desk</h1>
      <div className={styles.top}>
        <p className={styles.brand}>
          <span className={styles.brandName}>Seedha Desk</span>
          <span className={styles.hotel}>{hotel}</span>
        </p>
        <p className={styles.link} role="status">
          <span className={`${styles.dot} ${styles[`dot_${link}`]}`} aria-hidden="true" />
          {LINK_TEXT[link]}
          {link === "login" ? (
            <>
              {" "}
              <Link href="/login?next=/desk/device" className={styles.inlineLink}>
                Log in
              </Link>
            </>
          ) : null}
        </p>
        <div className={styles.tools}>
          <button type="button" className="btn ghost small" aria-pressed={sound} onClick={toggleSound}>
            {sound ? "Sound on" : "Sound off"}
          </button>
          {canFullscreen ? (
            <button
              type="button"
              className="btn ghost small"
              aria-pressed={fullscreen}
              onClick={toggleFullscreen}
            >
              {fullscreen ? "Exit full screen" : "Full screen"}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ghost small ${paperOut ? styles.warnBtn : ""}`}
            aria-pressed={paperOut}
            onClick={() => setPaperOut((v) => !v)}
          >
            Simulated: no paper
          </button>
        </div>
      </div>

      <p className={styles.turn}>Turn your phone sideways for a bigger QR. The Desk still works this way.</p>

      <div className={styles.body}>
        <section
          className={`${styles.stage} ${styles[`ring_${ring}`]}`}
          data-ring={ring}
          aria-labelledby="kiosk-screen-title"
        >
          <h2 id="kiosk-screen-title" className={styles.srOnly}>
            Desk screen
          </h2>
          <p className={styles.ringChip} role="img" aria-label={RING_LABEL[ring]} data-testid="desk-ring">
            <span className={styles.ringDot} aria-hidden="true" />
            {RING_WORD[ring]}
          </p>

          {paperOut ? (
            <p className={styles.paperBanner}>
              <strong>Printer needs paper.</strong> Slips show on this screen until paper is loaded.
            </p>
          ) : null}

          {screen.kind === "idle" ? (
            <div className={styles.state}>
              <p className={styles.huge}>Seedha</p>
              <p className={styles.sub}>
                {paperOut ? "Load a 58 mm roll to print slips" : `${hotel} · Ready`}
              </p>
            </div>
          ) : screen.kind === "qr" ? (
            <div className={`${styles.state} ${styles.qrState}`}>
              <div
                className={styles.qr}
                role="img"
                aria-label="Consent QR code"
                data-url={screen.url}
                // The SVG comes from the qrcode library, built from the API's URL.
                dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
              />
              <div className={styles.qrText}>
                <p className={styles.big}>{screen.text}</p>
                <p className={styles.sub}>Opens {urlHost(screen.url)}</p>
                <p className={styles.sub}>Your choice. Nothing is sent without it.</p>
              </div>
            </div>
          ) : screen.kind === "ok" ? (
            <div className={styles.state}>
              <span className={styles.okBadge} aria-hidden="true">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className={styles.big}>{screen.text}</p>
              {screen.sub ? <p className={styles.sub}>{screen.sub}</p> : null}
            </div>
          ) : screen.kind === "text" ? (
            <div className={styles.state}>
              <p className={styles.big}>{screen.text}</p>
              {screen.sub ? <p className={styles.sub}>{screen.sub}</p> : null}
            </div>
          ) : (
            <div className={styles.state}>
              <p className={styles.big}>This link could not be shown</p>
              <p className={styles.sub}>Start the check-in again from the front desk.</p>
            </div>
          )}
        </section>

        <aside className={styles.side} aria-label="Slip and staff controls">
          <section className={styles.slipCard} aria-labelledby="kiosk-slip-title">
            <h2 id="kiosk-slip-title" className={styles.sideTitle}>
              Slip
            </h2>
            {kiosk.slip ? (
              <>
                <p className={styles.sideNote}>
                  {paperOut
                    ? "Printer needs paper, so the slip is shown here."
                    : "This screen has no printer, so the slip is shown here."}
                </p>
                <figure className={styles.receipt} aria-label="Slip on screen" key={kiosk.slip.seq}>
                  <pre>{kiosk.slip.text}</pre>
                </figure>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => commit({ ...state.current, slip: null })}
                >
                  Put the slip away
                </button>
              </>
            ) : (
              <p className={styles.sideNote}>The checkout slip shows here when it prints.</p>
            )}
          </section>
          <StaffPanel />
        </aside>
      </div>

      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {describeScreen(kiosk, paperOut)}
        {kiosk.slip ? " Slip on screen." : ""}
      </div>
      {awake ? <p className={styles.awake}>Screen stays on while the Desk is open</p> : null}
    </div>
  );
}

/** Staff controls so a single tablet can run the desk: show a room's QR, or check out. */
function StaffPanel() {
  const [open, setOpen] = useState(false);
  const desk = useApi<DeskState>(open ? "desk/state" : null);
  const [room, setRoom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const guests = desk.data?.guests ?? [];
  const selected = guests.find((g) => g.room === room) ?? guests.find((g) => !g.checked_out) ?? guests[0];

  async function act(path: string, done: string) {
    if (!selected?.room) return;
    setBusy(true);
    setNote(null);
    try {
      await postJson(path, { room: selected.room });
      setNote(done);
      desk.reload();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className={styles.staff} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={styles.staffSummary}>Staff: check in or check out</summary>
      <div className={styles.staffBody}>
        {desk.error ? (
          <p className={styles.sideNote} role="alert">
            {desk.error.message}
          </p>
        ) : !desk.data ? (
          <p className={styles.sideNote}>Loading tonight&apos;s guests</p>
        ) : guests.length === 0 ? (
          <p className={styles.sideNote}>No guests in house tonight.</p>
        ) : (
          <>
            <label htmlFor="kioskRoom" className={styles.staffLabel}>
              Guest at the desk
            </label>
            <select
              id="kioskRoom"
              className={styles.select}
              value={selected?.room ?? ""}
              onChange={(e) => setRoom(Number(e.target.value))}
            >
              {guests.map((g) => (
                <option key={g.booking_id} value={g.room ?? ""}>
                  Room {g.room} · {g.name}
                  {g.checked_out ? " · checked out" : g.consent ? " · said yes" : ""}
                </option>
              ))}
            </select>
            <div className={styles.staffButtons}>
              <button
                type="button"
                className="btn small"
                disabled={busy || !selected || selected.checked_out}
                onClick={() => void act("desk/checkin", `QR shown for room ${selected?.room}`)}
              >
                Show QR
              </button>
              <button
                type="button"
                className="btn ghost small"
                disabled={busy || !selected || selected.checked_out}
                onClick={() => void act("desk/checkout", `Room ${selected?.room} checked out. Slip sent.`)}
              >
                Check out and print
              </button>
            </div>
          </>
        )}
        {note ? (
          <p className={styles.sideNote} role="status">
            {note}
          </p>
        ) : null}
      </div>
    </details>
  );
}
