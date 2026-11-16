// Hunter drones: the hazard. They spawn on the arena edges, steer
// toward the player with a capped turn rate, keep separation from
// each other so they arrive as a pack instead of a stack, and wobble
// on a sine so their approach feels alive rather than rail-straight.
// Drawn as magenta angular drones with a glowing eye.

export class Hunter {
  constructor(x, y, speed) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = 13;
    this.speed = speed;
    this.phase = Math.random() * Math.PI * 2;
    this.angle = 0;
  }
}

// Spawn `count` hunters on random edges, each at least ~240 px from
// the player so a wave never opens with an instant hit.
export function spawnHunters(count, speed, w, h, player, rng = Math.random) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    let tries = 0;
    do {
      const edge = Math.floor(rng() * 4);
      if (edge === 0) { x = rng() * w; y = 20; }
      else if (edge === 1) { x = rng() * w; y = h - 20; }
      else if (edge === 2) { x = 20; y = rng() * h; }
      else { x = w - 20; y = rng() * h; }
      tries += 1;
    } while (Math.hypot(x - player.x, y - player.y) < 240 && tries < 12);
    out.push(new Hunter(x, y, speed * (0.9 + rng() * 0.25)));
  }
  return out;
}

export function updateHunters(list, dt, player, t) {
  for (const h of list) {
    const dx = player.x - h.x;
    const dy = player.y - h.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Desired velocity: at the player, plus a perpendicular wobble.
    const wob = Math.sin(t * 2.3 + h.phase) * 0.45;
    let dvx = dx / dist + (-dy / dist) * wob;
    let dvy = dy / dist + (dx / dist) * wob;
    const dl = Math.hypot(dvx, dvy) || 1;
    dvx = (dvx / dl) * h.speed;
    dvy = (dvy / dl) * h.speed;

    // Separation: a soft push out of a neighbour's personal space.
    for (const o of list) {
      if (o === h) continue;
      const sx = h.x - o.x;
      const sy = h.y - o.y;
      const sd = Math.hypot(sx, sy);
      if (sd > 0 && sd < 46) {
        dvx += (sx / sd) * 70;
        dvy += (sy / sd) * 70;
      }
    }

    // Steer toward the desired velocity at a capped rate: this is
    // what lets a good dash slip past a hunter's nose.
    const k = Math.min(1, 3.4 * dt);
    h.vx += (dvx - h.vx) * k;
    h.vy += (dvy - h.vy) * k;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    if (Math.hypot(h.vx, h.vy) > 12) h.angle = Math.atan2(h.vy, h.vx);
  }
}

export function drawHunter(ctx, h, t) {
  // Soft magenta glow.
  ctx.fillStyle = 'rgba(255,46,136,0.13)';
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.r + 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);
  // Angular diamond hull with notched wings.
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(2, 6);
  ctx.lineTo(-10, 12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(2, -6);
  ctx.closePath();
  ctx.fillStyle = '#ff2e88';
  ctx.fill();
  ctx.strokeStyle = '#ff8fc0';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // The eye: a bright core that pulses, always facing the player is
  // overkill — it sits at the centre and reads at any angle.
  const pulse = 2.6 + Math.sin(t * 6 + h.phase) * 0.7;
  ctx.fillStyle = '#ffd7ec';
  ctx.beginPath();
  ctx.arc(h.x, h.y, pulse, 0, Math.PI * 2);
  ctx.fill();
}
