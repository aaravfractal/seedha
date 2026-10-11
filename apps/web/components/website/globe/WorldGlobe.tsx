"use client";

/**
 * Shared Earth for the public website (docs/WEBSITE_UPGRADE.md section 2).
 *
 * Contract used by the Seedha Pass and Event Radar sections:
 * - `initialLayer`: which layer shows first ("pass" | "radar").
 * - The component renders its own segmented layer toggle (aria-pressed), the
 *   canvas (aria-hidden) or the static land-only fallback map, and an
 *   accessible text list of every marker beside it.
 * - `label`: an accessible name for the whole globe region.
 *
 * Nothing heavy loads up front: when the region nears the viewport it picks
 * the 3D globe (three.js in its own chunk) or the static map (reduced motion,
 * no WebGL, low-end phone) and imports only that.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  GLOBE_PALETTE,
  PLANNED_TOWN,
  SAMPLE,
  fallbackReason,
  markersFor,
  type GlobeTheme,
} from "@/lib/globe";
import styles from "./globe.module.css";

export type GlobeLayer = "pass" | "radar";

export type WorldGlobeProps = {
  initialLayer: GlobeLayer;
  label: string;
};

const LAYERS: ReadonlyArray<{ key: GlobeLayer; name: string }> = [
  { key: "pass", name: "Seedha Pass" },
  { key: "radar", name: "Event Radar" },
];

function Placeholder() {
  return <div className={styles.placeholder} aria-hidden="true" />;
}

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false, loading: Placeholder });
const StaticMap = dynamic(() => import("./StaticMap"), { ssr: false, loading: Placeholder });

/* ---------- Site theme (data-site-theme on the website root) ---------- */

function readTheme(): GlobeTheme {
  const root = document.getElementById("seedha-site");
  if (root) return root.getAttribute("data-site-theme") === "light" ? "light" : "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribeTheme(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  const root = document.getElementById("seedha-site");
  if (root) mo.observe(root, { attributes: true, attributeFilter: ["data-site-theme"] });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function useSiteTheme(): GlobeTheme {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as GlobeTheme);
}

/* ---------- Mode choice ---------- */

type Mode = "idle" | "globe" | "static";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function chooseMode(): Mode {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const reason = fallbackReason({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    webgl: hasWebGL(),
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory,
    screenMin: Math.min(window.screen.width, window.screen.height),
  });
  return reason ? "static" : "globe";
}

export function WorldGlobe({ initialLayer, label }: WorldGlobeProps) {
  const [layer, setLayer] = useState<GlobeLayer>(initialLayer);
  const [mode, setMode] = useState<Mode>("idle");
  const [active, setActive] = useState<string | null>(null);
  const theme = useSiteTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();

  // Decide and load only when the region nears the viewport.
  useEffect(() => {
    const node = hostRef.current;
    if (!node || mode !== "idle") return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no observer: load now
      setMode(chooseMode());
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setMode(chooseMode());
        }
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [mode]);

  // Reduced motion switched on later: drop to the static map.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (mq.matches) setMode((m) => (m === "globe" ? "static" : m));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const onFail = useCallback(() => setMode("static"), []);

  const pick = (next: GlobeLayer) => {
    setLayer(next);
    setActive(null);
  };

  const onToggleKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : LAYERS.length - 1)) % LAYERS.length;
    const target = LAYERS[next];
    if (!target) return;
    pick(target.key);
    buttons.current[next]?.focus();
  };

  const markers = markersFor(layer);
  const palette = GLOBE_PALETTE[theme];
  const vars = {
    "--globeOcean": palette.ocean,
    "--globeLand": palette.land,
    "--globeRim": palette.rim,
    "--globePass": palette.pass,
    "--globeRadar": palette.radar,
  } as CSSProperties;
  const layerName = LAYERS.find((l) => l.key === layer)?.name ?? "";
  const status =
    layer === "pass"
      ? `Showing ${layerName}, ${markers.length} planned towns.`
      : `Showing ${layerName}, ${markers.length} sample events.`;

  return (
    <div
      role="region"
      aria-label={label}
      className={styles.root}
      style={vars}
      data-globe-layer={layer}
      data-globe-mode={mode}
      data-globe-theme={theme}
    >
      <div className={styles.toggle} role="group" aria-label="Map layer" data-testid="globe-toggle">
        {LAYERS.map((l, i) => (
          <button
            key={l.key}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            className={styles.toggleBtn}
            aria-pressed={layer === l.key}
            aria-controls={listId}
            data-layer={l.key}
            onClick={() => pick(l.key)}
            onKeyDown={(e) => onToggleKey(e, i)}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        <div ref={hostRef} className={styles.viewport}>
          {mode === "globe" ? (
            <GlobeCanvas layer={layer} theme={theme} active={active} onFail={onFail} />
          ) : mode === "static" ? (
            <StaticMap layer={layer} active={active} />
          ) : (
            <Placeholder />
          )}
          {mode === "globe" ? (
            <p className={styles.hint} aria-hidden="true">
              Drag to turn the globe
            </p>
          ) : null}
        </div>

        <div className={styles.listWrap}>
          <p className={styles.srOnly} aria-live="polite">
            {status}
          </p>
          <ul
            id={listId}
            className={styles.list}
            data-testid="globe-list"
            data-layer={layer}
            aria-label={layer === "pass" ? "Seedha Pass planned towns" : "Event Radar sample events"}
          >
            {markers.map((m) => (
              <li
                key={m.id}
                className={styles.item}
                data-marker={m.id}
                onMouseEnter={() => setActive(m.id)}
                onMouseLeave={() => setActive(null)}
              >
                <span
                  className={`${styles.dot} ${m.layer === "pass" ? styles.dotPass : styles.dotRadar}`}
                  aria-hidden="true"
                />
                {m.layer === "pass" ? (
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{m.name}</span>
                    <span className={styles.itemMeta}>{PLANNED_TOWN}</span>
                  </span>
                ) : (
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{m.name}</span>
                    <span className={styles.itemMeta}>
                      {m.town} · {m.detail}
                    </span>
                  </span>
                )}
                {m.sample ? <span className={styles.tag}>{SAMPLE}</span> : null}
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            {layer === "pass"
              ? "Planned towns for the Seedha Pass network. Sample view."
              : "Sample events. Seedha will use official event sources only."}
          </p>
        </div>
      </div>
    </div>
  );
}
