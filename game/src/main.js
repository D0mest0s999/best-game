// Orbital Salvage — a top-down arena salvage game.
//
// You fly a drone in a debris belt. Reactor cores drift nearby; fly
// close and your tractor pulls them in. Hunter drones want the same
// cores and will ram you for them: a touch costs 1 of your 3 hull.
// Each wave asks for a quota of cores; clearing it patches 1 hull
// and the next wave comes back with more, faster hunters. Chain
// pickups within 4 seconds to build a combo multiplier up to x8.
//
// This module owns the loop and the state machine (title, playing,
// waveclear, gameover, plus a pause flag); the entities, particles,
// synth and HUD live in their own modules beside it.

import { initInput, input, endFrame, enterPressed } from './input.js';
import { Synth } from './audio.js';
import { Particles } from './particles.js';
import { Player } from './player.js';
import { spawnHunters, updateHunters, drawHunter } from './hunters.js';
import { spawnCore, updateCores, drawCore, drawTractorBeams } from './cores.js';
import { drawHUD, drawBanner, drawTitleScreen, drawGameOverScreen } from './hud.js';

const W = 960;
const H = 600;
const COMBO_WINDOW = 4;
const MAX_ON_FIELD = 5;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// mulberry32: a small seeded RNG. Used for the starfield (so the sky
// is the same for everyone) and for the staged screenshot scenes.
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- background --------------------------------------------------------

const starRng = mulberry32(20240);
const stars = [];
for (let i = 0; i < 130; i++) {
  stars.push({
    x: starRng() * W,
    y: starRng() * H,
    r: 0.6 + starRng() * 1.5,
    phase: starRng() * Math.PI * 2,
    speed: 4 + starRng() * 10,
  });
}

function drawBackground(t) {
  ctx.fillStyle = '#070b1d';
  ctx.fillRect(0, 0, W, H);

  // Faint perspective-feel grid.
  ctx.strokeStyle = 'rgba(64,110,220,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // Twinkling, slowly drifting stars.
  for (const s of stars) {
    const y = (s.y + t * s.speed) % H;
    ctx.globalAlpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.phase));
    ctx.fillStyle = '#cfe2ff';
    ctx.beginPath();
    ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arena frame.
  ctx.strokeStyle = 'rgba(96,150,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
}

// --- game state ----------------------------------------------------------

const synth = new Synth();
const particles = new Particles();
const player = new Player(W, H);

let state = 'title'; // title | playing | waveclear | gameover
let paused = false;
let hunters = [];
let cores = [];
let decorCores = []; // drifting set dressing for the title screen
let score = 0;
let best = 0;
let wave = 1;
let waveTarget = 0;
let waveGot = 0;
let waveSpawned = 0;
let spawnTimer = 0;
let comboCount = 0;
let comboTimer = 0;
let shake = 0;
let bannerTimer = 0;
let elapsed = 0;

const comboMult = () => Math.min(8, Math.max(1, comboCount));

function waveQuota(n) {
  return 5 + n * 2; // wave 1: 7, wave 2: 9, ...
}

function startWave(n) {
  wave = n;
  waveTarget = waveQuota(n);
  waveGot = 0;
  waveSpawned = 0;
  spawnTimer = 0;
  cores = [];
  const count = Math.min(3 + n, 9);
  const speed = Math.min(88 + n * 14, 205);
  hunters = spawnHunters(count, speed, W, H, player);
}

function startRun() {
  score = 0;
  comboCount = 0;
  comboTimer = 0;
  particles.clear();
  player.reset();
  startWave(1);
  state = 'playing';
  paused = false;
}

function onCollect(c) {
  comboCount = comboTimer > 0 ? comboCount + 1 : 1;
  comboTimer = COMBO_WINDOW;
  const mult = comboMult();
  score += 25 * mult;
  waveGot += 1;
  synth.pickup(mult);
  particles.spawn(c.x, c.y, {
    count: 12, color: '#7df9ff', speed: 170, life: 0.45, size: 3,
  });
  particles.spawn(c.x, c.y, {
    count: 5, color: '#ffb340', speed: 90, life: 0.35, size: 2.4,
  });
}

function onPlayerHit(h) {
  const left = player.hit(h.x, h.y);
  shake = 14;
  synth.hit();
  particles.spawn(player.x, player.y, {
    count: 22, color: '#ffb340', speed: 260, life: 0.55, size: 3.4,
  });
  particles.spawn(player.x, player.y, {
    count: 10, color: '#ff5c8a', speed: 180, life: 0.45, size: 3,
  });
  comboCount = 0;
  comboTimer = 0;
  if (left <= 0) {
    best = Math.max(best, score);
    state = 'gameover';
    synth.gameOver();
    particles.spawn(player.x, player.y, {
      count: 46, color: '#f2f6ff', speed: 330, life: 0.9, size: 3.6,
    });
  }
}

function onDash(p) {
  synth.dash();
  particles.spawn(p.x, p.y, {
    count: 8, color: '#7df9ff', speed: 70, life: 0.3, size: 2.6,
    dir: Math.atan2(-p.dashDir.y, -p.dashDir.x), spread: 1.1,
  });
}

// --- update ---------------------------------------------------------------

function updatePlaying(dt) {
  player.update(dt, onDash);

  // Dash trail: a short amber wake while the dash burns.
  if (player.dashing) {
    particles.spawn(player.x, player.y, {
      count: 3, color: '#ffb340', speed: 26, life: 0.34, size: 3.4, drag: 1,
    });
  }

  // Keep the field stocked until the wave's quota has all spawned.
  spawnTimer -= dt;
  if (waveSpawned < waveTarget && cores.length < MAX_ON_FIELD && spawnTimer <= 0) {
    cores.push(spawnCore(W, H));
    waveSpawned += 1;
    spawnTimer = 0.55;
  }

  for (const c of updateCores(cores, dt, player, W, H)) onCollect(c);

  updateHunters(hunters, dt, player, elapsed);

  // Hunter contact: skipped while the player is invulnerable (dash
  // or post-hit blink), which is what makes the dash an escape.
  if (!player.invulnerable) {
    for (const h of hunters) {
      if (Math.hypot(h.x - player.x, h.y - player.y) < h.r + player.r - 2) {
        onPlayerHit(h);
        break;
      }
    }
  }

  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) comboCount = 0;
  }

  if (state === 'playing' && waveGot >= waveTarget) {
    player.healOne();
    synth.waveClear();
    state = 'waveclear';
    bannerTimer = 1.7;
    particles.spawn(player.x, player.y, {
      count: 30, color: '#7df9ff', speed: 240, life: 0.7, size: 3,
    });
  }
}

function update(dt) {
  elapsed += dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 34);
  particles.update(dt);

  if (state === 'title') {
    for (const c of decorCores) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < c.r) { c.x = c.r; c.vx = Math.abs(c.vx); }
      if (c.x > W - c.r) { c.x = W - c.r; c.vx = -Math.abs(c.vx); }
      if (c.y < c.r) { c.y = c.r; c.vy = Math.abs(c.vy); }
      if (c.y > H - c.r) { c.y = H - c.r; c.vy = -Math.abs(c.vy); }
    }
    return;
  }

  if (state === 'waveclear') {
    bannerTimer -= dt;
    // The world keeps drifting behind the banner, minus the player.
    updateHunters(hunters, dt, player, elapsed);
    if (bannerTimer <= 0) {
      startWave(wave + 1);
      state = 'playing';
    }
    return;
  }

  if (state === 'playing' && !paused) updatePlaying(dt);
}

// --- draw -------------------------------------------------------------------

function hudState() {
  return {
    score,
    wave,
    got: waveGot,
    target: waveTarget,
    hull: player.hull,
    maxHull: player.maxHull,
    comboMult: comboMult(),
    comboFrac: comboTimer > 0 ? comboTimer / COMBO_WINDOW : 0,
    dashFrac: player.dashFraction(),
    dashReady: player.dashReady,
    muted: synth.muted,
    hint: wave === 1 && state === 'playing' ? 'FLY CLOSE TO CORES — YOUR TRACTOR DOES THE REST' : '',
  };
}

function draw() {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  drawBackground(elapsed);

  if (state === 'title') {
    for (const c of decorCores) drawCore(ctx, c, elapsed);
    drawTitleScreen(ctx, W, H, elapsed, best);
    ctx.restore();
    return;
  }

  drawTractorBeams(ctx, cores, player);
  for (const c of cores) drawCore(ctx, c, elapsed);
  for (const h of hunters) drawHunter(ctx, h, elapsed);
  if (state !== 'gameover') player.draw(ctx, elapsed);
  particles.draw(ctx);
  drawHUD(ctx, hudState(), W);

  if (state === 'waveclear') {
    drawBanner(ctx, W, H, `WAVE ${wave} CLEAR`, 'HULL PATCHED +1 — INBOUND: MORE HUNTERS', Math.min(1, bannerTimer));
  } else if (paused && state === 'playing') {
    drawBanner(ctx, W, H, 'PAUSED', 'PRESS P TO RESUME');
  } else if (state === 'gameover') {
    drawGameOverScreen(ctx, W, H, score, best, wave);
  }
  ctx.restore();
}

// --- input wiring -------------------------------------------------------------

function tryStart() {
  synth.ensure();
  if (state === 'title' || state === 'gameover') startRun();
}

canvas.addEventListener('mousedown', tryStart);
window.addEventListener('keydown', () => synth.ensure());

// Decorative drifting cores for the title screen.
{
  const rng = mulberry32(777);
  for (let i = 0; i < 6; i++) decorCores.push(spawnCore(W, H, rng));
}

// --- screenshot staging -----------------------------------------------------
// ?shot=title|play|over builds one deterministic scene with a seeded
// RNG, draws it, and flags readiness. Normal play never takes this path.

const shotMode = new URLSearchParams(window.location.search).get('shot');

function stageShot(mode) {
  const rng = mulberry32(4242);
  player.reset();
  particles.clear();
  score = 0;
  best = 0;
  comboCount = 0;
  comboTimer = 0;

  if (mode === 'title') {
    state = 'title';
    decorCores = [];
    for (let i = 0; i < 6; i++) decorCores.push(spawnCore(W, H, rng));
  } else if (mode === 'play') {
    state = 'playing';
    wave = 2;
    waveTarget = waveQuota(2);
    waveGot = 5;
    waveSpawned = waveTarget;
    score = 650;
    comboCount = 4;
    comboTimer = 2.6;
    player.x = 470;
    player.y = 320;
    player.vx = 150;
    player.vy = -60;
    player.angle = Math.atan2(-60, 150);
    player.hull = 2;
    cores = [
      { x: 545, y: 285, vx: 0, vy: 0, r: 9, phase: 0.6, tractored: true },
      { x: 250, y: 180, vx: 0, vy: 0, r: 9, phase: 2.1, tractored: false },
      { x: 700, y: 430, vx: 0, vy: 0, r: 9, phase: 4.0, tractored: false },
      { x: 610, y: 150, vx: 0, vy: 0, r: 9, phase: 5.3, tractored: false },
      { x: 180, y: 430, vx: 0, vy: 0, r: 9, phase: 1.2, tractored: false },
    ];
    hunters = [
      { x: 640, y: 235, vx: -70, vy: 45, r: 13, speed: 116, phase: 0.4, angle: Math.atan2(45, -70) },
      { x: 320, y: 445, vx: 65, vy: -50, r: 13, speed: 116, phase: 2.4, angle: Math.atan2(-50, 65) },
      { x: 760, y: 360, vx: -85, vy: -15, r: 13, speed: 116, phase: 4.4, angle: Math.atan2(-15, -85) },
    ];
    particles.spawn(520, 300, { count: 12, color: '#7df9ff', speed: 160, life: 0.5, size: 3 });
    particles.spawn(430, 350, { count: 8, color: '#ffb340', speed: 90, life: 0.4, size: 3 });
    for (const p of particles.list) p.life = p.max * 0.75;
  } else if (mode === 'over') {
    state = 'gameover';
    wave = 3;
    waveTarget = waveQuota(3);
    waveGot = 4;
    score = 1875;
    best = 1875;
    player.hull = 0;
    hunters = [
      { x: 300, y: 220, vx: 30, vy: 20, r: 13, speed: 130, phase: 1.1, angle: 0.6 },
      { x: 660, y: 400, vx: -25, vy: -18, r: 13, speed: 130, phase: 3.3, angle: -2.4 },
    ];
    cores = [
      { x: 220, y: 470, vx: 0, vy: 0, r: 9, phase: 0.9, tractored: false },
      { x: 760, y: 150, vx: 0, vy: 0, r: 9, phase: 2.8, tractored: false },
    ];
    particles.spawn(480, 300, { count: 30, color: '#f2f6ff', speed: 300, life: 0.9, size: 3.4 });
    for (const p of particles.list) p.life = p.max * 0.5;
  }
  elapsed = 2.4; // a fixed clock, so twinkles and pulses match every run
  draw();
  window.__shotReady = true;
}

// --- boot ---------------------------------------------------------------------

initInput(canvas);

if (shotMode) {
  stageShot(shotMode);
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (enterPressed() || input.mouse.clicked) tryStart();
    if (input.pressed.has('KeyP') && state === 'playing') paused = !paused;
    if (input.pressed.has('KeyM')) {
      synth.ensure();
      synth.toggleMute();
    }

    if (!paused) update(dt);
    draw();
    endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
