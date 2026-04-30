import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchLeaderboard, type LeaderboardRow } from '../lib/supabase';
import { MAP_LIST } from '../core/data/maps';
import type { MapDef } from '../core/types';

interface Props {
  onClose: () => void;
}

export function LeaderboardScreen({ onClose }: Props) {
  const [mapId, setMapId] = useState<MapDef['id']>('jackson-heights');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard(mapId, 25).then(r => {
      setRows(r);
      setLoading(false);
    });
  }, [mapId]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Leaderboard</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {MAP_LIST.map(m => (
          <Pressable
            key={m.id}
            onPress={() => setMapId(m.id)}
            style={[styles.tab, mapId === m.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, mapId === m.id && styles.tabTextActive]}>{m.name}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff3d8b" />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No runs yet. Be the first.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {rows.map((row, i) => (
            <View key={`${row.client_id}-${i}`} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.handle}>{row.handle}</Text>
                <Text style={styles.meta}>
                  {row.rank} · {row.bites} bites · {row.combo_max}× combo
                </Text>
              </View>
              <Text style={styles.score}>{row.flavor}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0518' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  close: { color: '#fff', fontSize: 22, padding: 4 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: { backgroundColor: '#ff3d8b', borderColor: '#ff3d8b' },
  tabText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: 'rgba(255,255,255,0.5)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
  },
  rank: { color: '#ffd23f', fontWeight: '800', fontSize: 16, width: 28, textAlign: 'right' },
  handle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  meta: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  score: { color: '#2bd4d9', fontWeight: '900', fontSize: 22 },
});
