/** Keyboard and touch input, normalised into the ControlInput the vehicle
 *  controllers expect. What A/D and Space mean depends on what you are
 *  driving, so the mapping is resolved per domain. */

import type { ControlInput } from './vehicles/controller';
import type { Domain } from './vehicles/specs';

export interface InputState {
  keys: Set<string>;
  /** Virtual stick, -1..1 each axis. */
  stick: { x: number; y: number };
  pressed: Set<string>;
}

export function createInput(): InputState {
  return { keys: new Set(), stick: { x: 0, y: 0 }, pressed: new Set() };
}

const TRACKED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'KeyC', 'KeyM',
  'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape',
]);

export function bindKeyboard(input: InputState): void {
  addEventListener('keydown', (e) => {
    if (!TRACKED.has(e.code)) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  addEventListener('blur', () => input.keys.clear());
}

/** True once per physical press. */
export function consumePress(input: InputState, code: string): boolean {
  if (!input.pressed.has(code)) return false;
  input.pressed.delete(code);
  return true;
}

export function clearPresses(input: InputState): void {
  input.pressed.clear();
}

const axis = (input: InputState, neg: string[], pos: string[]): number => {
  let v = 0;
  if (neg.some(k => input.keys.has(k))) v -= 1;
  if (pos.some(k => input.keys.has(k))) v += 1;
  return v;
};

export function readControls(input: InputState, domain: Domain, drive: string): ControlInput {
  const throttle = axis(input, ['KeyS'], ['KeyW']) + (Math.abs(input.stick.y) > 0.08 ? input.stick.y : 0);
  const lateral = axis(input, ['KeyA'], ['KeyD']) + (Math.abs(input.stick.x) > 0.08 ? input.stick.x : 0);
  const brakeKey = input.keys.has('Space') ? 1 : 0;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));

  if (domain === 'air') {
    const pitch = axis(input, ['ArrowUp'], ['ArrowDown']);
    const yaw = axis(input, ['KeyQ'], ['KeyE']) + axis(input, ['ArrowLeft'], ['ArrowRight']);
    if (drive === 'heli') {
      // Space climbs, Shift descends; the stick tilts the airframe.
      const lift = (input.keys.has('Space') ? 1 : 0)
        - (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') ? 1 : 0);
      return {
        throttle: 0,
        steer: 0,
        brake: 0,
        pitch: clamp(pitch - throttle),
        roll: clamp(lateral),
        yaw: clamp(yaw),
        lift: clamp(lift),
      };
    }
    return {
      throttle: clamp(throttle >= 0 ? throttle : 0),
      steer: clamp(lateral),
      brake: brakeKey,
      pitch: clamp(pitch),
      roll: clamp(lateral),
      yaw: clamp(yaw),
      lift: 0,
    };
  }

  return {
    throttle: clamp(throttle),
    steer: clamp(lateral),
    brake: brakeKey,
    pitch: 0, roll: 0, yaw: 0, lift: 0,
  };
}

/** On-screen stick for touch devices. */
export function bindTouchStick(input: InputState, pad: HTMLElement): void {
  let id: number | null = null;
  let cx = 0, cy = 0;
  const radius = 54;
  const knob = pad.querySelector<HTMLElement>('.knob');

  const setKnob = (x: number, y: number) => {
    if (knob) knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
  };

  pad.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    const r = pad.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    pad.setPointerCapture(e.pointerId);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = (e.clientX - cx) / radius;
    const dy = (e.clientY - cy) / radius;
    const m = Math.hypot(dx, dy) || 1;
    const s = m > 1 ? 1 / m : 1;
    input.stick.x = dx * s;
    input.stick.y = -dy * s;
    setKnob(dx * s, dy * s);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    input.stick.x = 0;
    input.stick.y = 0;
    setKnob(0, 0);
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}
