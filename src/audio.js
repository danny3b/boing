// Kreskówkowe dźwięki syntezowane w WebAudio — zero plików audio.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.voice = true;
    this.plVoice = null;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    if ('speechSynthesis' in window) {
      const pickVoice = () => {
        const vs = speechSynthesis.getVoices();
        this.plVoice = vs.find((v) => v.lang && v.lang.toLowerCase().startsWith('pl')) || null;
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  get ok() { return this.ctx && !this.muted; }

  osc({ type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.3, delay = 0, vib = 0, vibF = 0, lin = false }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (lin) o.frequency.linearRampToValueAtTime(f1, t + dur);
    else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (vib) {
      const l = c.createOscillator();
      l.frequency.value = vibF;
      const lg = c.createGain();
      lg.gain.value = vib;
      l.connect(lg).connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.3, type = 'lowpass', f0 = 1000, f1 = f0, q = 1, delay = 0 }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  boing(k = 1) {
    this.osc({ f0: 110, f1: 420, dur: 0.45, vol: 0.35 * Math.min(1, k), vib: 60 * k, vibF: 16 });
    this.osc({ type: 'triangle', f0: 220, f1: 640, dur: 0.3, vol: 0.12, vib: 40, vibF: 22 });
  }
  bonk() {
    this.osc({ f0: 170, f1: 45, dur: 0.25, vol: 0.55 });
    this.noise({ dur: 0.08, vol: 0.3, f0: 900 });
  }
  drum() {
    this.bonk();
    this.osc({ f0: 90, f1: 40, dur: 0.4, vol: 0.5, delay: 0.02 });
    this.noise({ dur: 0.45, vol: 0.18, type: 'highpass', f0: 4000, delay: 0.05 });
  }
  slide() { this.osc({ f0: 1500, f1: 180, dur: 0.75, vol: 0.18, lin: true, vib: 25, vibF: 9 }); }
  squeak() {
    this.osc({ type: 'triangle', f0: 900, f1: 1800, dur: 0.08, vol: 0.2 });
    this.osc({ type: 'triangle', f0: 1800, f1: 1000, dur: 0.1, vol: 0.18, delay: 0.08 });
  }
  skid() {
    this.noise({ dur: 0.35, vol: 0.16, type: 'bandpass', f0: 2600, f1: 1500, q: 6 });
    this.osc({ type: 'triangle', f0: 1400, f1: 1100, dur: 0.25, vol: 0.05 });
  }
  ow() { this.osc({ type: 'triangle', f0: 700, f1: 420, dur: 0.15, vol: 0.15 }); }
  jump() { this.osc({ f0: 260, f1: 560, dur: 0.12, vol: 0.12 }); }
  land(v) { this.noise({ dur: 0.07, vol: Math.min(0.25, v * 0.02), f0: 380 }); }
  whoosh() { this.noise({ dur: 0.32, vol: 0.35, type: 'bandpass', f0: 300, f1: 2600, q: 2 }); }
  roll() { this.noise({ dur: 0.3, vol: 0.22, type: 'bandpass', f0: 700, f1: 180, q: 1.5 }); }
  pickup() {
    this.osc({ type: 'triangle', f0: 880, dur: 0.08, vol: 0.14 });
    this.osc({ type: 'triangle', f0: 1320, dur: 0.14, vol: 0.14, delay: 0.07 });
  }
  gum() {
    this.osc({ f0: 300, f1: 900, dur: 0.25, vol: 0.2 });
    this.noise({ dur: 0.06, vol: 0.4, type: 'highpass', f0: 2000, delay: 0.25 });
  }
  kiss() {
    this.osc({ f0: 700, f1: 1500, dur: 0.1, vol: 0.22 });
    this.noise({ dur: 0.05, vol: 0.2, type: 'highpass', f0: 3000, delay: 0.1 });
    [1046, 1318, 1568].forEach((f, i) => this.osc({ type: 'triangle', f0: f, dur: 0.3, vol: 0.1, delay: 0.15 + i * 0.08 }));
  }
  sizzle() { this.noise({ dur: 0.6, vol: 0.28, type: 'highpass', f0: 2500, f1: 5000 }); }
  tick() { this.osc({ type: 'square', f0: 1200, dur: 0.03, vol: 0.05 }); }
  cry() {
    this.osc({ f0: 560, f1: 380, dur: 1.1, vol: 0.13, vib: 35, vibF: 7 });
    this.osc({ f0: 520, f1: 340, dur: 1.2, vol: 0.12, vib: 35, vibF: 6, delay: 1.2 });
  }
  sadTrombone() {
    [392, 370, 349, 311].forEach((f, i) =>
      this.osc({ type: 'sawtooth', f0: f, f1: i === 3 ? 290 : f, dur: i === 3 ? 1.0 : 0.35, vol: 0.07, delay: i * 0.38, vib: i === 3 ? 12 : 0, vibF: 6 }));
  }
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => this.osc({ type: 'triangle', f0: f, dur: i === 3 ? 0.6 : 0.16, vol: 0.16, delay: i * 0.12 }));
  }

  say(text) {
    if (!this.voice || this.muted || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[!?.…]+/g, (m) => m[0]));
    u.lang = 'pl-PL';
    if (this.plVoice) u.voice = this.plVoice;
    u.pitch = 1.9;
    u.rate = 1.15;
    u.volume = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}
