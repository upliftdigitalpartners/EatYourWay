import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GameState } from '../core/game';
import { COMBO_THRESHOLD, RUN_DURATION_SEC, timeOfDay } from '../core/game';

export function HUD({ state }: { state: GameState }) {
  const remain = Math.max(0, RUN_DURATION_SEC - state.elapsed);
  const m = Math.floor(remain / 60);
  const s = Math.floor(remain % 60).toString().padStart(2, '0');
  const tod = timeOfDay(state);
  const mult = state.combo >= COMBO_THRESHOLD ? 1.5 : 1;

  return (
    <View style={styles.hud} pointerEvents="none">
      <Stat icon="💰" label={`$${Math.round(state.cash)}`} color="#ffd23f" />
      <Bar icon="🍴" pct={Math.max(0, state.hunger)} color="#ff7a3d" />
      <Bar icon="😵" pct={Math.min(100, state.coma)} color="#ff3d8b" />
      <Bar icon="✨" pct={Math.min(100, state.flavor / 3)} color="#2bd4d9" />
      <Stat icon="🏆" label={String(Math.round(state.flavor))} color="#7cf67c" />
      <Stat icon="🕒" label={`${tod} · ${m}:${s}`} color="#ff3d8b" />
      <View style={[styles.combo, state.comboFlash > 0 && styles.comboFlash]}>
        <Text style={styles.comboText}>{state.combo}/{COMBO_THRESHOLD}+ · ×{mult}</Text>
      </View>
    </View>
  );
}

function Stat({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

function Bar({ icon, pct, color }: { icon: string; pct: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color, shadowColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    zIndex: 5,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,5,24,0.78)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  icon: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: '700' },
  barTrack: {
    width: 60,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  combo: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 210, 63, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 210, 63, 0.4)',
  },
  comboFlash: {
    transform: [{ scale: 1.15 }],
    shadowColor: '#ffd23f',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  comboText: { color: '#ffd23f', fontWeight: '800', fontSize: 12 },
});
