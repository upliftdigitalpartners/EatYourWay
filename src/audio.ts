/** Tiny synthesized SFX layer. No assets — just oscillators. */

type AudioCtxLike = AudioContext;

let ctx: AudioCtxLike | null = null;
let muted = false;

function ensureCtx(): AudioCtxLike | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(m: boolean): void { muted = m; }
export function isMuted(): boolean { return muted; }

function blip(freq: number, duration: number, type: OscillatorType, gain = 0.06): void {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export const sfx = {
  eat: () => {
    blip(420, 0.08, 'square');
    setTimeout(() => blip(640, 0.08, 'square'), 60);
  },
  gem: () => {
    blip(660, 0.1, 'triangle', 0.08);
    setTimeout(() => blip(990, 0.12, 'triangle', 0.08), 80);
    setTimeout(() => blip(1320, 0.16, 'triangle', 0.06), 180);
  },
  combo: () => {
    blip(523, 0.08, 'sawtooth', 0.05);
    setTimeout(() => blip(659, 0.08, 'sawtooth', 0.05), 70);
    setTimeout(() => blip(784, 0.12, 'sawtooth', 0.05), 140);
  },
  closed: () => blip(160, 0.18, 'sawtooth', 0.05),
  broke: () => blip(120, 0.25, 'sawtooth', 0.05),
  end: () => {
    blip(330, 0.18, 'triangle', 0.06);
    setTimeout(() => blip(220, 0.32, 'triangle', 0.06), 180);
  },
  click: () => blip(800, 0.04, 'square', 0.03),
};
