// The player's salvage drone: thrust movement with damping, a dash
// (a burst of speed with brief invulnerability, on a cooldown), three
// hull points, and a knockback-and-blink state after a hit. Drawn as a
// white dart with amber accents and a flickering engine flame.

import { moveAxes, dashPressed } from './input.js';

const TOP_SPEED = 265;
const ACCEL = 1500;
const DASH_TIME = 0.18;
const DASH_MULT = 3.1;
export const DASH_COOLDOWN = 2.5;
const HIT_INVULN = 1.6;

export class Player {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.reset();
  }

  reset() {
    this.x = this.w / 2;
    this.y = this.h / 2;
    this.vx = 0;
    this.vy = 0;
    this.r = 14;
    this.hull = 3;
    this.maxHull = 3;
    this.angle = -Math.PI / 2;
    this.dashDir = { x: 1, y: 0 };
    this.dashTime = 0;
    this.dashCd = 0;
    this.invuln = 0;
    this.thrust = 0;
  }

  get dashing() {
    return this.dashTime > 0;
  }

  get invulnerable() {
    return this.invuln > 0 || this.dashing;
  }

  get dashReady() {
    return this.dashCd <= 0;
  }

  // 0..1 charge for the HUD's dash bar.
  dashFraction() {
    return this.dashReady ? 1 : 1 - this.dashCd / DASH_COOLDOWN;
  }

  update(dt, onDash) {
    const { x: ax, y: ay } = moveAxes();

    if (dashPressed() && this.dashCd <= 0) {
      let dx = ax;
      let dy = ay;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(this.angle);
        dy = Math.sin(this.angle);
      }
      const len = Math.hypot(dx, dy) || 1;
      this.dashDir = { x: dx / len, y: dy / len };
      this.dashTime = DASH_TIME;
      this.dashCd = DASH_COOLDOWN;
      if (onDash) onDash(this);
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      const ds = TOP_SPEED * DASH_MULT;
      this.vx = this.dashDir.x * ds;
      this.vy = this.dashDir.y * ds;
    } else {
      this.vx += ax * ACCEL * dt;
      this.vy += ay * ACCEL * dt;
      // Damp only the axes with no input, so stopping feels crisp
      // without fighting the thrust.
      const damp = Math.pow(0.0015, dt);
      if (ax === 0) this.vx *= damp;
      if (ay === 0) this.vy *= damp;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > TOP_SPEED) {
        this.vx = (this.vx / sp) * TOP_SPEED;
        this.vy = (this.vy / sp) * TOP_SPEED;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Arena walls: clamp and bleed the into-wall velocity.
    if (this.x < this.r) { this.x = this.r; this.vx = Math.abs(this.vx) * 0.4; }
    if (this.x > this.w - this.r) { this.x = this.w - this.r; this.vx = -Math.abs(this.vx) * 0.4; }
    if (this.y < this.r) { this.y = this.r; this.vy = Math.abs(this.vy) * 0.4; }
    if (this.y > this.h - this.r) { this.y = this.h - this.r; this.vy = -Math.abs(this.vy) * 0.4; }

    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    const sp = Math.hypot(this.vx, this.vy);
    this.thrust = Math.min(1, sp / TOP_SPEED);
    if (sp > 24) this.angle = Math.atan2(this.vy, this.vx);
  }

  // A hunter got through: lose a hull, get knocked away, blink safe.
  // Returns the hull left.
  hit(fromX, fromY) {
    this.hull -= 1;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.vx = Math.cos(a) * 430;
    this.vy = Math.sin(a) * 430;
    this.invuln = HIT_INVULN;
    return this.hull;
  }

  healOne() {
    this.hull = Math.min(this.maxHull, this.hull + 1);
  }

  draw(ctx, t) {
    // Blink while post-hit invulnerable (the dash has its own ring).
    if (this.invuln > 0 && !this.dashing && Math.floor(t * 14) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Engine flame, sized by thrust and flickering.
    if (this.thrust > 0.05) {
      const fl = (10 + this.thrust * 14) * (0.85 + Math.random() * 0.3);
      const grad = ctx.createLinearGradient(-10, 0, -10 - fl, 0);
      grad.addColorStop(0, 'rgba(255,190,64,0.9)');
      grad.addColorStop(1, 'rgba(255,110,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-9, 4.5);
      ctx.lineTo(-10 - fl, 0);
      ctx.lineTo(-9, -4.5);
      ctx.closePath();
      ctx.fill();
    }

    // Hull: a white dart with amber wing tips and cockpit.
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-6, 5);
    ctx.lineTo(-11, 12);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-11, -12);
    ctx.lineTo(-6, -5);
    ctx.closePath();
    ctx.fillStyle = '#f2f6ff';
    ctx.fill();
    ctx.strokeStyle = '#8fa8d8';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffb340';
    ctx.beginPath();
    ctx.moveTo(-11, 12);
    ctx.lineTo(-6, 5);
    ctx.lineTo(-5, 9);
    ctx.closePath();
    ctx.moveTo(-11, -12);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-5, -9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, 0, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb340';
    ctx.fill();
    ctx.restore();

    // Shield ring while invulnerable (post-hit or dashing).
    if (this.invulnerable) {
      ctx.strokeStyle = this.dashing ? 'rgba(125,249,255,0.85)' : 'rgba(255,179,64,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 6 + Math.sin(t * 9) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
