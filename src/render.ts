import type { GameState } from './game';
import { dayProgress, distance, isVendorOpen, timeOfDay } from './game';

const TILE = 32;

/** Lerp two hex colors. */
function lerpHex(a: string, b: string, t: number): string {
  const ah = a.replace('#', '');
  const bh = b.replace('#', '');
  const ar = parseInt(ah.slice(0, 2), 16), ag = parseInt(ah.slice(2, 4), 16), ab = parseInt(ah.slice(4, 6), 16);
  const br = parseInt(bh.slice(0, 2), 16), bg = parseInt(bh.slice(2, 4), 16), bb = parseInt(bh.slice(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, t: number): void {
  const { width: W, height: H } = state.map;
  const time = timeOfDay(state);
  const prog = dayProgress(state);

  // Sky gradient — shifts darker as the day progresses
  const [sky1, sky2, sky3] = state.map.theme.sky;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, lerpHex(sky1, '#0a0518', prog * 0.5));
  grad.addColorStop(0.6, sky2);
  grad.addColorStop(1, sky3);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += TILE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += TILE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  drawStreets(ctx, state);
  drawBuildings(ctx, state, t, prog);
  drawHiddenRipples(ctx, state, t);
  drawVendors(ctx, state, t, time);
  drawPlayer(ctx, state);
  drawParticles(ctx, state);

  // Vignette + nighttime darkening
  const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 600);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${0.5 + prog * 0.2})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawStreets(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { avenue, crossStreets, trackY, theme, width: W, height: H } = state.map;
  ctx.fillStyle = theme.streetTone;
  ctx.fillRect(0, avenue.y, W, avenue.h);
  ctx.strokeStyle = 'rgba(255, 210, 63, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 14]);
  ctx.beginPath();
  ctx.moveTo(0, avenue.y + avenue.h / 2); ctx.lineTo(W, avenue.y + avenue.h / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const x of crossStreets) {
    ctx.fillStyle = theme.streetTone;
    ctx.fillRect(x, 0, 40, H);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, trackY, W, 6);
  ctx.fillStyle = '#0a0518';
  for (let x = 30; x < W; x += 90) ctx.fillRect(x, trackY, 8, 30);
}

function drawBuildings(ctx: CanvasRenderingContext2D, state: GameState, t: number, prog: number): void {
  for (const b of state.map.buildings) {
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, `hsl(${b.hue}, 50%, ${22 - prog * 4}%)`);
    g.addColorStop(1, `hsl(${b.hue}, 60%, ${12 - prog * 3}%)`);
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = `hsl(${b.hue}, 70%, 35%)`;
    ctx.fillRect(b.x, b.y, b.w, 4);
    // Windows brighten at night
    const winA = 0.25 + prog * 0.45;
    for (let wx = 8; wx < b.w - 8; wx += 16) {
      for (let wy = 14; wy < b.h - 8; wy += 18) {
        const flicker = Math.sin((wx + wy + t * 2) * 0.07) > 0.4 ? 1 : 0.5;
        ctx.fillStyle = `hsla(${b.hue + 30}, 80%, 60%, ${winA * flicker})`;
        ctx.fillRect(b.x + wx, b.y + wy, 6, 8);
      }
    }
  }
}

function drawHiddenRipples(ctx: CanvasRenderingContext2D, state: GameState, t: number): void {
  for (const v of state.map.vendors) {
    if (!v.hidden) continue;
    const d = distance(state.player.x, state.player.y, v.x, v.y);
    if (d < 160 && d > 90) {
      const a = (160 - d) / 70 * 0.5;
      const r = 16 + ((t * 60) % 30);
      ctx.strokeStyle = `rgba(124, 246, 124, ${a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(124, 246, 124, ${a})`;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('✨ something delicious nearby...', state.player.x + 14, state.player.y - 18);
    }
  }
}

function drawVendors(ctx: CanvasRenderingContext2D, state: GameState, t: number, time: ReturnType<typeof timeOfDay>): void {
  for (const v of state.map.vendors) {
    const d = distance(state.player.x, state.player.y, v.x, v.y);
    const open = isVendorOpen(v, time);

    // Hidden gems stay invisible until you're close
    if (v.hidden && d > 90) continue;

    const pulse = 1 + Math.sin(t * 2 + v.x) * 0.15;
    const r = 26 * pulse;
    const ringColor = open ? v.color : '#555';
    const grad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, r);
    grad.addColorStop(0, ringColor + 'cc');
    grad.addColorStop(0.5, ringColor + '44');
    grad.addColorStop(1, ringColor + '00');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = open ? v.color : '#3a3343';
    ctx.fillRect(v.x - 14, v.y - 6, 28, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(v.x - 14, v.y + 6, 28, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(v.x - 14, v.y - 6, 7, 16);
    ctx.fillRect(v.x, v.y - 6, 7, 16);

    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = open ? 1 : 0.4;
    ctx.fillText(v.emoji, v.x, v.y - 18 + Math.sin(t * 3 + v.x * 0.1) * 1.5);
    ctx.globalAlpha = 1;

    if (d < 110) {
      const alpha = Math.max(0, Math.min(1, (110 - d) / 60));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(v.hidden ? '✨ HIDDEN GEM' : v.name, v.x, v.y + 28);
      if (!v.hidden) {
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
        ctx.font = '9px system-ui';
        ctx.fillText(v.blurb, v.x, v.y + 40);
      }
      if (!open) {
        ctx.fillStyle = `rgba(255, 90, 90, ${alpha})`;
        ctx.font = 'bold 9px system-ui';
        ctx.fillText('CLOSED', v.x, v.y + 52);
      }
    }

    if (d < 42 && open && !state.openVendor) {
      const bob = Math.sin(t * 6) * 2;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui';
      ctx.fillText('PRESS  E', v.x, v.y - 38 + bob);
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { player } = state;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 10, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  const bob = Math.sin(player.anim) * 1.5;
  const px = player.x, py = player.y + bob;
  ctx.fillStyle = '#ff3d8b';
  ctx.fillRect(px - 6, py - 4, 12, 12);
  ctx.fillStyle = '#f4c8a8';
  ctx.beginPath(); ctx.arc(px, py - 8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2bd4d9';
  ctx.fillRect(px - 5, py - 12, 10, 3);
  ctx.fillRect(px - 6, py - 10, 4 * player.dir, 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(px + 4 * player.dir, py, 5, 6);
  ctx.fillStyle = '#1a0b2e';
  ctx.fillRect(px + (player.dir > 0 ? 1 : -2), py - 8, 1.5, 1.5);
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.max);
    if (p.emoji) {
      ctx.globalAlpha = a;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, p.x, p.y);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
