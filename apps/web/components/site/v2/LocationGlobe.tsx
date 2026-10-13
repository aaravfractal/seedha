"use client";

/**
 * Land-only globe for the hotel site (docs/HOTEL_SITE_V2.md, V2-GLOBE).
 *
 * Default export; load it with next/dynamic from a client component:
 *   const LocationGlobe = dynamic(() => import("@/components/site/v2/LocationGlobe"), { ssr: false });
 *
 * - Orthographic canvas drawing of world-atlas land-110m. Only the `land`
 *   object is read: no country borders, no graticule.
 * - The land topology is a separate chunk, imported only when the globe nears
 *   the viewport, so it never weighs on the first load.
 * - Once it is in view it eases from a wide view to the hotel (EASE_MS).
 * - It renders only when motion is allowed and a canvas 2D context exists.
 *   With prefers-reduced-motion, or no canvas, it renders nothing, so the
 *   static SVG LocalMap is the location view.
 * - A square box (aspect-ratio 1) reserves its space, so nothing shifts.
 * - geo null renders nothing; the caller may show its own note.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import {
  EASE_MS,
  GLOBE_BOX,
  GLOBE_COLOURS,
  cappedDpr,
  endView,
  globeLabel,
  markerVisible,
  rotationFor,
  scaleFor,
  startView,
  viewAt,
  type View,
} from "@/lib/siteGlobe";
import type { Geo, LocationProps } from "@/lib/types-site-v2";

const REDUCE = "(prefers-reduced-motion: reduce)";
let canvasOk: boolean | null = null;

/** True when this browser gives a canvas a 2D context (checked once). */
function hasCanvas2d(): boolean {
  if (canvasOk === null) {
    try {
      canvasOk = Boolean(document.createElement("canvas").getContext("2d"));
    } catch {
      canvasOk = false;
    }
  }
  return canvasOk;
}

function subscribeMotion(onChange: () => void): () => void {
  const mq = window.matchMedia?.(REDUCE);
  mq?.addEventListener?.("change", onChange);
  return () => mq?.removeEventListener?.("change", onChange);
}

/** Motion allowed and a 2D canvas available; false on the server. */
function globeAllowed(): boolean {
  const reduced = window.matchMedia?.(REDUCE).matches ?? false;
  return !reduced && hasCanvas2d();
}

let landCache: Promise<GeoJSON.FeatureCollection> | null = null;

/** The land layer, fetched once per page as its own chunk. */
function loadLand(): Promise<GeoJSON.FeatureCollection> {
  if (!landCache) {
    landCache = import("world-atlas/land-110m.json").then((mod) => {
      const topology = (mod.default ?? mod) as unknown as Topology<{ land: GeometryCollection }>;
      return feature(topology, topology.objects.land);
    });
    landCache.catch(() => {
      landCache = null;
    });
  }
  return landCache;
}

function draw(canvas: HTMLCanvasElement, view: View, geo: Geo, land: GeoJSON.FeatureCollection | null): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  const projection = geoOrthographic()
    .rotate(rotationFor(view))
    .scale(scaleFor(view, size))
    .translate([size / 2, size / 2])
    .precision(0.5);
  const path = geoPath(projection, ctx);

  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fillStyle = GLOBE_COLOURS.ocean;
  ctx.fill();

  if (land) {
    ctx.beginPath();
    path(land);
    ctx.fillStyle = GLOBE_COLOURS.land;
    ctx.fill();
  }

  if (markerVisible(view, geo)) {
    const p = projection([geo.lng, geo.lat]);
    if (p) {
      const unit = size / 360;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 13 * unit, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(245, 241, 232, 0.55)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p[0], p[1], 7 * unit, 0, Math.PI * 2);
      ctx.fillStyle = GLOBE_COLOURS.marker;
      ctx.fill();
      ctx.lineWidth = 2.5 * unit;
      ctx.strokeStyle = GLOBE_COLOURS.ring;
      ctx.stroke();
    }
  }
}

export default function LocationGlobe({ geo, hotel, lang }: LocationProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const allowed = useSyncExternalStore(subscribeMotion, globeAllowed, () => false);
  const lat = allowed ? geo?.lat : undefined;
  const lng = allowed ? geo?.lng : undefined;

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas || lat === undefined || lng === undefined) return;
    const g: Geo = { lat, lng };
    const from = startView(g);
    const to = endView(g);
    let view: View = from;
    let land: GeoJSON.FeatureCollection | null = null;
    let raf = 0;
    let alive = true;

    const fit = () => {
      const css = box.clientWidth;
      const px = Math.max(1, Math.round(css * cappedDpr(window.devicePixelRatio)));
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      draw(canvas, view, g, land);
    };

    const play = () => {
      const t0 = performance.now();
      const step = (now: number) => {
        if (!alive) return;
        const t = Math.min(1, (now - t0) / EASE_MS);
        view = viewAt(t, from, to);
        draw(canvas, view, g, land);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    // Start from the wide view.
    view = from;
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(box);

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      loadLand()
        .then((l) => {
          if (!alive) return;
          land = l;
          play();
        })
        .catch(() => {
          // Offline or chunk failed: keep the plain disc and the marker, centred.
          if (!alive) return;
          view = to;
          fit();
        });
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") start();
    else {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io?.disconnect();
            start();
          }
        },
        { threshold: 0.35 },
      );
      io.observe(box);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
    };
  }, [lat, lng]);

  if (!geo || !allowed) return null;

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={globeLabel(hotel, lang)}
      data-testid="location-globe"
      style={GLOBE_BOX}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
