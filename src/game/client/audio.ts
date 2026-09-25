// Процедурные звуки на WebAudio — без внешних файлов.
import type { ShotWeapon } from '../shared/types';

type AC = AudioContext;

const SHOT: Record<ShotWeapon, { f: number; d: number; v: number; thump: number }> = {
  pistol: { f: 2200, d: 0.1, v: 0.55, thump: 150 },
  smg: { f: 2600, d: 0.07, v: 0.42, thump: 170 },
  rifle: { f: 1700, d: 0.12, v: 0.6, thump: 115 },
  shotgun: { f: 1000, d: 0.26, v: 0.85, thump: 75 },
  sniper: { f: 1400, d: 0.42, v: 0.95, thump: 60 },
  lmg: { f: 1500, d: 0.1, v: 0.6, thump: 95 },
  rpg: { f: 600, d: 0.45, v: 0.7, thump: 55 },
  bot: { f: 2000, d: 0.08, v: 0.38, thump: 160 },
  bomb: { f: 600, d: 0.45, v: 0.7, thump: 55 },
};

class Sfx {
  private ctx: AC | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.7;
  private last: Record<string, number> = {};

  init() {
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      const master = ctx.createGain();
      master.gain.value = this.volume;
      master.connect(comp).connect(ctx.destination);
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noise = buf;
    } catch {
      this.ctx = null;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private ok(key: string, gapMs: number): AC | null {
    const c = this.ctx;
    if (!c || !this.master || c.state !== 'running') return null;
    const now = performance.now();
    if ((this.last[key] ?? 0) + gapMs > now) return null;
    this.last[key] = now;
    return c;
  }

  private noiseHit(c: AC, t: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 0.8) {
    if (!this.noise || !this.master) return;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  private tone(c: AC, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.005) {
    if (!this.master) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  shot(w: ShotWeapon, vol = 1) {
    if (vol < 0.03) return;
    const c = this.ok('shot' + w + (vol < 1 ? 'r' : ''), vol < 1 ? 35 : 20);
    if (!c) return;
    const p = SHOT[w];
    const t = c.currentTime;
    const v = p.v * vol;
    this.noiseHit(c, t, p.d, v, 'lowpass', p.f * 2.2, p.f * 0.25, 0.7);
    this.tone(c, t, 'sine', p.thump * 2, p.thump * 0.5, 0.14, v * 0.8);
    if (w === 'sniper') this.noiseHit(c, t + 0.02, 0.6, v * 0.25, 'bandpass', 900, 200, 0.5);
    if (w === 'rpg') this.noiseHit(c, t, 0.5, v * 0.5, 'bandpass', 400, 2400, 1.5);
  }

  explosion(vol = 1) {
    const c = this.ok('boom', 40);
    if (!c) return;
    const t = c.currentTime;
    this.noiseHit(c, t, 1.1, 1.0 * vol, 'lowpass', 1800, 60, 0.6);
    this.tone(c, t, 'sine', 120, 30, 0.8, 0.9 * vol, 0.01);
    this.noiseHit(c, t + 0.05, 0.4, 0.4 * vol, 'highpass', 3000, 800, 0.5);
  }

  hit(head: boolean) {
    const c = this.ok('hit', 30);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'triangle', head ? 1900 : 1500, head ? 2400 : 1300, 0.06, 0.28);
    if (head) this.tone(c, t + 0.05, 'sine', 2600, 2600, 0.09, 0.2);
  }

  kill() {
    const c = this.ok('kill', 60);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'square', 660, 660, 0.07, 0.14);
    this.tone(c, t + 0.06, 'square', 990, 990, 0.12, 0.14);
    this.tone(c, t + 0.06, 'sine', 1320, 1320, 0.25, 0.18);
  }

  hurt() {
    const c = this.ok('hurt', 90);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'sine', 180, 70, 0.18, 0.5);
    this.noiseHit(c, t, 0.12, 0.25, 'lowpass', 900, 200);
  }

  death() {
    const c = this.ok('death', 300);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'sawtooth', 420, 60, 0.9, 0.22, 0.01);
    this.noiseHit(c, t, 0.6, 0.5, 'lowpass', 2000, 80);
  }

  reload() {
    const c = this.ok('reload', 100);
    if (!c) return;
    const t = c.currentTime;
    this.noiseHit(c, t, 0.05, 0.3, 'bandpass', 2500, 1800, 3);
    this.noiseHit(c, t + 0.18, 0.05, 0.3, 'bandpass', 1800, 1200, 3);
  }

  reloadEnd() {
    const c = this.ok('reloadEnd', 100);
    if (!c) return;
    const t = c.currentTime;
    this.noiseHit(c, t, 0.06, 0.35, 'bandpass', 3200, 2000, 4);
    this.tone(c, t, 'square', 900, 1200, 0.04, 0.06);
  }

  empty() {
    const c = this.ok('empty', 150);
    if (!c) return;
    this.noiseHit(c, c.currentTime, 0.03, 0.25, 'highpass', 4000, 3000, 2);
  }

  jump() {
    const c = this.ok('jump', 100);
    if (!c) return;
    this.tone(c, c.currentTime, 'sine', 220, 440, 0.1, 0.12);
  }

  land() {
    const c = this.ok('land', 120);
    if (!c) return;
    const t = c.currentTime;
    this.noiseHit(c, t, 0.1, 0.3, 'lowpass', 600, 100);
    this.tone(c, t, 'sine', 110, 50, 0.1, 0.3);
  }

  step() {
    const c = this.ok('step', 120);
    if (!c) return;
    this.noiseHit(c, c.currentTime, 0.05, 0.08, 'lowpass', 700, 200);
  }

  pickup() {
    const c = this.ok('pickup', 100);
    if (!c) return;
    const t = c.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(c, t + i * 0.05, 'triangle', f, f, 0.12, 0.18));
  }

  spawn() {
    const c = this.ok('spawn', 200);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'sine', 300, 900, 0.35, 0.2, 0.02);
    this.noiseHit(c, t, 0.35, 0.15, 'bandpass', 600, 3000, 2);
  }

  click() {
    const c = this.ok('click', 40);
    if (!c) return;
    this.tone(c, c.currentTime, 'triangle', 800, 600, 0.05, 0.12);
  }

  swap() {
    const c = this.ok('swap', 80);
    if (!c) return;
    const t = c.currentTime;
    this.noiseHit(c, t, 0.06, 0.2, 'bandpass', 1500, 900, 2);
  }

  correct() {
    const c = this.ok('correct', 200);
    if (!c) return;
    const t = c.currentTime;
    [523, 659, 784].forEach((f, i) => this.tone(c, t + i * 0.08, 'triangle', f, f, 0.22, 0.25));
    this.tone(c, t + 0.24, 'sine', 1046, 1046, 0.45, 0.25);
  }

  wrong() {
    const c = this.ok('wrong', 200);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'sawtooth', 220, 180, 0.25, 0.2);
    this.tone(c, t + 0.22, 'sawtooth', 160, 110, 0.4, 0.22);
  }

  tick(urgent: boolean) {
    const c = this.ok('tick', 150);
    if (!c) return;
    this.tone(c, c.currentTime, 'square', urgent ? 1200 : 800, urgent ? 1200 : 800, 0.04, urgent ? 0.12 : 0.06);
  }

  lock() {
    const c = this.ok('lock', 150);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'square', 300, 120, 0.15, 0.15);
    this.noiseHit(c, t, 0.08, 0.2, 'lowpass', 1200, 300);
  }

  countdown(final: boolean) {
    const c = this.ok('cd' + final, 300);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'square', final ? 1046 : 523, final ? 1046 : 523, final ? 0.5 : 0.15, 0.16);
    if (final) this.tone(c, t, 'sawtooth', 523, 523, 0.5, 0.08);
  }

  beep(fast: boolean) {
    const c = this.ok('beep', fast ? 120 : 250);
    if (!c) return;
    this.tone(c, c.currentTime, 'square', fast ? 1500 : 1100, fast ? 1500 : 1100, 0.06, 0.16);
  }

  powerup() {
    const c = this.ok('powerup', 150);
    if (!c) return;
    const t = c.currentTime;
    [440, 660, 880, 1320].forEach((f, i) => this.tone(c, t + i * 0.04, 'square', f, f * 1.2, 0.12, 0.14));
  }

  melee() {
    const c = this.ok('melee', 150);
    if (!c) return;
    this.noiseHit(c, c.currentTime, 0.15, 0.35, 'bandpass', 800, 2500, 1.2);
  }

  wave() {
    const c = this.ok('wave', 500);
    if (!c) return;
    const t = c.currentTime;
    this.tone(c, t, 'sawtooth', 220, 220, 0.3, 0.12);
    this.tone(c, t + 0.3, 'sawtooth', 294, 294, 0.5, 0.12);
  }
}

export const sfx = new Sfx();
