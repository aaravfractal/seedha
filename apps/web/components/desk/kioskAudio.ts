/**
 * Kiosk sound: the same two-tone chime as the front desk page (880 Hz then 1320 Hz),
 * made with Web Audio, no audio files. Browsers allow sound only after a tap,
 * so the context is created by the "Sound" button and stays null until then.
 */

let ctx: AudioContext | null = null;

/** Create or resume the audio context. Call from a tap or key press. */
export function unlockAudio(): boolean {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return false;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

/** Play the chime if the context is unlocked. */
export function playChime(): void {
  if (!ctx) return;
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
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}
