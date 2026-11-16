// A tiny WebAudio synth: every sound is oscillators, filtered noise
// and gain envelopes — no samples, no files. The context is created
// lazily on the first user gesture (browser autoplay rules), and M
// toggles a master mute. Every method is safe to call before the
// context exists; it simply stays silent.

export class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  // Create (or resume) the context. Call from click / key handlers.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.45;
    this.master.connect(this.ctx.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  }

  // One oscillator note with an exponential decay envelope.
  tone(freq, dur, { type = 'sine', vol = 0.3, slideTo = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A short burst of filtered noise: thuds and whooshes.
  noise(dur, { vol = 0.3, delay = 0, from = 400, to = 1200, type = 'bandpass' } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  // Pickup blip: the pitch climbs with the combo multiplier, with a
  // quiet fifth above it for sparkle.
  pickup(multiplier) {
    const step = Math.min(8, Math.max(1, multiplier)) - 1;
    const freq = 540 * Math.pow(2, step / 4);
    this.tone(freq, 0.12, { type: 'sine', vol: 0.32 });
    this.tone(freq * 1.5, 0.16, { type: 'triangle', vol: 0.14, delay: 0.03 });
  }

  // Hull hit: a low thud plus a crunch of lowpassed noise.
  hit() {
    this.tone(130, 0.28, { type: 'sine', vol: 0.5, slideTo: 38 });
    this.noise(0.2, { vol: 0.3, from: 900, to: 120, type: 'lowpass' });
  }

  // Dash: a quick upward whoosh.
  dash() {
    this.noise(0.18, { vol: 0.22, from: 300, to: 2400 });
    this.tone(220, 0.14, { type: 'sawtooth', vol: 0.06, slideTo: 660 });
  }

  // Wave cleared: a bright four-note arpeggio.
  waveClear() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.26, delay: i * 0.07 }));
  }

  // Game over: a slow four-note descent.
  gameOver() {
    const notes = [392, 329.63, 261.63, 196];
    notes.forEach((f, i) => this.tone(f, 0.34, { type: 'sawtooth', vol: 0.16, delay: i * 0.16 }));
    this.noise(0.7, { vol: 0.1, from: 600, to: 80, type: 'lowpass', delay: 0.1 });
  }
}
