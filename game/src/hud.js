// Every screen surface is drawn on the canvas from here: the in-play
// HUD (score, combo meter, wave quota, hull pips, dash charge),
// centre banners (wave clear, paused), and the title and game-over
// screens. No DOM overlays, so screenshots show exactly what a
// player sees.

const FONT = '"Segoe UI", system-ui, sans-serif';

function text(ctx, str, x, y, { size = 16, color = '#dbe7ff', align = 'left', bold = false, alpha = 1 } = {}) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

// s: { score, wave, got, target, hull, maxHull, comboMult, comboFrac,
//      dashFrac, dashReady, muted, hint }
export function drawHUD(ctx, s, w) {
  // Score, top-left.
  text(ctx, 'SCORE', 22, 30, { size: 12, color: '#7f97c4', bold: true });
  text(ctx, String(s.score).padStart(6, '0'), 22, 58, { size: 26, bold: true });

  // Combo: multiplier and its draining meter, under the score. The
  // meter only shows while a combo is live.
  if (s.comboMult > 1 || s.comboFrac > 0) {
    const hot = s.comboMult >= 5;
    text(ctx, `COMBO x${s.comboMult}`, 22, 84, {
      size: 15, bold: true, color: hot ? '#ffb340' : '#7df9ff',
    });
    ctx.fillStyle = 'rgba(125,249,255,0.16)';
    ctx.fillRect(22, 92, 120, 5);
    ctx.fillStyle = hot ? '#ffb340' : '#40e0ff';
    ctx.fillRect(22, 92, 120 * Math.max(0, Math.min(1, s.comboFrac)), 5);
  }

  // Wave and core quota, top-centre.
  text(ctx, `WAVE ${s.wave}`, w / 2, 34, { size: 19, bold: true, align: 'center' });
  text(ctx, `CORES ${s.got} / ${s.target}`, w / 2, 58, { size: 14, color: '#7df9ff', align: 'center' });

  // Hull pips, top-right: filled amber diamonds, empty ones outlined.
  for (let i = 0; i < s.maxHull; i++) {
    const cx = w - 30 - i * 26;
    const cy = 30;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    if (i < s.hull) {
      ctx.fillStyle = '#ffb340';
      ctx.fillRect(-7, -7, 14, 14);
    } else {
      ctx.strokeStyle = 'rgba(255,179,64,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-7, -7, 14, 14);
    }
    ctx.restore();
  }
  text(ctx, 'HULL', w - 22, 62, { size: 11, color: '#7f97c4', bold: true, align: 'right' });

  // Dash charge under the hull pips: a thin bar that fills as the
  // cooldown runs out and flashes READY when charged.
  const dw = 78;
  const dx = w - 22 - dw;
  ctx.fillStyle = 'rgba(125,249,255,0.16)';
  ctx.fillRect(dx, 72, dw, 5);
  ctx.fillStyle = s.dashReady ? '#7df9ff' : '#3d7ea6';
  ctx.fillRect(dx, 72, dw * Math.max(0, Math.min(1, s.dashFrac)), 5);
  text(ctx, s.dashReady ? 'DASH READY' : 'DASH', w - 22, 92, {
    size: 11, bold: true, align: 'right', color: s.dashReady ? '#7df9ff' : '#54678f',
  });

  // First-wave control reminder along the bottom.
  if (s.hint) {
    text(ctx, s.hint, w / 2, 578, { size: 14, color: '#8fa8d8', align: 'center', alpha: 0.85 });
  }

  if (s.muted) {
    text(ctx, 'MUTED', w - 22, 578, { size: 12, color: '#54678f', align: 'right', bold: true });
  }
}

// A centred banner: big title, one subtitle line, optional fade.
export function drawBanner(ctx, w, h, title, sub, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(4,8,22,0.45)';
  ctx.fillRect(0, h / 2 - 64, w, 128);
  ctx.fillStyle = 'rgba(125,249,255,0.5)';
  ctx.fillRect(0, h / 2 - 64, w, 2);
  ctx.fillRect(0, h / 2 + 62, w, 2);
  text(ctx, title, w / 2, h / 2 + 2, { size: 38, bold: true, align: 'center' });
  if (sub) text(ctx, sub, w / 2, h / 2 + 36, { size: 16, color: '#9fc6ff', align: 'center' });
  ctx.globalAlpha = 1;
}

export function drawTitleScreen(ctx, w, h, t, best) {
  // A soft panel behind the words so they read over the starfield.
  ctx.fillStyle = 'rgba(4,8,22,0.55)';
  ctx.fillRect(0, 120, w, 330);

  text(ctx, 'ORBITAL SALVAGE', w / 2, 218, { size: 58, bold: true, align: 'center', color: '#f2f6ff' });
  text(ctx, 'The belt is full of lost reactor cores. Bring them home — the hunters disagree.',
    w / 2, 256, { size: 16, color: '#9fc6ff', align: 'center' });

  text(ctx, 'WASD / ARROWS — fly        SHIFT / SPACE — dash', w / 2, 312,
    { size: 15, color: '#dbe7ff', align: 'center' });
  text(ctx, 'Fly close to cores to tractor them in. Chain pickups to raise your combo.',
    w / 2, 338, { size: 15, color: '#dbe7ff', align: 'center' });
  text(ctx, 'A hunter touch costs 1 hull. Clear a wave to patch 1 back.',
    w / 2, 364, { size: 15, color: '#dbe7ff', align: 'center' });

  const blink = 0.55 + 0.45 * Math.sin(t * 3.2);
  text(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', w / 2, 416,
    { size: 19, bold: true, align: 'center', color: '#ffb340', alpha: blink });

  if (best > 0) {
    text(ctx, `BEST ${best}`, w / 2, 486, { size: 15, color: '#7f97c4', align: 'center', bold: true });
  }
}

export function drawGameOverScreen(ctx, w, h, score, best, wave) {
  ctx.fillStyle = 'rgba(10,4,14,0.6)';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'DRONE DOWN', w / 2, 208, { size: 52, bold: true, align: 'center', color: '#ff5c8a' });
  text(ctx, `The belt keeps what it caught on wave ${wave}.`, w / 2, 246,
    { size: 16, color: '#c9a4b8', align: 'center' });

  text(ctx, 'FINAL SCORE', w / 2, 312, { size: 13, color: '#7f97c4', align: 'center', bold: true });
  text(ctx, String(score), w / 2, 356, { size: 44, bold: true, align: 'center' });
  text(ctx, score >= best && score > 0 ? `NEW BEST — WAVE ${wave}` : `BEST ${best} — WAVE ${wave}`,
    w / 2, 388, { size: 16, color: '#ffb340', align: 'center', bold: true });

  text(ctx, 'PRESS ENTER TO FLY AGAIN', w / 2, 452,
    { size: 18, bold: true, align: 'center', color: '#7df9ff' });
}
