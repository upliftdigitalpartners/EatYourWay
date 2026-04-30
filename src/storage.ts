import type { MapDef, RunResult } from './types';

const KEY = 'eyw:scores:v1';

interface Store {
  best: Partial<Record<MapDef['id'], RunResult>>;
  history: RunResult[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { best: {}, history: [] };
    const parsed = JSON.parse(raw) as Store;
    return {
      best: parsed.best ?? {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { best: {}, history: [] };
  }
}

function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage may be unavailable (private mode, quota) — silent fail is fine.
  }
}

export function recordRun(result: RunResult): { isNewBest: boolean; previousBest: number } {
  const store = load();
  const prev = store.best[result.mapId];
  const isNewBest = !prev || result.flavor > prev.flavor;
  if (isNewBest) store.best[result.mapId] = result;
  store.history.unshift(result);
  store.history = store.history.slice(0, 20);
  save(store);
  return { isNewBest, previousBest: prev?.flavor ?? 0 };
}

export function bestFor(mapId: MapDef['id']): RunResult | null {
  return load().best[mapId] ?? null;
}

export function allBests(): Partial<Record<MapDef['id'], RunResult>> {
  return load().best;
}
