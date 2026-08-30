/** All DOM UI. Built imperatively so there is no framework in the render path. */

import type { RunResult, Vendor, MenuItem } from '../core/types';
import type { WorldData } from '../core/world';
import type { RunState } from '../core/rules';
import { RUN_DURATION_SEC, STARTING_CASH, flavorMultiplier, isVendorOpen, timeOfDay } from '../core/rules';
import type { VehicleSpec } from '../vehicles/specs';

export interface UIRefs {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  cash: HTMLElement;
  flavor: HTMLElement;
  combo: HTMLElement;
  timer: HTMLElement;
  hungerBar: HTMLElement;
  comaBar: HTMLElement;
  speed: HTMLElement;
  speedLabel: HTMLElement;
  vehicleName: HTMLElement;
  prompt: HTMLElement;
  toast: HTMLElement;
  modal: HTMLElement;
  title: HTMLElement;
  end: HTMLElement;
  minimap: HTMLCanvasElement;
  mobile: HTMLElement;
  stick: HTMLElement;
}

const el = (tag: string, cls?: string, html?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

export function buildLayout(root: HTMLElement): UIRefs {
  root.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.id = 'view';
  root.appendChild(canvas);

  const hud = el('div', 'hud');
  hud.innerHTML = `
    <div class="hud-top">
      <div class="stat cash"><span class="k">$</span><span class="v" id="cash">0</span></div>
      <div class="stat flavor"><span class="k">FLAVOR</span><span class="v" id="flavor">0</span></div>
      <div class="stat combo" id="combo"></div>
      <div class="stat timer"><span class="v" id="timer">12:00</span></div>
    </div>
    <div class="hud-bars">
      <div class="bar hunger"><i id="hungerBar"></i><label>HUNGER</label></div>
      <div class="bar coma"><i id="comaBar"></i><label>COMA</label></div>
    </div>
    <div class="hud-vehicle">
      <div class="vname" id="vehicleName">On Foot</div>
      <div class="vspeed"><span id="speed">0</span><small id="speedLabel">mph</small></div>
    </div>
    <canvas class="minimap" id="minimap" width="220" height="220"></canvas>
  `;
  root.appendChild(hud);

  const prompt = el('div', 'prompt');
  root.appendChild(prompt);

  const toast = el('div', 'toast');
  root.appendChild(toast);

  const modal = el('div', 'modal-wrap');
  root.appendChild(modal);

  const title = el('div', 'screen title');
  root.appendChild(title);

  const end = el('div', 'screen end');
  root.appendChild(end);

  const mobile = el('div', 'mobile');
  mobile.innerHTML = `
    <div class="stick" id="stick"><i class="knob"></i></div>
    <div class="btns">
      <button class="btn act" data-act="interact">F</button>
      <button class="btn brake" data-act="brake">BRAKE</button>
    </div>
  `;
  root.appendChild(mobile);

  const q = <T extends HTMLElement>(id: string): T => root.querySelector<T>('#' + id)!;

  return {
    root, canvas, hud, prompt, toast, modal, title, end, mobile,
    cash: q('cash'), flavor: q('flavor'), combo: q('combo'), timer: q('timer'),
    hungerBar: q('hungerBar'), comaBar: q('comaBar'),
    speed: q('speed'), speedLabel: q('speedLabel'), vehicleName: q('vehicleName'),
    minimap: q<HTMLCanvasElement>('minimap'),
    stick: q('stick'),
  };
}

const MS_TO_MPH = 2.23694;
const M_TO_FT = 3.28084;

export function updateHUD(
  r: UIRefs,
  run: RunState,
  spec: VehicleSpec,
  speed: number,
  altitude: number,
): void {
  r.cash.textContent = run.cash.toFixed(0);
  r.flavor.textContent = Math.round(run.flavor).toString();

  const mult = flavorMultiplier(run);
  if (mult > 1.001) {
    r.combo.innerHTML = `<span class="k">x${mult.toFixed(2)}</span><span class="v">${run.combo} cuisines · ${run.districtsVisited.size} areas</span>`;
    r.combo.classList.add('on');
  } else {
    r.combo.innerHTML = `<span class="v dim">${run.combo}/3 cuisines for combo</span>`;
    r.combo.classList.remove('on');
  }

  const left = Math.max(0, RUN_DURATION_SEC - run.elapsed);
  const mm = Math.floor(left / 60).toString();
  const ss = Math.floor(left % 60).toString().padStart(2, '0');
  r.timer.textContent = `${mm}:${ss}`;
  r.timer.classList.toggle('urgent', left < 60);

  r.hungerBar.style.width = `${run.hunger}%`;
  r.comaBar.style.width = `${Math.min(100, run.coma)}%`;
  r.comaBar.classList.toggle('danger', run.coma > 72);

  r.vehicleName.textContent = spec.name;
  if (spec.domain === 'air' && altitude > 3) {
    r.speed.textContent = Math.round(altitude * M_TO_FT).toString();
    r.speedLabel.textContent = 'ft';
  } else {
    r.speed.textContent = Math.round(speed * MS_TO_MPH).toString();
    r.speedLabel.textContent = 'mph';
  }
}

export function drawMinimap(
  r: UIRefs,
  world: WorldData,
  run: RunState,
  px: number,
  pz: number,
  heading: number,
): void {
  const c = r.minimap;
  const g = c.getContext('2d')!;
  const S = c.width;
  const RANGE = 620; // metres shown across the map
  const k = S / (RANGE * 2);

  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.clip();

  g.fillStyle = '#0b0a14';
  g.fillRect(0, 0, S, S);

  const tx = (x: number) => (x - px) * k + S / 2;
  const tz = (z: number) => (z - pz) * k + S / 2;

  // Water and parks first.
  const fillArea = (poly: [number, number][], color: string) => {
    g.fillStyle = color;
    g.beginPath();
    poly.forEach(([x, z], i) => (i ? g.lineTo(tx(x), tz(z)) : g.moveTo(tx(x), tz(z))));
    g.closePath();
    g.fill();
  };
  for (const w of world.water) fillArea(w.polygon, '#12304a');
  for (const p of world.parks) fillArea(p.polygon, '#1d3f26');

  // Roads.
  for (const road of world.roads) {
    const major = road.cls === 'motorway' || road.cls === 'primary' || road.cls === 'trunk';
    if (road.cls === 'rail') continue;
    g.strokeStyle = major ? '#4a4a58' : '#33333e';
    g.lineWidth = major ? 3 : 1.4;
    g.beginPath();
    road.points.forEach(([x, z], i) => (i ? g.lineTo(tx(x), tz(z)) : g.moveTo(tx(x), tz(z))));
    g.stroke();
  }

  // Vendors: hidden ones only once discovered.
  for (const v of world.vendors) {
    if (v.hidden && !run.discovered.has(v.id)) continue;
    const x = tx(v.x), z = tz(v.z);
    if (x < -8 || x > S + 8 || z < -8 || z > S + 8) continue;
    const open = isVendorOpen(v, timeOfDay(run));
    g.fillStyle = open ? v.color : '#55555f';
    g.beginPath();
    g.arc(x, z, v.hidden ? 4.5 : 3.4, 0, Math.PI * 2);
    g.fill();
    if (v.hidden) {
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 1.4;
      g.stroke();
    }
  }

  g.restore();

  // Player arrow, always centred.
  g.save();
  g.translate(S / 2, S / 2);
  g.rotate(-heading);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -7);
  g.lineTo(5, 6);
  g.lineTo(0, 3);
  g.lineTo(-5, 6);
  g.closePath();
  g.fill();
  g.restore();

  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.stroke();
}

export function showPrompt(r: UIRefs, html: string | null): void {
  if (!html) { r.prompt.classList.remove('on'); return; }
  r.prompt.innerHTML = html;
  r.prompt.classList.add('on');
}

let toastTimer = 0;
export function showToast(r: UIRefs, msg: string, color = '#2bd4d9'): void {
  r.toast.textContent = msg;
  r.toast.style.setProperty('--c', color);
  r.toast.classList.add('on');
  toastTimer = 2.6;
}
export function tickToast(r: UIRefs, dt: number): void {
  if (toastTimer <= 0) return;
  toastTimer -= dt;
  if (toastTimer <= 0) r.toast.classList.remove('on');
}

export function openVendorMenu(
  r: UIRefs,
  vendor: Vendor,
  run: RunState,
  onOrder: (item: MenuItem) => void,
  onClose: () => void,
): void {
  const time = timeOfDay(run);
  const open = isVendorOpen(vendor, time);
  const items = vendor.items.map((item, i) => {
    const afford = item.price <= run.cash;
    return `
      <button class="item${afford && open ? '' : ' off'}" data-i="${i}" ${afford && open ? '' : 'disabled'}>
        <span class="emoji">${item.emoji}</span>
        <span class="body">
          <span class="name">${item.name}${item.gem ? ' <b class="gem">HIDDEN GEM</b>' : ''}</span>
          <span class="meta">+${item.hunger} hunger · +${item.coma} coma · +${item.flavor} flavor</span>
        </span>
        <span class="price">$${item.price}</span>
      </button>`;
  }).join('');

  r.modal.innerHTML = `
    <div class="modal" style="--accent:${vendor.color}">
      <header>
        <div class="vend-emoji">${vendor.emoji}</div>
        <div>
          <h2>${vendor.name}</h2>
          <p>${vendor.blurb} · <em>${vendor.district}</em></p>
        </div>
        <button class="close" data-close>&times;</button>
      </header>
      ${open ? '' : `<div class="closed-note">Closed right now. Come back another time of day.</div>`}
      <div class="items">${items}</div>
      <footer>
        <span>$${run.cash.toFixed(0)} left</span>
        <span>x${flavorMultiplier(run).toFixed(2)} flavor</span>
      </footer>
    </div>`;
  r.modal.classList.add('on');

  r.modal.querySelector('[data-close]')!.addEventListener('click', onClose);
  r.modal.addEventListener('click', (e) => { if (e.target === r.modal) onClose(); });
  r.modal.querySelectorAll<HTMLButtonElement>('.item').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      const item = vendor.items[i];
      if (item) onOrder(item);
    });
  });
}

export function closeModal(r: UIRefs): void {
  r.modal.classList.remove('on');
  r.modal.innerHTML = '';
}

export function showTitle(r: UIRefs, world: WorldData, onStart: () => void): void {
  const vendorCount = world.vendors.length;
  const districts = [...new Set(world.vendors.map(v => v.district))];
  r.title.innerHTML = `
    <div class="panel">
      <h1>CURBSIDE</h1>
      <p class="tag">An open-world food crawl across ${world.name}.</p>
      <p class="blurb">
        $${STARTING_CASH} and ${Math.round(RUN_DURATION_SEC / 60)} minutes. ${vendorCount} vendors across
        ${districts.join(', ')}. Mix cuisines for a combo, cross districts for a bigger
        multiplier, and find the hidden gems before the city taps out.
      </p>
      <div class="keys">
        <div><b>W A S D</b> drive / walk</div>
        <div><b>F</b> get in, get out, order</div>
        <div><b>Space</b> brake · helicopter climb</div>
        <div><b>Shift</b> run · helicopter descend</div>
        <div><b>&uarr; &darr;</b> pitch &nbsp; <b>Q E</b> rudder</div>
        <div><b>C</b> camera</div>
      </div>
      <button class="go">START THE CRAWL</button>
      <p class="attrib">${world.attribution.join(' · ')}</p>
    </div>`;
  r.title.classList.add('on');
  r.title.querySelector('.go')!.addEventListener('click', onStart);
}

export function hideTitle(r: UIRefs): void { r.title.classList.remove('on'); }

export function showEnd(
  r: UIRefs,
  result: RunResult,
  isNewBest: boolean,
  previousBest: number,
  onAgain: () => void,
): void {
  const km = (m: number) => (m / 1000).toFixed(2);
  const travel = Object.entries(result.distanceByMode)
    .sort((a, b) => b[1] - a[1])
    .map(([mode, m]) => `<li><span>${mode}</span><b>${km(m)} km</b></li>`)
    .join('');

  r.end.innerHTML = `
    <div class="panel">
      <h2>${result.rank}</h2>
      ${isNewBest ? '<div class="best">NEW PERSONAL BEST</div>' : `<div class="prev">best ${previousBest}</div>`}
      <div class="score">${result.flavor}<small>flavor</small></div>
      <p class="reason">${result.endedReason}</p>
      <div class="grid">
        <div><b>${result.bites}</b><span>bites</span></div>
        <div><b>${result.gems}</b><span>gems</span></div>
        <div><b>${result.comboMax}</b><span>cuisines</span></div>
        <div><b>${result.districtsVisited.length}</b><span>districts</span></div>
        <div><b>$${result.spent}</b><span>spent</span></div>
        <div><b>${km(Object.values(result.distanceByMode).reduce((a, b) => a + b, 0))}</b><span>km</span></div>
      </div>
      <ul class="travel">${travel}</ul>
      <button class="go">CRAWL AGAIN</button>
    </div>`;
  r.end.classList.add('on');
  r.end.querySelector('.go')!.addEventListener('click', onAgain);
}

export function hideEnd(r: UIRefs): void { r.end.classList.remove('on'); }
