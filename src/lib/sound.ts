/**
 * Lightweight sound alerts using the Web Audio API (zero dependencies, no
 * audio files needed). Generates a short pleasant chime for reminders.
 *
 * Falls back silently if AudioContext is unavailable (e.g. SSR, older
 * browsers, or if the user hasn't interacted with the page yet — browser
 * autoplay policy requires a user gesture before audio).
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a short two-tone chime (C5 → E5 → G5 arpeggio, ~0.4s).
 * Pleasant and noticeable without being jarring.
 */
export function playChime(): void {
  const ctx = getCtx();
  if (!ctx) return;

  // Browser autoplay policy: AudioContext may start "suspended" until a user
  // gesture. Try to resume; if it fails, the chime just won't play (no crash).
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => { /* ignore */ });
  }

  const now = ctx.currentTime;
  // Three notes: C5 (523.25), E5 (659.25), G5 (783.99) — a major triad chime.
  const notes = [523.25, 659.25, 783.99];
  const noteDur = 0.12;
  const gap = 0.04;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * (noteDur + gap);
    // Envelope: attack 10ms → sustain → decay 60ms.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.setValueAtTime(0.18, start + noteDur - 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + noteDur + 0.02);
  });
}

/**
 * Play a softer single-tone ping (for less urgent notifications).
 */
export function playPing(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880; // A5
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.32);
}

/**
 * Ensure audio is "unlocked" by playing a silent buffer on the first user
 * gesture. Call this on pet click/drag so subsequent chimes actually play.
 * (Browsers block audio until a user interacts with the page.)
 */
export function unlockAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => { /* ignore */ });
  }
}
