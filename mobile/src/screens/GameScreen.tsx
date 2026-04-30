import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions, StyleSheet, Pressable, Text } from 'react-native';
import { GameCanvas } from '../components/GameCanvas';
import { HUD } from '../components/HUD';
import { Joystick } from '../components/Joystick';
import { EatButton } from '../components/EatButton';
import { VendorMenu } from '../components/VendorMenu';
import {
  type GameState,
  PLAYER_SPEED,
  checkEnd,
  createState,
  eat as eatVendor,
  isVendorOpen,
  nearestVendor,
  resetForPlay,
  spawnBurst,
  timeOfDay,
} from '../core/game';
import type { MapDef, MenuItem, RunResult, Vendor } from '../core/types';
import { sfx } from '../lib/audio';
import { recordRun } from '../lib/storage';

interface Props {
  map: MapDef;
  onEnded: (result: RunResult, isNewBest: boolean, previousBest: number) => void;
  onQuit: () => void;
}

export function GameScreen({ map, onEnded, onQuit }: Props) {
  const { width: ww, height: wh } = useWindowDimensions();
  // Letterbox the canvas inside the screen, preserving the map aspect ratio.
  const aspect = map.width / map.height;
  const screenAspect = ww / wh;
  let cw = ww, ch = wh;
  if (screenAspect > aspect) cw = wh * aspect;
  else ch = ww / aspect;

  const [, force] = useState(0);
  const stateRef = useRef<GameState>(createState(map));
  const joyRef = useRef({ x: 0, y: 0 });
  const [openVendor, setOpenVendor] = useState<Vendor | null>(null);
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);
  const toastTimer = useRef(0);
  const lastTime = useRef(0);
  const tickRef = useRef(0);

  // Start a fresh run on mount and on map change
  useEffect(() => {
    stateRef.current = createState(map);
    resetForPlay(stateRef.current);
    lastTime.current = 0;
    let raf = 0;
    const loop = (now: number) => {
      const dt = lastTime.current ? Math.min(0.05, (now - lastTime.current) / 1000) : 0;
      lastTime.current = now;
      tick(dt);
      tickRef.current = now / 1000;
      force(n => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id]);

  const showToast = useCallback((msg: string, color = '#2bd4d9') => {
    setToast({ msg, color });
    toastTimer.current = 2.0;
  }, []);

  const tick = useCallback((dt: number) => {
    const s = stateRef.current;
    if (s.status !== 'playing' || openVendor) return;

    const j = joyRef.current;
    if (Math.abs(j.x) > 0.05 || Math.abs(j.y) > 0.05) {
      const n = Math.hypot(j.x, j.y) || 1;
      s.player.x += (j.x / n) * PLAYER_SPEED;
      s.player.y += (j.y / n) * PLAYER_SPEED;
      s.player.anim += dt * 12;
      if (j.x > 0.05) s.player.dir = 1;
      else if (j.x < -0.05) s.player.dir = -1;
    }
    s.player.x = Math.max(20, Math.min(s.map.width - 20, s.player.x));
    s.player.y = Math.max(20, Math.min(s.map.height - 20, s.player.y));

    s.hunger = Math.max(0, s.hunger - 1.6 * dt);
    s.coma = Math.max(0, s.coma - 1.4 * dt);
    s.elapsed += dt;
    s.comboFlash = Math.max(0, s.comboFlash - dt);

    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i]!;
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12;
      p.life -= dt * 1.2;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    if (toastTimer.current > 0) {
      toastTimer.current -= dt;
      if (toastTimer.current <= 0) setToast(null);
    }

    const result = checkEnd(s);
    if (result) finish(result);
  }, [openVendor]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(async (result: RunResult) => {
    sfx.end();
    const { isNewBest, previousBest } = await recordRun(result);
    onEnded(result, isNewBest, previousBest);
  }, [onEnded]);

  const onEat = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'playing' || openVendor) return;
    const near = nearestVendor(s);
    if (!near || near.dist > 42) return;
    const v = near.vendor;
    if (!isVendorOpen(v, timeOfDay(s))) {
      sfx.closed();
      showToast(`${v.name} is closed right now`, '#ff5a5a');
      return;
    }
    s.status = 'menu';
    s.openVendor = v;
    setOpenVendor(v);
    sfx.click();
  }, [openVendor, showToast]);

  const onCloseVendor = useCallback(() => {
    const s = stateRef.current;
    if (s.openVendor) {
      s.openVendor = null;
      if (s.status === 'menu') s.status = 'playing';
    }
    setOpenVendor(null);
  }, []);

  const onPickItem = useCallback((item: MenuItem) => {
    const s = stateRef.current;
    const v = openVendor;
    if (!v) return;
    const before = s.flavor;
    const out = eatVendor(s, v, item);
    if (!out.ok) {
      if (out.reason === 'broke') {
        sfx.broke();
        showToast(`Not enough cash for ${item.name}`, '#ff5a5a');
      } else if (out.reason === 'closed') {
        sfx.closed();
        showToast(`${v.name} is closed`, '#ff5a5a');
      }
      return;
    }
    spawnBurst(s, v.x, v.y - 20, v.color, item.emoji);
    if (item.gem) sfx.gem(); else sfx.eat();
    if (out.comboLeveled) {
      sfx.combo();
      showToast(`🎉 ${s.combo}-cuisine combo · ×1.5 flavor!`, '#ffd23f');
    } else {
      const gain = s.flavor - before;
      showToast(`${item.emoji} +${Math.round(gain)} flavor`, item.gem ? '#7cf67c' : '#2bd4d9');
    }
    onCloseVendor();
    const result = checkEnd(s);
    if (result) finish(result);
  }, [openVendor, showToast, onCloseVendor, finish]);

  return (
    <View style={styles.root}>
      <View style={[styles.canvasWrap, { width: cw, height: ch }]}>
        <GameCanvas state={stateRef.current} width={cw} height={ch} t={tickRef.current} />
      </View>

      <HUD state={stateRef.current} />

      {toast && (
        <View pointerEvents="none" style={[styles.toast, { borderColor: toast.color, shadowColor: toast.color }]}>
          <Text style={[styles.toastText, { color: toast.color }]}>{toast.msg}</Text>
        </View>
      )}

      <Pressable style={styles.quit} onPress={onQuit} hitSlop={12}>
        <Text style={styles.quitText}>✕</Text>
      </Pressable>

      <Joystick onMove={(x, y) => { joyRef.current = { x, y }; }} />
      <EatButton onPress={onEat} enabled={!openVendor} />

      <VendorMenu
        state={stateRef.current}
        vendor={openVendor}
        onEat={onPickItem}
        onClose={onCloseVendor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0518', alignItems: 'center', justifyContent: 'center' },
  canvasWrap: { borderRadius: 14, overflow: 'hidden' },
  toast: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(10, 5, 24, 0.9)',
    borderRadius: 999,
    borderWidth: 1,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    zIndex: 8,
  },
  toastText: { fontWeight: '700', fontSize: 13 },
  quit: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(10,5,24,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9,
  },
  quitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
