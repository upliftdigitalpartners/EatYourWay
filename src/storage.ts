import type { RunResult } from './core/types';

const KEY = 'curbside:scores:v1';

interface Store {
  best: RunResult | null;
  history: RunResult[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { best: null, history: [] };
    const parsed = JSON.parse(raw) as Store;
    return {
      best: parsed.best ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { best: null, history: [] };
  }
}

function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Private mode or quota exhausted — scores are a nicety, not a requirement.
  }
}

export function recordRun(result: RunResult): { isNewBest: boolean; previousBest: number } {
  const store = load();
  const previousBest = store.best?.flavor ?? 0;
  const isNewBest = result.flavor > previousBest;
  if (isNewBest) store.best = result;
  store.history.unshift(result);
  store.history = store.history.slice(0, 20);
  save(store);
  return { isNewBest, previousBest };
}

export function bestRun(): RunResult | null {
  return load().best;
}
