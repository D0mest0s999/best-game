// One pooled particle list behind every effect in the game: pickup
// sparkles, hit bursts, the dash trail and engine motes. A particle is
// a plain object — position, velocity, remaining life, size, colour —
// integrated with simple drag and drawn as a fading soft circle.

export class Particles {
  constructor() {
    this.list = [];
  }

  // Emit `count` particles from (x, y). `dir`/`spread` aim the cone
  // (default: a full ring); `drag` bleeds speed over time.
  spawn(x, y, {
    count = 8,
    color = '#7df9ff',
    speed = 130,
    life = 0.5,
    size = 3,
    dir = 0,
    spread = Math.PI * 2,
    drag = 2.2,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (0.3 + Math.random() * 0.7);
      const max = life * (0.6 + Math.random() * 0.7);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: max,
        max,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        drag,
      });
    }
  }

  update(dt) {
    const keep = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      keep.push(p);
    }
    this.list = keep;
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list.length = 0;
  }
}
