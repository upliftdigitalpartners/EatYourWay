import './styles.css';
import { isMuted, setMuted, sfx } from './audio';
import { MAPS, MAP_LIST } from './data/maps';
import {
  type GameState,
  checkEnd,
  createState,
  distance,
  eat as eatVendor,
  isVendorOpen,
  nearestVendor,
  resetForPlay,
  spawnBurst,
  timeOfDay,
} from './game';
import { bindKeyboard, bindTouchControls, consumeEatPress, createInput, readMovement } from './input';
import { render } from './render';
import { recordRun } from './storage';
import type { MapDef, MenuItem, RunResult, Vendor } from './types';
import {
  buildLayout,
  buildMapPicker,
  closeVendorModal,
  hideAllModals,
  openVendorModal,
  shareResult,
  showEndScreen,
  showTitle,
  showToast,
  tickToast,
  updateHUD,
} from './ui';

const PLAYER_SPEED = 2.6;

const root = document.getElementById('app');
if (!root) throw new Error('app root missing');
const refs = buildLayout(root);
const ctx = refs.canvas.getContext('2d');
if (!ctx) throw new Error('no 2d context');

const input = createInput();

let state: GameState = createState(MAPS['jackson-heights']);
let lastBest = 0;

function fitCanvasToMap(map: MapDef): void {
  refs.canvas.width = map.width;
  refs.canvas.height = map.height;
}

function pickMap(map: MapDef): void {
  state = createState(map);
  fitCanvasToMap(map);
  resetForPlay(state);
  hideAllModals(refs);
  refs.hud.hidden = false;
  refs.mobile.classList.add('show');
  showToast(refs, `${map.name} · find the gems · combo 3+ cuisines`, map.accent);
  updateHUD(refs, state);
}

function showMapPicker(): void {
  buildMapPicker(refs, MAP_LIST, pickMap);
  showTitle(refs);
  refs.hud.hidden = true;
  refs.mobile.classList.remove('show');
}

function tryOpenNearest(): void {
  if (state.status !== 'playing') return;
  const near = nearestVendor(state);
  if (!near || near.dist > 42) return;
  const v = near.vendor;
  if (!isVendorOpen(v, timeOfDay(state))) {
    sfx.closed();
    showToast(refs, `${v.name} is closed right now`, '#ff5a5a');
    return;
  }
  state.status = 'menu';
  state.openVendor = v;
  sfx.click();
  openVendorModal(refs, v, state, (item) => handleEat(v, item), closeVendor);
}

function closeVendor(): void {
  if (state.openVendor) {
    state.openVendor = null;
    if (state.status === 'menu') state.status = 'playing';
  }
  closeVendorModal(refs);
}

function handleEat(vendor: Vendor, item: MenuItem): void {
  const before = state.flavor;
  const out = eatVendor(state, vendor, item);
  if (!out.ok) {
    if (out.reason === 'broke') {
      sfx.broke();
      showToast(refs, `Not enough cash for ${item.name}`, '#ff5a5a');
    } else if (out.reason === 'closed') {
      sfx.closed();
      showToast(refs, `${vendor.name} is closed`, '#ff5a5a');
    }
    return;
  }
  spawnBurst(state, vendor.x, vendor.y - 20, vendor.color, item.emoji);
  if (item.gem) sfx.gem();
  else sfx.eat();
  if (out.comboLeveled) {
    sfx.combo();
    showToast(refs, `🎉 ${state.combo}-cuisine combo · ×1.5 flavor!`, '#ffd23f');
  } else {
    const gain = state.flavor - before;
    showToast(refs, `${item.emoji} +${Math.round(gain)} flavor`, item.gem ? '#7cf67c' : '#2bd4d9');
  }
  closeVendor();
  updateHUD(refs, state);

  const result = checkEnd(state);
  if (result) finishRun(result);
}

function finishRun(result: RunResult): void {
  sfx.end();
  const { isNewBest, previousBest } = recordRun(result);
  lastBest = previousBest;
  showEndScreen(refs, result, state.map, isNewBest, previousBest, {
    onPlayAgain: () => { resetForPlay(state); hideAllModals(refs); refs.hud.hidden = false; refs.mobile.classList.add('show'); updateHUD(refs, state); },
    onChangeMap: () => { showMapPicker(); },
    onShare: async () => {
      try {
        const out = await shareResult(result, state.map);
        if (out === 'copied') showToast(refs, '📋 Share card copied to clipboard', '#7cf67c');
        else if (out === 'downloaded') showToast(refs, '⬇️ Saved share card to downloads', '#7cf67c');
      } catch {
        showToast(refs, 'Could not share — try again', '#ff5a5a');
      }
    },
  });
  void lastBest; // referenced for future analytics
}

// ---- Input wiring ----
bindKeyboard(input, () => {
  if (state.status === 'menu') closeVendor();
});
bindTouchControls(input, refs.joystick, refs.eatBtn);

refs.soundBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  refs.soundBtn.textContent = isMuted() ? '🔇' : '🔊';
  refs.soundBtn.title = isMuted() ? 'Unmute' : 'Mute';
});

// ---- Game loop ----
let lastTime = 0;
function loop(now: number): void {
  const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
  lastTime = now;

  if (state.status === 'playing') {
    const move = readMovement(input);
    // Friendly tick wrapper
    tickPhysicsAndCheckEnd(dt, move);

    if (consumeEatPress(input)) tryOpenNearest();
  } else {
    // Drain eat press if not in playing state to avoid stale presses
    consumeEatPress(input);
    // Still age out particles smoothly
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i]!;
      p.life -= dt * 1.2;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  tickToast(refs, dt);
  render(ctx!, state, now / 1000);

  if (state.status === 'playing') updateHUD(refs, state);

  requestAnimationFrame(loop);
}

function tickPhysicsAndCheckEnd(dt: number, move: { vx: number; vy: number }): void {
  // Inline physics to avoid churn — same as game.tickPhysics but lets us call checkEnd here
  if (state.status !== 'playing') return;

  if (move.vx || move.vy) {
    const n = Math.hypot(move.vx, move.vy) || 1;
    state.player.x += (move.vx / n) * PLAYER_SPEED;
    state.player.y += (move.vy / n) * PLAYER_SPEED;
    state.player.anim += dt * 12;
    if (move.vx > 0.05) state.player.dir = 1;
    else if (move.vx < -0.05) state.player.dir = -1;
  }
  state.player.x = Math.max(20, Math.min(state.map.width - 20, state.player.x));
  state.player.y = Math.max(20, Math.min(state.map.height - 20, state.player.y));

  state.hunger = Math.max(0, state.hunger - 1.6 * dt);
  state.coma = Math.max(0, state.coma - 1.4 * dt);
  state.elapsed += dt;
  state.comboFlash = Math.max(0, state.comboFlash - dt);

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]!;
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.12;
    p.life -= dt * 1.2;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // Subtle: if you stand inside a vendor's eat radius for >0.4s, auto-prompt visual is already in render
  // Distance unused here — included for parity with future behaviors
  void distance;

  const result = checkEnd(state);
  if (result) finishRun(result);
}

// ---- Boot ----
showMapPicker();
fitCanvasToMap(state.map);
requestAnimationFrame(loop);
