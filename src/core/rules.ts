/** Pure game rules. No DOM, no three.js, no physics — so this module is the
 *  single source of truth shared by the 3D client, the importer's balance
 *  checks, and (once ported) the mobile client. */

import type { Cuisine, EatenItem, MenuItem, RunResult, TimeOfDay, Vendor } from './types';

export const STARTING_CASH = 120;
export const STARTING_HUNGER = 80;

/** An open-world crawl runs longer than the old single-block game because
 *  getting across the city is now part of the challenge. */
export const RUN_DURATION_SEC = 720;

export const HUNGER_DECAY = 1.0;
export const COMA_DECAY = 1.2;

export const COMBO_THRESHOLD = 3;
export const COMBO_MULTIPLIER = 1.5;

/** Each district beyond the first adds this much to the flavor multiplier.
 *  This is what makes vehicles worth taking: spreading a crawl across the
 *  boroughs pays more than clearing one block. */
export const DISTRICT_BONUS = 0.12;

/** How close you must be to a vendor to order, in metres. */
export const INTERACT_RANGE = 9;

/** How close you must be to a parked vehicle to get in, in metres. */
export const VEHICLE_RANGE = 5;

/** Hidden vendors reveal themselves inside this radius, in metres. */
export const DISCOVER_RANGE = 60;

export type GameStatus = 'title' | 'playing' | 'menu' | 'ended';

export interface RunState {
  status: GameStatus;
  cash: number;
  hunger: number;
  coma: number;
  flavor: number;
  eaten: EatenItem[];
  cuisinesTried: Set<Cuisine>;
  districtsVisited: Set<string>;
  discovered: Set<string>;
  combo: number;
  comboMax: number;
  comboFlash: number;
  elapsed: number;
  /** Metres travelled keyed by vehicle id ('foot', 'sedan', 'heli', ...). */
  distanceByMode: Record<string, number>;
  openVendor: Vendor | null;
  endReason: string | null;
}

export function createRun(): RunState {
  return {
    status: 'title',
    cash: STARTING_CASH,
    hunger: STARTING_HUNGER,
    coma: 0,
    flavor: 0,
    eaten: [],
    cuisinesTried: new Set(),
    districtsVisited: new Set(),
    discovered: new Set(),
    combo: 0,
    comboMax: 0,
    comboFlash: 0,
    elapsed: 0,
    distanceByMode: {},
    openVendor: null,
    endReason: null,
  };
}

export function resetRun(run: RunState): void {
  const fresh = createRun();
  Object.assign(run, fresh, { status: 'playing' as GameStatus });
}

export function timeOfDay(run: RunState): TimeOfDay {
  const t = run.elapsed / RUN_DURATION_SEC;
  if (t < 0.4) return 'afternoon';
  if (t < 0.75) return 'evening';
  return 'late-night';
}

export function dayProgress(run: RunState): number {
  return Math.min(1, run.elapsed / RUN_DURATION_SEC);
}

export function isVendorOpen(vendor: Vendor, time: TimeOfDay): boolean {
  return vendor.openAt.includes(time);
}

/** Current flavor multiplier from the combo and district bonuses. */
export function flavorMultiplier(run: RunState): number {
  const combo = run.combo >= COMBO_THRESHOLD ? COMBO_MULTIPLIER : 1;
  const districts = 1 + Math.max(0, run.districtsVisited.size - 1) * DISTRICT_BONUS;
  return combo * districts;
}

export interface EatOutcome {
  ok: boolean;
  reason?: 'broke' | 'closed';
  flavorGained?: number;
  comboLeveled?: boolean;
  newDistrict?: boolean;
}

export function eat(run: RunState, vendor: Vendor, item: MenuItem): EatOutcome {
  if (!isVendorOpen(vendor, timeOfDay(run))) return { ok: false, reason: 'closed' };
  if (item.price > run.cash) return { ok: false, reason: 'broke' };

  run.cash -= item.price;
  run.hunger = Math.min(100, run.hunger + item.hunger);
  run.coma += item.coma;

  const beforeCuisines = run.cuisinesTried.size;
  run.cuisinesTried.add(vendor.cuisine);
  run.combo = run.cuisinesTried.size;
  if (run.combo > run.comboMax) run.comboMax = run.combo;
  const comboLeveled = run.cuisinesTried.size > beforeCuisines && run.combo >= COMBO_THRESHOLD;

  const beforeDistricts = run.districtsVisited.size;
  run.districtsVisited.add(vendor.district);
  const newDistrict = run.districtsVisited.size > beforeDistricts && beforeDistricts > 0;

  let gain = item.flavor;
  if (item.gem) gain *= 1.5;
  gain = Math.round(gain * flavorMultiplier(run));

  run.flavor += gain;
  run.eaten.push({
    name: item.name,
    emoji: item.emoji,
    price: item.price,
    flavor: gain,
    cuisine: vendor.cuisine,
    gem: !!item.gem,
  });

  if (comboLeveled || newDistrict) run.comboFlash = 1.2;

  return { ok: true, flavorGained: gain, comboLeveled, newDistrict };
}

/** Advance survival stats. Movement is handled by the physics layer; this only
 *  tracks the consequences of time passing. */
export function tickRun(run: RunState, dt: number): void {
  if (run.status !== 'playing') return;
  run.hunger = Math.max(0, run.hunger - HUNGER_DECAY * dt);
  run.coma = Math.max(0, run.coma - COMA_DECAY * dt);
  run.elapsed += dt;
  run.comboFlash = Math.max(0, run.comboFlash - dt);
}

export function addDistance(run: RunState, mode: string, metres: number): void {
  if (metres <= 0 || !Number.isFinite(metres)) return;
  run.distanceByMode[mode] = (run.distanceByMode[mode] ?? 0) + metres;
}

export function totalDistance(run: RunState): number {
  return Object.values(run.distanceByMode).reduce((a, b) => a + b, 0);
}

export function checkEnd(run: RunState, worldName: string): RunResult | null {
  let reason: string | null = null;
  if (run.coma >= 100) reason = 'Food coma. You napped in the passenger seat.';
  else if (run.hunger <= 0 && run.cash < 3) reason = 'Hangry and broke. You went looking for an ATM.';
  else if (run.elapsed >= RUN_DURATION_SEC) reason = 'Last call. The city tapped out before you did.';
  if (!reason) return null;

  run.endReason = reason;
  run.status = 'ended';

  return {
    worldName,
    flavor: Math.round(run.flavor),
    spent: STARTING_CASH - run.cash,
    bites: run.eaten.length,
    gems: run.eaten.filter(e => e.gem).length,
    comboMax: run.comboMax,
    cuisinesTried: Array.from(run.cuisinesTried),
    districtsVisited: Array.from(run.districtsVisited),
    distanceByMode: { ...run.distanceByMode },
    rank: computeRank(run.flavor, run.comboMax, run.districtsVisited.size),
    endedReason: reason,
    date: new Date().toISOString(),
  };
}

export function computeRank(flavor: number, comboMax: number, districts: number): string {
  if (flavor > 900 && comboMax >= 6 && districts >= 4) return 'Five Borough Legend';
  if (flavor > 600 && comboMax >= 5) return 'Citywide Connoisseur';
  if (flavor > 380 && districts >= 3) return 'Cross-Borough Crawler';
  if (flavor > 200) return 'Neighbourhood Regular';
  if (flavor > 90) return 'Curb Crawler';
  return 'Snacker';
}
