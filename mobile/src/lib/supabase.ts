import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MapDef, RunResult } from '../core/types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;

/** True when env vars are configured. Leaderboard features no-op when false. */
export function isSupabaseEnabled(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

function getClient(): SupabaseClient | null {
  if (!isSupabaseEnabled()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface LeaderboardRow {
  client_id: string;
  handle: string;
  map_id: MapDef['id'];
  flavor: number;
  combo_max: number;
  bites: number;
  gems: number;
  rank: string;
  created_at: string;
}

/** Submit a run to the leaderboard. Silently no-ops if Supabase is not configured. */
export async function submitRun(
  result: RunResult,
  player: { clientId: string; handle: string },
): Promise<{ ok: boolean; error?: string }> {
  const c = getClient();
  if (!c) return { ok: false, error: 'supabase-not-configured' };

  const { error } = await c.from('runs').insert({
    client_id: player.clientId,
    handle: player.handle,
    map_id: result.mapId,
    flavor: result.flavor,
    combo_max: result.comboMax,
    bites: result.bites,
    gems: result.gems,
    cuisines: result.cuisinesTried,
    rank: result.rank,
    spent: result.spent,
    ended_reason: result.endedReason,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Top N runs for a given map, ordered by flavor descending. */
export async function fetchLeaderboard(
  mapId: MapDef['id'],
  limit = 20,
): Promise<LeaderboardRow[]> {
  const c = getClient();
  if (!c) return [];

  const { data, error } = await c
    .from('top_runs')
    .select('*')
    .eq('map_id', mapId)
    .order('flavor', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as LeaderboardRow[];
}

/** A given player's best run for each map. */
export async function fetchPlayerBests(clientId: string): Promise<LeaderboardRow[]> {
  const c = getClient();
  if (!c) return [];

  const { data, error } = await c
    .from('top_runs')
    .select('*')
    .eq('client_id', clientId);

  if (error || !data) return [];
  return data as LeaderboardRow[];
}
