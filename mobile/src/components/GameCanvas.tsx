import React, { useMemo } from 'react';
import {
  Canvas,
  Group,
  Rect,
  Circle,
  RadialGradient,
  LinearGradient,
  vec,
  Text as SkText,
  Path,
  Skia,
  matchFont,
} from '@shopify/react-native-skia';
import { distance, isVendorOpen, timeOfDay, type GameState } from '../core/game';

interface Props {
  state: GameState;
  width: number;
  height: number;
  /** Animation tick (seconds, monotonic). */
  t: number;
}

export function GameCanvas({ state, width, height, t }: Props) {
  const map = state.map;
  const sx = width / map.width;
  const sy = height / map.height;
  const time = timeOfDay(state);

  const labelFont = useMemo(() => matchFont({ fontFamily: 'System', fontSize: 11, fontWeight: 'bold' as const }), []);
  const smallFont = useMemo(() => matchFont({ fontFamily: 'System', fontSize: 9, fontWeight: 'bold' as const }), []);

  const visibleVendors = useMemo(() => {
    return map.vendors.filter(v => {
      if (v.hidden) {
        const d = distance(state.player.x, state.player.y, v.x, v.y);
        return d <= 90;
      }
      return true;
    });
  }, [map.vendors, state.player.x, state.player.y]);

  return (
    <Canvas style={{ width, height }}>
      <Group transform={[{ scaleX: sx }, { scaleY: sy }]}>
        {/* Sky gradient */}
        <Rect x={0} y={0} width={map.width} height={map.height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, map.height)}
            colors={[map.theme.sky[0], map.theme.sky[1], map.theme.sky[2]]}
          />
        </Rect>

        {/* Avenue */}
        <Rect
          x={0}
          y={map.avenue.y}
          width={map.width}
          height={map.avenue.h}
          color={map.theme.streetTone}
        />

        {/* Cross streets */}
        {map.crossStreets.map(x => (
          <Rect key={`xs-${x}`} x={x} y={0} width={40} height={map.height} color={map.theme.streetTone} />
        ))}

        {/* Subway track */}
        <Rect x={0} y={map.trackY} width={map.width} height={6} color="rgba(0,0,0,0.45)" />
        {Array.from({ length: Math.ceil(map.width / 90) }).map((_, i) => (
          <Rect key={`pillar-${i}`} x={30 + i * 90} y={map.trackY} width={8} height={30} color="#0a0518" />
        ))}

        {/* Buildings */}
        {map.buildings.map((b, i) => (
          <Group key={`b-${i}`}>
            <Rect x={b.x} y={b.y} width={b.w} height={b.h}>
              <LinearGradient
                start={vec(b.x, b.y)}
                end={vec(b.x, b.y + b.h)}
                colors={[`hsl(${b.hue}, 50%, 22%)`, `hsl(${b.hue}, 60%, 12%)`]}
              />
            </Rect>
            <Rect x={b.x} y={b.y} width={b.w} height={4} color={`hsl(${b.hue}, 70%, 35%)`} />
            {/* Lit windows */}
            {windowGrid(b.x, b.y, b.w, b.h, b.hue, t)}
          </Group>
        ))}

        {/* Vendors */}
        {visibleVendors.map(v => {
          const d = distance(state.player.x, state.player.y, v.x, v.y);
          const open = isVendorOpen(v, time);
          const ringColor = open ? v.color : '#555555';
          const pulse = 1 + Math.sin(t * 2 + v.x) * 0.15;
          const r = 26 * pulse;
          return (
            <Group key={v.id}>
              {/* Glow */}
              <Circle cx={v.x} cy={v.y} r={r}>
                <RadialGradient
                  c={vec(v.x, v.y)}
                  r={r}
                  colors={[ringColor + 'cc', ringColor + '44', ringColor + '00']}
                />
              </Circle>
              {/* Stall body */}
              <Rect x={v.x - 14} y={v.y - 6} width={28} height={16} color={open ? v.color : '#3a3343'} />
              <Rect x={v.x - 14} y={v.y + 6} width={28} height={4} color="rgba(0,0,0,0.3)" />
              <Rect x={v.x - 14} y={v.y - 6} width={7} height={16} color="rgba(255,255,255,0.18)" />
              <Rect x={v.x} y={v.y - 6} width={7} height={16} color="rgba(255,255,255,0.18)" />

              {/* Name when close. Skia fonts don't render emoji reliably across platforms, so the
                  emoji sign is rendered via a native overlay (HUD) layer instead of here. */}
              {d < 110 && labelFont && (
                <SkText
                  x={v.x - 40}
                  y={v.y + 32}
                  text={v.hidden ? 'HIDDEN GEM' : v.name}
                  font={labelFont}
                  color={`rgba(255,255,255,${Math.max(0, Math.min(1, (110 - d) / 60))})`}
                />
              )}
              {!open && d < 110 && smallFont && (
                <SkText
                  x={v.x - 16}
                  y={v.y + 50}
                  text="CLOSED"
                  font={smallFont}
                  color="rgba(255,90,90,0.9)"
                />
              )}
            </Group>
          );
        })}

        {/* Hidden ripples */}
        {map.vendors
          .filter(v => v.hidden)
          .map(v => {
            const d = distance(state.player.x, state.player.y, v.x, v.y);
            if (d >= 160 || d <= 90) return null;
            const a = ((160 - d) / 70) * 0.5;
            const r = 16 + ((t * 60) % 30);
            return (
              <Circle
                key={`rip-${v.id}`}
                cx={v.x}
                cy={v.y}
                r={r}
                color={`rgba(124, 246, 124, ${a})`}
                style="stroke"
                strokeWidth={1.5}
              />
            );
          })}

        {/* Player */}
        <Player x={state.player.x} y={state.player.y} dir={state.player.dir} anim={state.player.anim} />

        {/* Particles */}
        {state.particles.map((p, i) => (
          <Circle
            key={`p-${i}`}
            cx={p.x}
            cy={p.y}
            r={p.size}
            color={p.color}
            opacity={Math.max(0, p.life / p.max)}
          />
        ))}

        {/* Vignette */}
        <Rect x={0} y={0} width={map.width} height={map.height}>
          <RadialGradient
            c={vec(map.width / 2, map.height / 2)}
            r={600}
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
          />
        </Rect>
      </Group>
    </Canvas>
  );
}

function windowGrid(bx: number, by: number, bw: number, bh: number, hue: number, t: number) {
  const els: React.ReactNode[] = [];
  for (let wx = 8; wx < bw - 8; wx += 16) {
    for (let wy = 14; wy < bh - 8; wy += 18) {
      const flicker = Math.sin((wx + wy + t * 2) * 0.07) > 0.4 ? 1 : 0.5;
      els.push(
        <Rect
          key={`w-${bx}-${by}-${wx}-${wy}`}
          x={bx + wx}
          y={by + wy}
          width={6}
          height={8}
          color={`hsla(${hue + 30}, 80%, 60%, ${0.25 * flicker})`}
        />,
      );
    }
  }
  return els;
}

function Player({ x, y, dir, anim }: { x: number; y: number; dir: 1 | -1; anim: number }) {
  const bob = Math.sin(anim) * 1.5;
  const py = y + bob;
  // Shadow path (ellipse via path so we can keep this purely declarative)
  const shadow = useMemo(() => {
    const p = Skia.Path.Make();
    p.addOval({ x: x - 9, y: y + 7, width: 18, height: 6 });
    return p;
  }, [x, y]);
  return (
    <Group>
      <Path path={shadow} color="rgba(0,0,0,0.4)" />
      <Rect x={x - 6} y={py - 4} width={12} height={12} color="#ff3d8b" />
      <Circle cx={x} cy={py - 8} r={5} color="#f4c8a8" />
      <Rect x={x - 5} y={py - 12} width={10} height={3} color="#2bd4d9" />
      <Rect x={x - 6} y={py - 10} width={4 * dir} height={2} color="#2bd4d9" />
      <Rect x={x + 4 * dir} y={py} width={5} height={6} color="#ffd23f" />
      <Rect x={x + (dir > 0 ? 1 : -2)} y={py - 8} width={1.5} height={1.5} color="#1a0b2e" />
    </Group>
  );
}
