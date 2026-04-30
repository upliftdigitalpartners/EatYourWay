import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAP_LIST } from '../core/data/maps';
import type { MapDef, RunResult } from '../core/types';
import { allBests } from '../lib/storage';
import { sfx } from '../lib/audio';
import { isSupabaseEnabled } from '../lib/supabase';

interface Props {
  onPickMap: (m: MapDef) => void;
  onOpenLeaderboard: () => void;
}

export function TitleScreen({ onPickMap, onOpenLeaderboard }: Props) {
  const [bests, setBests] = useState<Partial<Record<MapDef['id'], RunResult>>>({});

  useEffect(() => {
    allBests().then(setBests);
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Eat Your Way</Text>
        <Text style={styles.tag}>A vibrant food crawl across NYC</Text>
        <Text style={styles.controls}>
          Walk with the joystick · Tap EAT near a vendor{'\n'}
          Find hidden gems · Combo 3+ cuisines for ×1.5 flavor
        </Text>

        <View style={styles.picker}>
          {MAP_LIST.map(m => {
            const best = bests[m.id];
            return (
              <Pressable
                key={m.id}
                onPress={() => { sfx.click(); onPickMap(m); }}
                style={({ pressed }) => [
                  styles.tile,
                  m.id === 'jackson-heights' ? styles.jh : styles.fl,
                  pressed && { transform: [{ translateY: -2 }] },
                ]}
              >
                <Text style={styles.tileName}>{m.name}</Text>
                <Text style={styles.tileSub}>{m.subtitle}</Text>
                <Text style={[styles.tileBest, !best && styles.tileBestEmpty]}>
                  {best ? `🏆 best: ${best.flavor} · ${best.rank}` : 'no runs yet'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isSupabaseEnabled() && (
          <Pressable style={styles.ldrBtn} onPress={onOpenLeaderboard}>
            <Text style={styles.ldrText}>🏆 Global Leaderboard</Text>
          </Pressable>
        )}

        {!isSupabaseEnabled() && (
          <Text style={styles.note}>
            (Set EXPO_PUBLIC_SUPABASE_URL + ANON_KEY to enable global leaderboards)
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0518' },
  container: { padding: 24, alignItems: 'center', minHeight: '100%' },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: '#ff3d8b',
    marginTop: 24,
    letterSpacing: -2,
  },
  tag: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 24,
  },
  controls: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },
  picker: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  tile: {
    flex: 1,
    minWidth: 200,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
  },
  jh: { borderColor: 'rgba(255, 61, 139, 0.4)' },
  fl: { borderColor: 'rgba(43, 212, 217, 0.4)' },
  tileName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tileSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  tileBest: { color: '#ffd23f', fontSize: 12, fontWeight: '700', marginTop: 8 },
  tileBestEmpty: { color: 'rgba(255,255,255,0.4)', fontWeight: '400' },
  ldrBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    marginTop: 8,
  },
  ldrText: { color: '#fff', fontWeight: '700' },
  note: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 16,
    textAlign: 'center',
  },
});
