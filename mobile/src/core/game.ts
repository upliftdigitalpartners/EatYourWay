import type { Cuisine, EatenItem, MapDef, MenuItem, RunResult, TimeOfDay, Vendor } from './types';

export const STARTING_CASH = 40;
export const STARTING_HUNGER = 80;
export const PLAYER_SPEED = 2.6;
/** Total length of an in-game crawl. After this elapses you "tap out" — game ends. */
export const RUN_DURATION_SEC = 180;
/** Hunger drained per second. */
export const HUNGER_DECAY = 1.6;
/** Coma decayed per second when not eating. */
export const COMA_DECAY = 1.4;
/** Number of distinct cuisines required to activate a combo. */
export const COMBO_THRESHOLD = 3;
/** Bonus multiplier applied to flavor when combo is active. */
export const COMBO_MULTIPLIER = 1.5;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  emoji: string | null;
  size: number;
}

export type GameStatus = 'title' | 'playing' | 'menu' | 'ended';

export interface GameState {
  map: MapDef;
  status: GameStatus;
  player: { x: number; y: number; dir: 1 | -1; anim: number };
  cash: number;
  hunger: number;
  coma: number;
  flavor: number;
  eaten: EatenItem[];
  /** Distinct cuisines tasted during this run. */
  cuisinesTried: Set<Cuisine>;
  /** Current combo size (count of distinct cuisines). */
  combo: number;
  /** Maximum combo size reached during this run. */
  comboMax: number;
  /** True if the combo just leveled up — render a flash. */
  comboFlash: number;
  /** Seconds elapsed within this run. */
  elapsed: number;
  particles: Particle[];
  openVendor: Vendor | null;
  endReason: string | null;
}

export function createState(map: MapDef): GameState {
  return {
    map,
    status: 'title',
    player: { x: map.width / 2, y: map.height / 2, dir: 1, anim: 0 },
    cash: STARTING_CASH,
    hunger: STARTING_HUNGER,
    coma: 0,
    flavor: 0,
    eaten: [],
    cuisinesTried: new Set(),
    combo: 0,
    comboMax: 0,
    comboFlash: 0,
    elapsed: 0,
    particles: [],
    openVendor: null,
    endReason: null,
  };
}

export function resetForPlay(state: GameState): void {
  state.status = 'playing';
  state.player.x = state.map.width / 2;
  state.player.y = state.map.height / 2;
  state.cash = STARTING_CASH;
  state.hunger = STARTING_HUNGER;
  state.coma = 0;
  state.flavor = 0;
  state.eaten = [];
  state.cuisinesTried = new Set();
  state.combo = 0;
  state.comboMax = 0;
  state.comboFlash = 0;
  state.elapsed = 0;
  state.particles = [];
  state.openVendor = null;
  state.endReason = null;
}

/** Returns the in-game time of day based on elapsed seconds in the current run. */
export function timeOfDay(state: GameState): TimeOfDay {
  const t = state.elapsed / RUN_DURATION_SEC;
  if (t < 0.4) return 'afternoon';
  if (t < 0.75) return 'evening';
  return 'late-night';
}

/** 0..1 progress through the day, used to tint the sky. */
export function dayProgress(state: GameState): number {
  return Math.min(1, state.elapsed / RUN_DURATION_SEC);
}

export function isVendorOpen(vendor: Vendor, time: TimeOfDay): boolean {
  return vendor.openAt.includes(time);
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function nearestVendor(state: GameState): { vendor: Vendor; dist: number } | null {
  let best: Vendor | null = null;
  let bestD = Infinity;
  for (const v of state.map.vendors) {
    const d = distance(state.player.x, state.player.y, v.x, v.y);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best ? { vendor: best, dist: bestD } : null;
}

export interface EatOutcome {
  ok: boolean;
  reason?: 'broke' | 'closed' | 'unknown';
  flavorGained?: number;
  comboLeveled?: boolean;
  comaCapped?: boolean;
}

export function eat(state: GameState, vendor: Vendor, item: MenuItem): EatOutcome {
  const time = timeOfDay(state);
  if (!isVendorOpen(vendor, time)) return { ok: false, reason: 'closed' };
  if (item.price > state.cash) return { ok: false, reason: 'broke' };

  state.cash -= item.price;
  state.hunger = Math.min(100, state.hunger + item.hunger);
  state.coma += item.coma;

  const beforeCount = state.cuisinesTried.size;
  state.cuisinesTried.add(vendor.cuisine);
  const afterCount = state.cuisinesTried.size;
  state.combo = afterCount;
  if (afterCount > state.comboMax) state.comboMax = afterCount;
  const comboLeveled = afterCount > beforeCount && afterCount >= COMBO_THRESHOLD;

  let gain = item.flavor;
  if (item.gem) gain *= 1.5;
  if (state.combo >= COMBO_THRESHOLD) gain *= COMBO_MULTIPLIER;
  gain = Math.round(gain);

  state.flavor += gain;
  state.eaten.push({
    name: item.name,
    emoji: item.emoji,
    price: item.price,
    flavor: gain,
    cuisine: vendor.cuisine,
    gem: !!item.gem,
  });

  if (comboLeveled) state.comboFlash = 1.2;

  return { ok: true, flavorGained: gain, comboLeveled, comaCapped: state.coma >= 100 };
}

export function tickPhysics(state: GameState, dt: number, move: { vx: number; vy: number }, speed: number): void {
  if (state.status !== 'playing') return;

  if (move.vx || move.vy) {
    const n = Math.hypot(move.vx, move.vy) || 1;
    state.player.x += (move.vx / n) * speed;
    state.player.y += (move.vy / n) * speed;
    state.player.anim += dt * 12;
    if (move.vx > 0.05) state.player.dir = 1;
    else if (move.vx < -0.05) state.player.dir = -1;
  }
  state.player.x = Math.max(20, Math.min(state.map.width - 20, state.player.x));
  state.player.y = Math.max(20, Math.min(state.map.height - 20, state.player.y));

  state.hunger = Math.max(0, state.hunger - HUNGER_DECAY * dt);
  state.coma = Math.max(0, state.coma - COMA_DECAY * dt);
  state.elapsed += dt;
  state.comboFlash = Math.max(0, state.comboFlash - dt);

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]!;
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.12;
    p.life -= dt * 1.2;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

export function checkEnd(state: GameState): RunResult | null {
  let reason: string | null = null;
  if (state.coma >= 100) reason = 'Food coma. You napped on a bench.';
  else if (state.hunger <= 0 && state.cash < 2) reason = 'Hangry & broke. You wandered off to find an ATM.';
  else if (state.elapsed >= RUN_DURATION_SEC) reason = 'Last train called. You tapped out.';
  if (!reason) return null;

  state.endReason = reason;
  state.status = 'ended';

  const rank = computeRank(state.flavor, state.comboMax);
  return {
    mapId: state.map.id,
    flavor: Math.round(state.flavor),
    spent: STARTING_CASH - state.cash,
    bites: state.eaten.length,
    gems: state.eaten.filter(e => e.gem).length,
    comboMax: state.comboMax,
    cuisinesTried: Array.from(state.cuisinesTried),
    rank,
    endedReason: reason,
    date: new Date().toISOString(),
  };
}

export function computeRank(flavor: number, comboMax: number): string {
  if (flavor > 220 && comboMax >= 4) return '👑 Roosevelt Royalty';
  if (flavor > 160) return '🌶️ Connoisseur';
  if (flavor > 90) return '🍴 Crawler';
  return '🥄 Snacker';
}

export function spawnBurst(state: GameState, x: number, y: number, color: string, emoji: string | null): void {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 3;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 1,
      life: 1, max: 1,
      color,
      emoji: emoji && Math.random() < 0.3 ? emoji : null,
      size: 2 + Math.random() * 3,
    });
  }
}
