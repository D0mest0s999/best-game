// Salvage cores: the collectible. A core drifts and bounces slowly
// until the player's tractor radius reaches it; then it is pulled in,
// faster as it gets closer, and collected on contact. Drawn as a cyan
// orb inside a slowly rotating diamond ring.

export const TRACTOR_R = 135;

export class Core {
  constructor(x, y, rng = Math.random) {
    this.x = x;
    this.y = y;
    const a = rng() * Math.PI * 2;
    const s = 14 + rng() * 22;
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.r = 9;
    this.phase = rng() * Math.PI * 2;
    this.tractored = false;
  }
}

export function spawnCore(w, h, rng = Math.random) {
  const pad = 48;
  return new Core(pad + rng() * (w - pad * 2), pad + rng() * (h - pad * 2), rng);
}

// Advance every core; returns the cores collected this step (they are
// removed from `list`). The caller scores them.
export function updateCores(list, dt, player, w, h) {
  const collected = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i];
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < TRACTOR_R) {
      // Tractored: velocity points at the player and grows as the
      // core closes in, so pickups snap satisfyingly.
      c.tractored = true;
      const pull = 190 + (TRACTOR_R - dist) * 4.2;
      c.vx = (dx / dist) * pull;
      c.vy = (dy / dist) * pull;
    } else {
      c.tractored = false;
    }

    c.x += c.vx * dt;
    c.y += c.vy * dt;

    // Drift bounces off the walls; a tractored core is heading at the
    // player and never reaches one.
    if (!c.tractored) {
      if (c.x < c.r) { c.x = c.r; c.vx = Math.abs(c.vx); }
      if (c.x > w - c.r) { c.x = w - c.r; c.vx = -Math.abs(c.vx); }
      if (c.y < c.r) { c.y = c.r; c.vy = Math.abs(c.vy); }
      if (c.y > h - c.r) { c.y = h - c.r; c.vy = -Math.abs(c.vy); }
    }

    const nd = Math.hypot(player.x - c.x, player.y - c.y);
    if (nd < player.r + c.r + 2) {
      collected.push(c);
      list.splice(i, 1);
    }
  }
  return collected;
}

// Faint tractor beams from the player to every core being pulled.
export function drawTractorBeams(ctx, list, player) {
  ctx.strokeStyle = 'rgba(125,249,255,0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const c of list) {
    if (!c.tractored) continue;
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(c.x, c.y);
  }
  ctx.stroke();
}

export function drawCore(ctx, c, t) {
  const pulse = 1 + Math.sin(t * 3 + c.phase) * 0.1;

  // Glow halo.
  ctx.fillStyle = 'rgba(64,224,255,0.13)';
  ctx.beginPath();
  ctx.arc(c.x, c.y, (c.r + 9) * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Rotating diamond ring.
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(t * 1.4 + c.phase);
  ctx.strokeStyle = 'rgba(125,249,255,0.8)';
  ctx.lineWidth = 1.6;
  const rr = (c.r + 4) * pulse;
  ctx.beginPath();
  ctx.moveTo(0, -rr);
  ctx.lineTo(rr, 0);
  ctx.lineTo(0, rr);
  ctx.lineTo(-rr, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Bright heart.
  ctx.fillStyle = '#aef7ff';
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r * 0.55 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#40e0ff';
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r * 0.85 * pulse, 0, Math.PI * 2);
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;
}
