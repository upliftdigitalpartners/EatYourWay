import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MapDef, RunResult } from '../core/types';
import { sfx } from '../lib/audio';
import { captureAndShare } from '../lib/share';
import { fetchPlayerBests, isSupabaseEnabled, submitRun } from '../lib/supabase';
import { getPlayer } from '../lib/storage';

interface Props {
  result: RunResult;
  map: MapDef;
  isNewBest: boolean;
  previousBest: number;
  onPlayAgain: () => void;
  onChangeMap: () => void;
}

export function EndScreen({ result, map, isNewBest, previousBest, onPlayAgain, onChangeMap }: Props) {
  const cardRef = useRef<View>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const title = result.endedReason.includes('coma') ? 'Food Coma 😴'
              : result.endedReason.includes('Hangry') ? 'Hangry & Broke 💸'
              : 'Last Train 🚇';

  // Auto-submit to leaderboard if Supabase is configured
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseEnabled()) return;
      setSubmitting(true);
      const player = await getPlayer();
      const out = await submitRun(result, player);
      if (cancelled) return;
      setSubmitting(false);
      if (out.ok) setSubmitMsg('Submitted to leaderboard ✓');
      else if (out.error === 'rate-limited') setSubmitMsg(null);
      else setSubmitMsg('Could not submit run');
      void fetchPlayerBests; // referenced for future profile screen
    })();
    return () => { cancelled = true; };
  }, [result]);

  const onShare = async () => {
    sfx.click();
    await captureAndShare(
      cardRef,
      `I scored ${result.flavor} on ${map.name} — ${result.rank}. Eat Your Way.`,
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <View ref={cardRef} collapsable={false} style={styles.card}>
          <Text style={styles.heading}>{title}</Text>
          {isNewBest && <Text style={styles.newBest}>NEW PERSONAL BEST</Text>}
          <Text style={styles.bigNum}>{result.flavor}</Text>
          <Text style={styles.bigLabel}>FLAVOR SCORE</Text>

          <Text style={styles.rank}>{result.rank}</Text>

          <View style={styles.statsRow}>
            <Stat label="BITES" val={String(result.bites)} />
            <Stat label="GEMS" val={String(result.gems)} />
            <Stat label="COMBO" val={`${result.comboMax}×`} />
            <Stat label="SPENT" val={`$${result.spent}`} />
          </View>

          <View style={styles.cuisines}>
            {result.cuisinesTried.map(c => (
              <View key={c} style={styles.pill}>
                <Text style={styles.pillText}>{c}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.endedReason}>{result.endedReason}</Text>
          {!isNewBest && previousBest > 0 && (
            <Text style={styles.runnerUp}>
              {previousBest - result.flavor > 0
                ? `${previousBest - result.flavor} short of your best (${previousBest})`
                : 'Tied your best.'}
            </Text>
          )}

          <Text style={styles.brand}>eatyourway · {map.subtitle}</Text>
        </View>

        {submitting && <Text style={styles.submitMsg}>Submitting...</Text>}
        {submitMsg && <Text style={styles.submitMsg}>{submitMsg}</Text>}

        <View style={styles.actions}>
          <Pressable style={styles.btnPrimary} onPress={() => { sfx.click(); onPlayAgain(); }}>
            <Text style={styles.btnText}>Eat Again 🌮</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => { sfx.click(); onChangeMap(); }}>
            <Text style={styles.btnText}>Change Map 🗺️</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={onShare}>
            <Text style={styles.btnText}>Share 📸</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, val }: { label: string; val: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{val}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0518' },
  container: { padding: 16, alignItems: 'center', paddingBottom: 40 },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1a0b2e',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
    alignItems: 'center',
    marginTop: 12,
  },
  heading: { color: '#fff', fontSize: 24, fontWeight: '800' },
  newBest: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#ffd23f',
    color: '#1a0b2e',
    fontSize: 12,
    fontWeight: '800',
    borderRadius: 999,
    letterSpacing: 1,
    overflow: 'hidden',
  },
  bigNum: { color: '#2bd4d9', fontSize: 80, fontWeight: '900', marginTop: 12, lineHeight: 90 },
  bigLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, letterSpacing: 1 },
  rank: { marginTop: 14, color: '#ffd23f', fontWeight: '800', fontSize: 18 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
  },
  stat: { alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 26, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1, marginTop: 2 },
  cuisines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 14,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(43, 212, 217, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(43, 212, 217, 0.6)',
  },
  pillText: { color: '#a5f0f3', fontSize: 11, fontWeight: '700' },
  endedReason: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 13,
  },
  runnerUp: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 6 },
  brand: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 12, fontWeight: '600' },
  submitMsg: { color: 'rgba(255,255,255,0.6)', marginTop: 10, fontSize: 12 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  btnPrimary: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    backgroundColor: '#ff3d8b',
    borderRadius: 999,
  },
  btnSecondary: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 999,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
