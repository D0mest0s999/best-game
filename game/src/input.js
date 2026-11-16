// Keyboard and mouse state for the game.
//
// Held keys live in `down`; one-shot presses land in `pressed` and are
// cleared by the game loop once per frame, after it has read them, so a
// press is seen exactly once. The mouse is tracked in canvas pixels so
// clicks line up with the drawing however the page scales the canvas.

export const input = {
  down: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0, down: false, clicked: false },
};

// Keys the browser would otherwise scroll or tab away with.
const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.down.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.down.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.down.clear();
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', () => {
    input.mouse.down = true;
    input.mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });
}

// Called by the game loop at the end of every frame.
export function endFrame() {
  input.pressed.clear();
  input.mouse.clicked = false;
}

// Movement axes from the held keys: each axis is -1, 0 or 1.
export function moveAxes() {
  const d = input.down;
  let x = 0;
  let y = 0;
  if (d.has('KeyA') || d.has('ArrowLeft')) x -= 1;
  if (d.has('KeyD') || d.has('ArrowRight')) x += 1;
  if (d.has('KeyW') || d.has('ArrowUp')) y -= 1;
  if (d.has('KeyS') || d.has('ArrowDown')) y += 1;
  return { x, y };
}

// Dash is an edge trigger: a fresh press of Shift or Space.
export function dashPressed() {
  return input.pressed.has('ShiftLeft')
    || input.pressed.has('ShiftRight')
    || input.pressed.has('Space');
}

export function enterPressed() {
  return input.pressed.has('Enter') || input.pressed.has('NumpadEnter');
}
