// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (enter a
// car, punch, pause, honk, mute, dash, repair, headlights) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice.
//
// The full key map, for reference:
//   WASD / arrows — move and drive · Shift — sprint on foot, nitro in a car
//   F — dash on foot · E — enter / exit a car or bike · Space — punch, or start
//   H — honk (tap twice fast for a long honk) · P — pause · M — mute
//   N — new game on the title screen · L — headlights · R — repair at the garage

export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_HONK = 8;
export const ACTION_MUTE = 16;
export const ACTION_CONFIRM = 32;
export const ACTION_DASH = 64;
export const ACTION_REPAIR = 128;
export const ACTION_LIGHTS = 256;
export const ACTION_HONK_LONG = 512;

/** Two honks within this many milliseconds count as one long honk. */
const LONG_HONK_WINDOW_MS = 450;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const HONK = new Set(['KeyH']);
const MUTE = new Set(['KeyM']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CONFIRM = new Set(['Enter']);
const DASH = new Set(['KeyF']);
const REPAIR = new Set(['KeyR']);
const LIGHTS = new Set(['KeyL']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, sprint: false };
  let actions = 0;
  let lastHonkAt = 0;

  function press(code, repeat) {
    if (UP.has(code)) held.up = true;
    else if (DOWN.has(code)) held.down = true;
    else if (LEFT.has(code)) held.left = true;
    else if (RIGHT.has(code)) held.right = true;
    else if (SPRINT.has(code)) held.sprint = true;
    else if (!repeat && ENTER.has(code)) actions |= ACTION_ENTER;
    else if (!repeat && PUNCH.has(code)) actions |= ACTION_PUNCH;
    else if (!repeat && HONK.has(code)) {
      // A second honk inside the window is a long honk, not another short one:
      // the world plays the long pattern instead of two blasts.
      const now = performance.now();
      if (now - lastHonkAt < LONG_HONK_WINDOW_MS) actions |= ACTION_HONK_LONG;
      else actions |= ACTION_HONK;
      lastHonkAt = now;
    }
    else if (!repeat && MUTE.has(code)) actions |= ACTION_MUTE;
    else if (!repeat && PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (!repeat && CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (!repeat && DASH.has(code)) actions |= ACTION_DASH;
    else if (!repeat && REPAIR.has(code)) actions |= ACTION_REPAIR;
    else if (!repeat && LIGHTS.has(code)) actions |= ACTION_LIGHTS;
    else return false;
    return true;
  }

  function release(code) {
    if (UP.has(code)) held.up = false;
    else if (DOWN.has(code)) held.down = false;
    else if (LEFT.has(code)) held.left = false;
    else if (RIGHT.has(code)) held.right = false;
    else if (SPRINT.has(code)) held.sprint = false;
  }

  window.addEventListener('keydown', (event) => {
    if (press(event.code, event.repeat)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => release(event.code));
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sprint = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The steering vector: x -1..1, y -1..1, sprint held or not. */
    move() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        sprint: held.sprint,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
