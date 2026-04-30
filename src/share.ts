import type { MapDef, RunResult } from './types';

const W = 1080;
const H = 1080;

/** Render a square share card and return it as a Blob (PNG). */
export function renderShareCard(result: RunResult, map: MapDef): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('share: no 2d context');

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2d1b4e');
  bg.addColorStop(0.6, '#1a0b2e');
  bg.addColorStop(1, '#0a0518');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative emoji confetti
  const confetti = result.cuisinesTried.length > 3 ? ['🥟','🍜','🌮','🍛','🥭','🍗','🌽','🧋','🥢'] : ['🍴','🥄'];
  for (let i = 0; i < 28; i++) {
    const e = confetti[i % confetti.length]!;
    ctx.font = `${30 + (i % 4) * 8}px sans-serif`;
    ctx.globalAlpha = 0.06 + (i % 3) * 0.04;
    ctx.fillText(e, (i * 137) % W, (i * 211) % H);
  }
  ctx.globalAlpha = 1;

  // Top label
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 28px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('EAT YOUR WAY', 80, 110);

  // Map name
  ctx.fillStyle = map.accent;
  ctx.font = 'bold 44px -apple-system, system-ui, sans-serif';
  ctx.fillText(map.name.toUpperCase(), 80, 165);

  // Big flavor number with gradient
  const grad = ctx.createLinearGradient(80, 200, W - 80, 480);
  grad.addColorStop(0, '#ff3d8b');
  grad.addColorStop(0.5, '#ffd23f');
  grad.addColorStop(1, '#2bd4d9');
  ctx.fillStyle = grad;
  ctx.font = 'bold 280px -apple-system, system-ui, sans-serif';
  ctx.fillText(String(result.flavor), 80, 470);

  // "FLAVOR" label
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 32px -apple-system, system-ui, sans-serif';
  ctx.fillText('FLAVOR SCORE', 80, 520);

  // Rank pill
  const rank = result.rank;
  ctx.font = 'bold 40px -apple-system, system-ui, sans-serif';
  const rankWidth = ctx.measureText(rank).width + 60;
  const rankX = 80, rankY = 580;
  ctx.fillStyle = 'rgba(255, 210, 63, 0.15)';
  roundRect(ctx, rankX, rankY, rankWidth, 70, 35);
  ctx.fill();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(rank, rankX + 30, rankY + 50);

  // Stats row
  const stats = [
    { label: 'BITES', val: String(result.bites) },
    { label: 'GEMS', val: String(result.gems) },
    { label: 'COMBO', val: `${result.comboMax}×` },
    { label: 'SPENT', val: `$${result.spent}` },
  ];
  const colW = (W - 160) / stats.length;
  stats.forEach((s, i) => {
    const x = 80 + colW * i;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.val, x, 770);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 22px -apple-system, system-ui, sans-serif';
    ctx.fillText(s.label, x, 800);
  });

  // Cuisines tasted as colored pills
  ctx.font = '600 26px -apple-system, system-ui, sans-serif';
  let px = 80; const py = 870;
  for (const c of result.cuisinesTried) {
    const text = c;
    ctx.font = '600 24px -apple-system, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 30;
    if (px + w > W - 80) break;
    ctx.fillStyle = 'rgba(43, 212, 217, 0.18)';
    roundRect(ctx, px, py, w, 44, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43, 212, 217, 0.6)';
    ctx.stroke();
    ctx.fillStyle = '#a5f0f3';
    ctx.fillText(text, px + 15, py + 30);
    px += w + 10;
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '600 28px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('eatyourway.app', 80, H - 60);
  ctx.textAlign = 'right';
  ctx.fillText(map.subtitle, W - 80, H - 60);

  // Top-right emoji medallion
  ctx.font = '180px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('🍜', W - 80, 280);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob returned null'));
    }, 'image/png', 0.95);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!('clipboard' in navigator) || !('write' in navigator.clipboard)) return false;
    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
