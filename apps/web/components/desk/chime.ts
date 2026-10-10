/**
 * The Desk success chime: 880 Hz then 1320 Hz, short. Browsers only allow
 * sound after a user gesture, so the context is created on the first tap or
 * key press and the chime stays silent until then and under reduced motion.
 */

let ctx: AudioContext | null = null;
let armed = false;

function unlock(): void {
  armed = true;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Listen for the first gesture; returns a cleanup function. */
export function armChime(): () => void {
  if (typeof window === "undefined" || armed) return () => {};
  const opts = { once: true, capture: true } as const;
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
  return () => {
    window.removeEventListener("pointerdown", unlock, opts);
    window.removeEventListener("keydown", unlock, opts);
  };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Play the two-tone chime if sound is allowed. */
export function chime(): void {
  if (!ctx || prefersReducedMotion()) return;
  const audio = ctx;
  [880, 1320].forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audio.destination);
    const t = audio.currentTime + i * 0.13;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}
