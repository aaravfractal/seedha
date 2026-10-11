/**
 * The 3D Earth (three.js). Loaded only through a dynamic import once the
 * globe section scrolls into view, so three lives in its own chunk.
 *
 * Land is painted from the land topology onto an equirectangular canvas
 * texture. No country shapes or borders exist anywhere in this scene.
 */
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { geoEquirectangular, geoPath } from "d3-geo";
import {
  GLOBE_PALETTE,
  arcPoints,
  arcsFor,
  cappedDpr,
  focusAngles,
  latLonToVec3,
  markersFor,
  siteEase,
  type GlobeLayerKey,
  type GlobeTheme,
} from "@/lib/globe";
import { landGeoJson } from "./land";

export type GlobeHandle = {
  setLayer(layer: GlobeLayerKey): void;
  setTheme(theme: GlobeTheme): void;
  setActive(id: string | null): void;
  /** False while the section is off screen: the render loop stops. */
  setVisible(visible: boolean): void;
  dispose(): void;
};

/** View: North India sits just below the middle with the curved horizon above. */
const FOV = 34;
const FOCUS = { lat: 30.6, lon: 78.4 };
const CAM_START = 4.6;
const CAM_END = 2.0;
const CAM_Y = 0.2;
/** North India sits this far above the point facing the camera (radians). */
const FOCUS_ELEV = 0.35;
const LOOK_Y_END = 0.55;
const INTRO_MS = 2600;
const SWAY = 0.16; // radians each way
const SWAY_PERIOD_S = 48;
const DRAG_SPEED = 0.005; // radians per CSS pixel
const RESUME_MS = 2200;
const TILT_LIMIT = 0.9;

const GLOBE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const GLOBE_FRAG = /* glsl */ `
uniform sampler2D uLand;
uniform vec3 uOcean;
uniform vec3 uLandColor;
uniform vec3 uRim;
uniform float uRimStrength;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  float land = texture2D(uLand, vUv).r;
  vec3 base = mix(uOcean, uLandColor, land);
  vec3 n = normalize(vNormal);
  float light = 0.82 + 0.18 * dot(n, normalize(vec3(-0.4, 0.6, 0.7)));
  float fres = pow(1.0 - max(n.z, 0.0), 2.6);
  gl_FragColor = vec4(base * light + uRim * fres * uRimStrength, 1.0);
  #include <colorspace_fragment>
}`;

const ATMO_VERT = /* glsl */ `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec3 vNormal;
void main() {
  float i = pow(clamp(0.72 + dot(vNormal, vec3(0.0, 0.0, -1.0)), 0.0, 1.0), 3.0);
  gl_FragColor = vec4(uColor, i * uStrength);
  #include <colorspace_fragment>
}`;

const POINT_VERT = /* glsl */ `
attribute float aSize;
uniform float uDpr;
varying float vSize;
void main() {
  vSize = aSize;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uDpr;
  gl_Position = projectionMatrix * mv;
}`;

const POINT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uRing;
uniform float uTime;
varying float vSize;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.30, 0.36, d);
  float ring = (1.0 - smoothstep(0.36, 0.44, d)) - core;
  float halo = (1.0 - smoothstep(0.44, 1.0, d)) * (0.28 + 0.08 * sin(uTime * 1.6));
  vec3 col = uColor * core + uRing * ring + uColor * halo * (1.0 - core - ring);
  float a = core + ring + halo * (1.0 - core - ring);
  gl_FragColor = vec4(col / max(a, 0.001), a);
  #include <colorspace_fragment>
}`;

function landTexture(maxSize: number): CanvasTexture {
  const w = Math.min(4096, maxSize);
  const h = w / 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const projection = geoEquirectangular()
    .scale(w / (2 * Math.PI))
    .translate([w / 2, h / 2]);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  geoPath(projection, ctx)(landGeoJson());
  ctx.fill();
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Build the globe on `canvas`. Throws when WebGL cannot start, so the caller
 * can switch to the static map.
 */
export function createGlobe(
  canvas: HTMLCanvasElement,
  opts: { layer: GlobeLayerKey; theme: GlobeTheme },
): GlobeHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  const dpr = cappedDpr(window.devicePixelRatio);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 20);
  const tilt = new Group(); // rotation.x: latitude
  const spin = new Group(); // rotation.y: longitude
  tilt.add(spin);
  scene.add(tilt);

  const palette = () => GLOBE_PALETTE[theme];
  let theme = opts.theme;

  const texture = landTexture(renderer.capabilities.maxTextureSize);
  texture.colorSpace = SRGBColorSpace;
  const globeGeo = new SphereGeometry(1, 128, 96);
  const globeMat = new ShaderMaterial({
    vertexShader: GLOBE_VERT,
    fragmentShader: GLOBE_FRAG,
    uniforms: {
      uLand: { value: texture },
      uOcean: { value: new Color() },
      uLandColor: { value: new Color() },
      uRim: { value: new Color() },
      uRimStrength: { value: 0.5 },
    },
  });
  spin.add(new Mesh(globeGeo, globeMat));

  const atmoGeo = new SphereGeometry(1.16, 96, 64);
  const atmoMat = new ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: { uColor: { value: new Color() }, uStrength: { value: 0.6 } },
    side: BackSide,
    transparent: true,
    depthWrite: false,
  });
  scene.add(new Mesh(atmoGeo, atmoMat));

  const pointMat = new ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: {
      uColor: { value: new Color() },
      uRing: { value: new Color() },
      uDpr: { value: dpr },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
  });
  const arcMat = new MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
  const overlay = new Group();
  spin.add(overlay);
  let points: Points | null = null;
  let markerIds: string[] = [];
  let active: string | null = null;
  let layer = opts.layer;

  function applyTheme() {
    const p = palette();
    globeMat.uniforms.uOcean!.value.set(p.ocean);
    globeMat.uniforms.uLandColor!.value.set(p.land);
    globeMat.uniforms.uRim!.value.set(p.rim);
    globeMat.uniforms.uRimStrength!.value = theme === "dark" ? 0.55 : 0.35;
    atmoMat.uniforms.uColor!.value.set(p.rim);
    atmoMat.uniforms.uStrength!.value = theme === "dark" ? 0.6 : 0.4;
    pointMat.uniforms.uColor!.value.set(layer === "pass" ? p.pass : p.radar);
    pointMat.uniforms.uRing!.value.set(theme === "dark" ? "#000000" : "#ffffff");
    arcMat.color.set(p.arc);
  }

  function sizes(): Float32Array {
    return new Float32Array(markerIds.map((id) => (id === active ? 34 : 24)));
  }

  function buildLayer() {
    for (const child of [...overlay.children]) {
      overlay.remove(child);
      (child as Mesh).geometry.dispose();
    }
    const markers = markersFor(layer);
    // Several events can share a town: one marker per place keeps them crisp.
    const seen = new Set<string>();
    markerIds = [];
    const pos: number[] = [];
    for (const m of markers) {
      const key = `${m.lat},${m.lon}`;
      if (seen.has(key)) continue;
      seen.add(key);
      markerIds.push(m.id);
      pos.push(...latLonToVec3(m.lat, m.lon, 1.004));
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute("aSize", new BufferAttribute(sizes(), 1));
    points = new Points(geo, pointMat);
    points.renderOrder = 2;
    for (const [a, b] of arcsFor(layer)) {
      const pts = arcPoints(a, b, 40, 0, 1.002);
      const span = new Vector3(...pts[0]!).angleTo(new Vector3(...pts[pts.length - 1]!));
      const lifted = arcPoints(a, b, 40, Math.max(0.004, span * 0.35), 1.002).map((p) => new Vector3(...p));
      const tube = new Mesh(new TubeGeometry(new CatmullRomCurve3(lifted), 48, 0.0016, 6, false), arcMat);
      tube.renderOrder = 1;
      overlay.add(tube);
    }
    overlay.add(points);
    applyTheme();
  }

  buildLayer();

  /* ---------- Motion ---------- */
  const focus = focusAngles(FOCUS.lat, FOCUS.lon);
  let baseY = focus.y;
  let baseX = focus.x - FOCUS_ELEV;
  // The intro eases these offsets to zero, so a drag during it still works.
  const INTRO_OFF_Y = -1.5;
  const INTRO_OFF_X = -0.35;
  let introK = 0;
  let swayPhase = 0;
  let introStart = -1;
  let hovering = false;
  let dragging = false;
  let resumeAt = 0;
  let lastX = 0;
  let lastY = 0;

  function autoRotating(now: number): boolean {
    return !hovering && !dragging && now >= resumeAt && introK >= 1;
  }

  function freezeSway() {
    baseY += SWAY * Math.sin(swayPhase);
    swayPhase = 0;
  }

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      freezeSway();
      hovering = true;
    }
  };
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      hovering = false;
      resumeAt = performance.now() + RESUME_MS;
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    freezeSway();
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    baseY += (e.clientX - lastX) * DRAG_SPEED;
    baseX = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, baseX + (e.clientY - lastY) * DRAG_SPEED));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    resumeAt = performance.now() + (e.pointerType === "mouse" ? RESUME_MS : RESUME_MS * 2);
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener("pointerenter", onPointerEnter);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  /* ---------- Size ---------- */
  let width = 0;
  let height = 0;
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    // Narrow screens: widen the view so the horizon still shows.
    camera.fov = camera.aspect < 1 ? FOV / Math.min(1, camera.aspect * 1.15) : FOV;
    camera.updateProjectionMatrix();
  }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  resize();

  /* ---------- Loop ---------- */
  let frame = 0;
  let last = 0;
  let visible = false;
  let disposed = false;

  function render(now: number) {
    frame = 0;
    if (disposed) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    resize();
    if (introStart < 0) introStart = now;
    introK = Math.min(1, (now - introStart) / INTRO_MS);
    const k = siteEase(introK);
    const dist = CAM_START + (CAM_END - CAM_START) * k;
    const lookY = LOOK_Y_END * k;
    if (autoRotating(now)) swayPhase += (dt * 2 * Math.PI) / SWAY_PERIOD_S;
    spin.rotation.y = baseY + INTRO_OFF_Y * (1 - k) + SWAY * Math.sin(swayPhase);
    tilt.rotation.x = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, baseX + INTRO_OFF_X * (1 - k)));
    camera.position.set(0, CAM_Y * k, dist);
    camera.lookAt(0, lookY, 0);
    pointMat.uniforms.uTime!.value = now / 1000;
    renderer.render(scene, camera);
    if (visible && !document.hidden) frame = requestAnimationFrame(render);
  }

  function start() {
    if (frame || disposed || !visible || document.hidden) return;
    last = 0;
    frame = requestAnimationFrame(render);
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);

  return {
    setLayer(next) {
      if (next === layer) return;
      layer = next;
      active = null;
      buildLayer();
      if (!frame) renderer.render(scene, camera);
    },
    setTheme(next) {
      theme = next;
      applyTheme();
      if (!frame) renderer.render(scene, camera);
    },
    setActive(id) {
      active = id;
      points?.geometry.setAttribute("aSize", new BufferAttribute(sizes(), 1));
      if (!frame) renderer.render(scene, camera);
    },
    setVisible(v) {
      visible = v;
      if (v) start();
      else stop();
    },
    dispose() {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerenter", onPointerEnter);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      ro?.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as Mesh;
        mesh.geometry?.dispose();
      });
      for (const m of [globeMat, atmoMat, pointMat, arcMat]) m.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
