import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MapDef, RunResult } from '../core/types';

const KEY = 'eyw:scores:v1';
const PLAYER_KEY = 'eyw:player:v1';

interface Store {
  best: Partial<Record<MapDef['id'], RunResult>>;
  history: RunResult[];
}

interface PlayerInfo {
  /** Stable client-generated ID used for leaderboard attribution. */
  clientId: string;
  /** Display name shown on leaderboards. */
  handle: string;
}

async function loadStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
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

async function saveStore(store: Store): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* swallow */
  }
}

export async function recordRun(result: RunResult): Promise<{ isNewBest: boolean; previousBest: number }> {
  const store = await loadStore();
  const prev = store.best[result.mapId];
  const isNewBest = !prev || result.flavor > prev.flavor;
  if (isNewBest) store.best[result.mapId] = result;
  store.history.unshift(result);
  store.history = store.history.slice(0, 20);
  await saveStore(store);
  return { isNewBest, previousBest: prev?.flavor ?? 0 };
}

export async function bestFor(mapId: MapDef['id']): Promise<RunResult | null> {
  return (await loadStore()).best[mapId] ?? null;
}

export async function allBests(): Promise<Partial<Record<MapDef['id'], RunResult>>> {
  return (await loadStore()).best;
}

export async function getPlayer(): Promise<PlayerInfo> {
  try {
    const raw = await AsyncStorage.getItem(PLAYER_KEY);
    if (raw) return JSON.parse(raw) as PlayerInfo;
  } catch { /* fall through */ }
  const player: PlayerInfo = {
    clientId: generateId(),
    handle: defaultHandle(),
  };
  await AsyncStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  return player;
}

export async function setHandle(handle: string): Promise<PlayerInfo> {
  const cur = await getPlayer();
  const updated = { ...cur, handle: handle.slice(0, 24) || cur.handle };
  await AsyncStorage.setItem(PLAYER_KEY, JSON.stringify(updated));
  return updated;
}

function generateId(): string {
  // 16 random bytes → hex
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function defaultHandle(): string {
  const adjectives = ['Hangry', 'Spicy', 'Saucy', 'Crispy', 'Toasty', 'Salty', 'Buttery'];
  const nouns = ['Crawler', 'Snacker', 'Wanderer', 'Grazer', 'Forager', 'Glutton'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)]!;
  const n = nouns[Math.floor(Math.random() * nouns.length)]!;
  const num = Math.floor(Math.random() * 99);
  return `${a}${n}${num}`;
}
