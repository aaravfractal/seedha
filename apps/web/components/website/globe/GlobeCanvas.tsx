"use client";

/**
 * The WebGL canvas. This module imports three.js, so it is only ever reached
 * through next/dynamic once the globe section nears the viewport.
 */
import { useEffect, useRef } from "react";
import { markersFor, type GlobeLayerKey, type GlobeTheme } from "@/lib/globe";
import { createGlobe, type GlobeHandle } from "./scene";
import styles from "./globe.module.css";

type Props = {
  layer: GlobeLayerKey;
  theme: GlobeTheme;
  active: string | null;
  /** Stop the sway and pulse: the pause button, or keyboard focus in the region. */
  paused: boolean;
  /** Called when WebGL cannot start; the parent shows the static map. */
  onFail: () => void;
};

export default function GlobeCanvas({ layer, theme, active, paused, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handle = useRef<GlobeHandle | null>(null);
  const initial = useRef({ layer, theme });
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // A fresh canvas per mount: a disposed renderer loses its context for good.
    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas ?? "";
    canvas.setAttribute("data-testid", "globe-canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    canvasRef.current = canvas;
    let globe: GlobeHandle;
    try {
      globe = createGlobe(canvas, initial.current);
    } catch {
      canvas.remove();
      failRef.current();
      return;
    }
    handle.current = globe;
    const onLost = (e: Event) => {
      e.preventDefault();
      failRef.current();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    // Render only while on screen; the scene also stops when the tab is hidden.
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => globe.setVisible(entries.some((x) => x.isIntersecting)))
        : null;
    if (io) io.observe(canvas);
    else globe.setVisible(true);
    return () => {
      io?.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      handle.current = null;
      canvasRef.current = null;
      globe.dispose();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    handle.current?.setLayer(layer);
    canvasRef.current?.setAttribute("data-layer", layer);
    canvasRef.current?.setAttribute(
      "data-markers",
      markersFor(layer)
        .map((m) => m.id)
        .join(" "),
    );
  }, [layer]);
  useEffect(() => handle.current?.setTheme(theme), [theme]);
  useEffect(() => handle.current?.setActive(active), [active]);
  useEffect(() => handle.current?.setPaused(paused), [paused]);

  // The canvas is created in the effect above; this box sizes it.
  return <div ref={hostRef} className={styles.canvasHost} aria-hidden="true" />;
}
