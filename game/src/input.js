// Reading the keyboard and mouse as a driver does: keys held down, mouse look,
// and a pointer that never leaves the canvas.

export const keys = Object.create(null);
const pressed = Object.create(null);
let mouseDX = 0, mouseDY = 0, mouseDown = false;

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const k = e.code;
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  canvas.addEventListener('mousedown', () => { mouseDown = true; });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  });
}

export function consumeMouse() {
  const d = { dx: mouseDX, dy: mouseDY };
  mouseDX = 0; mouseDY = 0;
  return d;
}

export function isMouseDown() { return mouseDown; }

// True once per physical press, so held keys never repeat an action.
export function once(code) {
  if (pressed[code]) { pressed[code] = false; return true; }
  return false;
}

export function held(...codes) {
  for (const c of codes) if (keys[c]) return true;
  return false;
}

export function clearPressed() { for (const k in pressed) pressed[k] = false; }
