export interface InputState {
  keys: Record<string, boolean>;
  /** Virtual joystick output, normalized to [-1, 1]. */
  joy: { x: number; y: number };
  /** True if eat button was pressed this frame (consumed on read). */
  eatPressed: boolean;
}

export function createInput(): InputState {
  return { keys: {}, joy: { x: 0, y: 0 }, eatPressed: false };
}

export function bindKeyboard(input: InputState, onEsc: () => void): () => void {
  const onDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    input.keys[k] = true;
    if (k === 'escape') onEsc();
    if (k === 'e' || k === ' ') input.eatPressed = true;
    // Prevent arrow keys from scrolling
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  };
  const onUp = (e: KeyboardEvent) => { input.keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', onDown, { passive: false });
  window.addEventListener('keyup', onUp);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
  };
}

export function readMovement(input: InputState): { vx: number; vy: number } {
  let vx = 0, vy = 0;
  const k = input.keys;
  if (k.w || k.arrowup) vy -= 1;
  if (k.s || k.arrowdown) vy += 1;
  if (k.a || k.arrowleft) vx -= 1;
  if (k.d || k.arrowright) vx += 1;
  // Joystick overrides if active
  if (Math.abs(input.joy.x) > 0.05 || Math.abs(input.joy.y) > 0.05) {
    vx = input.joy.x;
    vy = input.joy.y;
  }
  return { vx, vy };
}

/** Wires up a virtual joystick element + eat button. Returns a teardown fn. */
export function bindTouchControls(
  input: InputState,
  joystickEl: HTMLElement,
  eatButtonEl: HTMLElement,
): () => void {
  const knob = joystickEl.querySelector<HTMLElement>('.knob');
  if (!knob) throw new Error('joystick missing .knob');
  const radius = 50;
  let activeId: number | null = null;
  let originX = 0, originY = 0;

  const setKnob = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    const cap = Math.min(1, len / radius);
    const nx = len > 0 ? (dx / len) * cap : 0;
    const ny = len > 0 ? (dy / len) * cap : 0;
    knob.style.transform = `translate(${nx * radius}px, ${ny * radius}px)`;
    input.joy.x = nx;
    input.joy.y = ny;
  };

  const onStart = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    if (!touch || activeId !== null) return;
    activeId = touch.identifier;
    const rect = joystickEl.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
    setKnob(touch.clientX - originX, touch.clientY - originY);
    e.preventDefault();
  };
  const onMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === activeId) {
        setKnob(t.clientX - originX, t.clientY - originY);
        e.preventDefault();
      }
    }
  };
  const onEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === activeId) {
        activeId = null;
        setKnob(0, 0);
      }
    }
  };

  joystickEl.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
  window.addEventListener('touchcancel', onEnd);

  const onEat = (e: Event) => { input.eatPressed = true; e.preventDefault(); };
  eatButtonEl.addEventListener('click', onEat);
  eatButtonEl.addEventListener('touchstart', onEat, { passive: false });

  return () => {
    joystickEl.removeEventListener('touchstart', onStart);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    window.removeEventListener('touchcancel', onEnd);
    eatButtonEl.removeEventListener('click', onEat);
    eatButtonEl.removeEventListener('touchstart', onEat);
  };
}

export function consumeEatPress(input: InputState): boolean {
  const v = input.eatPressed;
  input.eatPressed = false;
  return v;
}
