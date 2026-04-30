import { sfx } from './audio';
import { COMBO_THRESHOLD, RUN_DURATION_SEC, type GameState, timeOfDay } from './game';
import type { MapDef, MenuItem, RunResult, Vendor } from './types';
import { allBests } from './storage';
import { copyBlobToClipboard, downloadBlob, renderShareCard } from './share';

export interface UIRefs {
  app: HTMLElement;
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  cash: HTMLElement;
  hunger: HTMLElement;
  coma: HTMLElement;
  flavor: HTMLElement;
  score: HTMLElement;
  time: HTMLElement;
  combo: HTMLElement;
  toast: HTMLElement;
  titleModal: HTMLElement;
  vendorModal: HTMLElement;
  vendorCard: HTMLElement;
  endModal: HTMLElement;
  endTitle: HTMLElement;
  endScore: HTMLElement;
  endRecap: HTMLElement;
  endActions: HTMLElement;
  newBest: HTMLElement;
  sharePreview: HTMLImageElement;
  mobile: HTMLElement;
  joystick: HTMLElement;
  eatBtn: HTMLElement;
  soundBtn: HTMLButtonElement;
  mapPicker: HTMLElement;
}

let toastTimer = 0;

export function buildLayout(root: HTMLElement): UIRefs {
  root.innerHTML = `
    <canvas id="game" width="960" height="600" aria-label="game"></canvas>

    <div id="hud" hidden>
      <div class="stat cash"><span class="ico">💰</span><span id="cash">$40</span></div>
      <div class="stat"><span class="ico" style="color:var(--neon-orange)">🍴</span><div class="bar hunger"><div id="hungerBar" style="width:80%"></div></div></div>
      <div class="stat"><span class="ico" style="color:var(--neon-pink)">😵</span><div class="bar coma"><div id="comaBar" style="width:0%"></div></div></div>
      <div class="stat"><span class="ico" style="color:var(--neon-cyan)">✨</span><div class="bar flavor"><div id="flavorBar" style="width:0%"></div></div></div>
      <div class="stat score"><span class="ico">🏆</span><span id="score">0</span></div>
      <div class="stat time"><span class="ico">🕒</span><span id="time">afternoon</span></div>
      <div class="stat combo" id="combo">×1</div>
    </div>

    <button id="sound-btn" aria-label="toggle sound" title="Mute">🔊</button>

    <div id="toast"></div>

    <div class="modal show" id="title">
      <div class="card">
        <h1>Eat Your Way</h1>
        <div class="tag">A vibrant food crawl across NYC</div>
        <div class="controls">
          <strong>WASD</strong> or <strong>Arrows</strong> to walk · <strong>E</strong> / <strong>Space</strong> to eat<br/>
          Find hidden gems · Combo 3+ cuisines for bonus flavor · Don't food-coma
        </div>
        <div class="map-picker" id="mapPicker"></div>
      </div>
    </div>

    <div class="modal" id="vendorModal">
      <div class="card" id="vendorCard"></div>
    </div>

    <div class="modal" id="end">
      <div class="card">
        <h2 id="endTitle">Food Coma</h2>
        <div class="new-best" id="newBest" hidden>NEW PERSONAL BEST</div>
        <div class="big-num" id="endScore">0</div>
        <div class="label">FLAVOR SCORE</div>
        <div class="recap" id="endRecap"></div>
        <img id="share-preview" alt="share card" />
        <div class="btn-row" id="endActions"></div>
      </div>
    </div>

    <div id="mobile-controls">
      <div id="joystick"><div class="knob"></div></div>
      <button id="eat-btn">EAT</button>
    </div>
  `;

  const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const el = root.querySelector<T>('#' + id);
    if (!el) throw new Error('missing element: ' + id);
    return el;
  };

  return {
    app: root,
    canvas: $<HTMLCanvasElement>('game'),
    hud: $('hud'),
    cash: $('cash'),
    hunger: $('hungerBar'),
    coma: $('comaBar'),
    flavor: $('flavorBar'),
    score: $('score'),
    time: $('time'),
    combo: $('combo'),
    toast: $('toast'),
    titleModal: $('title'),
    vendorModal: $('vendorModal'),
    vendorCard: $('vendorCard'),
    endModal: $('end'),
    endTitle: $('endTitle'),
    endScore: $('endScore'),
    endRecap: $('endRecap'),
    endActions: $('endActions'),
    newBest: $('newBest'),
    sharePreview: $<HTMLImageElement>('share-preview'),
    mobile: $('mobile-controls'),
    joystick: $('joystick'),
    eatBtn: $('eat-btn'),
    soundBtn: $<HTMLButtonElement>('sound-btn'),
    mapPicker: $('mapPicker'),
  };
}

export function showToast(refs: UIRefs, msg: string, color = '#2bd4d9'): void {
  refs.toast.textContent = msg;
  refs.toast.style.color = color;
  refs.toast.style.borderColor = color;
  refs.toast.style.boxShadow = `0 0 24px ${color}66`;
  refs.toast.classList.add('show');
  toastTimer = 2.0;
}

export function tickToast(refs: UIRefs, dt: number): void {
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) refs.toast.classList.remove('show');
  }
}

export function updateHUD(refs: UIRefs, state: GameState): void {
  refs.cash.textContent = `$${state.cash.toFixed(0)}`;
  refs.hunger.style.width = Math.max(0, state.hunger) + '%';
  refs.coma.style.width = Math.min(100, state.coma) + '%';
  refs.flavor.style.width = Math.min(100, state.flavor / 3) + '%';
  refs.score.textContent = String(Math.round(state.flavor));

  const remain = Math.max(0, RUN_DURATION_SEC - state.elapsed);
  const m = Math.floor(remain / 60);
  const s = Math.floor(remain % 60).toString().padStart(2, '0');
  refs.time.textContent = `${timeOfDay(state)} · ${m}:${s}`;

  const mult = state.combo >= COMBO_THRESHOLD ? 1.5 : 1;
  refs.combo.textContent = `${state.combo}/${COMBO_THRESHOLD}+ · ×${mult}`;
  if (state.comboFlash > 0) refs.combo.classList.add('flash');
  else refs.combo.classList.remove('flash');
}

export function buildMapPicker(refs: UIRefs, maps: MapDef[], onPick: (m: MapDef) => void): void {
  const bests = allBests();
  refs.mapPicker.innerHTML = '';
  for (const m of maps) {
    const best = bests[m.id];
    const tile = document.createElement('button');
    tile.className = `map-tile ${m.id === 'jackson-heights' ? 'jh' : 'fl'}`;
    tile.innerHTML = `
      <div class="name">${m.name}</div>
      <div class="sub">${m.subtitle}</div>
      <div class="best ${best ? '' : 'empty'}">
        ${best ? `🏆 best: ${best.flavor} · ${best.rank}` : 'no runs yet'}
      </div>
    `;
    tile.addEventListener('click', () => { sfx.click(); onPick(m); });
    refs.mapPicker.appendChild(tile);
  }
}

export function openVendorModal(
  refs: UIRefs,
  vendor: Vendor,
  state: GameState,
  onEat: (item: MenuItem) => void,
  onClose: () => void,
): void {
  const time = timeOfDay(state);
  const open = vendor.openAt.includes(time);
  const title = vendor.hidden ? `✨ ${vendor.name}` : vendor.name;
  let html = `<h2>${vendor.emoji}  ${title}</h2><div class="sub">${vendor.blurb}</div>`;

  if (!open) {
    html += `<div style="padding:14px; background:rgba(255,90,90,0.1); border:1px solid rgba(255,90,90,0.3); border-radius:10px; font-size:13px; text-align:center;">
      Closed right now · open: <strong>${vendor.openAt.join(', ')}</strong>
    </div>`;
  } else {
    for (const it of vendor.items) {
      const cant = it.price > state.cash;
      const gem = it.gem ? 'gem' : '';
      html += `
        <div class="menu-item ${cant ? 'cant-afford' : ''} ${gem}" data-name="${it.name}">
          <div class="emoji">${it.emoji}</div>
          <div>
            <div class="name">${it.name}${it.gem ? ' ✨' : ''}</div>
            <div class="meta">+${it.flavor} flavor · +${it.coma} coma · +${it.hunger} fill</div>
          </div>
          <div class="price">$${it.price}</div>
        </div>
      `;
    }
  }
  html += `<div class="close-hint">ESC to walk away</div>`;
  refs.vendorCard.innerHTML = html;

  for (const el of Array.from(refs.vendorCard.querySelectorAll<HTMLElement>('.menu-item'))) {
    if (el.classList.contains('cant-afford')) continue;
    el.addEventListener('click', () => {
      const name = el.dataset.name;
      const item = vendor.items.find(i => i.name === name);
      if (item) onEat(item);
    });
  }

  refs.vendorModal.classList.add('show');
  // Close on backdrop click
  const backdropHandler = (e: MouseEvent) => {
    if (e.target === refs.vendorModal) {
      refs.vendorModal.removeEventListener('click', backdropHandler);
      onClose();
    }
  };
  refs.vendorModal.addEventListener('click', backdropHandler);
}

export function closeVendorModal(refs: UIRefs): void {
  refs.vendorModal.classList.remove('show');
}

export function showEndScreen(
  refs: UIRefs,
  result: RunResult,
  map: MapDef,
  isNewBest: boolean,
  previousBest: number,
  handlers: { onPlayAgain: () => void; onChangeMap: () => void; onShare: () => void },
): void {
  refs.endTitle.textContent = result.endedReason.includes('coma') ? 'Food Coma 😴'
                            : result.endedReason.includes('Hangry') ? 'Hangry & Broke 💸'
                            : 'Last Train 🚇';
  refs.endScore.textContent = String(result.flavor);
  refs.newBest.hidden = !isNewBest;

  const lines: string[] = [];
  lines.push(`<div style="opacity:0.85; margin-bottom: 8px;">${result.endedReason}</div>`);
  lines.push(`<div><strong>${result.bites}</strong> bites · <strong>$${result.spent}</strong> spent · <strong>${result.gems}</strong> gem${result.gems === 1 ? '' : 's'}</div>`);
  lines.push(`<div>Combo max: <strong>${result.comboMax}</strong> cuisines · Cuisines: ${result.cuisinesTried.join(', ') || '—'}</div>`);
  if (!isNewBest && previousBest > 0) {
    const diff = previousBest - result.flavor;
    lines.push(`<div style="opacity:0.7; margin-top:6px;">${diff > 0 ? `${diff} short of your best (${previousBest})` : 'Tied your best.'}</div>`);
  }
  lines.push(`<div style="margin-top:10px; font-weight:700; color: var(--neon-yellow);">Rank: ${result.rank}</div>`);
  refs.endRecap.innerHTML = lines.join('');

  refs.sharePreview.style.display = 'none';
  // Render share card asynchronously
  renderShareCard(result, map).then(blob => {
    const url = URL.createObjectURL(blob);
    refs.sharePreview.src = url;
    refs.sharePreview.style.display = 'block';
    refs.sharePreview.dataset.blobUrl = url;
  }).catch(() => { /* ignore */ });

  refs.endActions.innerHTML = '';
  const make = (label: string, cls: string, fn: () => void) => {
    const b = document.createElement('button');
    b.className = `btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', () => { sfx.click(); fn(); });
    refs.endActions.appendChild(b);
  };
  make('Eat Again 🌮', '', handlers.onPlayAgain);
  make('Change Map 🗺️', 'secondary', handlers.onChangeMap);
  make('Share 📸', 'secondary', handlers.onShare);

  refs.endModal.classList.add('show');
}

export async function shareResult(result: RunResult, map: MapDef): Promise<'shared' | 'copied' | 'downloaded'> {
  const blob = await renderShareCard(result, map);
  const filename = `eat-your-way-${map.id}-${result.flavor}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  // 1. Try Web Share API with file
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'Eat Your Way',
        text: `I scored ${result.flavor} on ${map.name} — ${result.rank}. Beat that.`,
      });
      return 'shared';
    } catch { /* fall through */ }
  }
  // 2. Try clipboard image copy
  if (await copyBlobToClipboard(blob)) return 'copied';
  // 3. Download
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function hideAllModals(refs: UIRefs): void {
  refs.titleModal.classList.remove('show');
  refs.vendorModal.classList.remove('show');
  refs.endModal.classList.remove('show');
}

export function showTitle(refs: UIRefs): void {
  refs.titleModal.classList.add('show');
  refs.endModal.classList.remove('show');
  refs.vendorModal.classList.remove('show');
}
