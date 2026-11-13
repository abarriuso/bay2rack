// The sounds of the build coming together (assemble.js), made here with Web Audio: no files to load. A plastic
// module snaps in with a clack, the adapter and the side panel seat with a deeper thunk, a screw ratchets in and
// tightens with a tick, a piece lifting off the table brushes the air. Short, soft, a little different each time
// (the same click a dozen times sounds like a machine). A browser lets a page make a sound only after a click or a
// key on it: before that they are silent. The key in the 3D view's bar mutes them (remembered).
const KEY = 'sound';
let ctx = null, out = null, noise = null;
let on = (() => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } })();

export const soundOn = () => on;
export function setSound(v) {
  on = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode */ }
  if (v) wake(); else hushAir();
  told();
}
// whether the sounds can be heard now (on, and the browser has let the page make them: a click or a key on it)
export const audible = () => !!(on && ctx && ctx.state === 'running');
// (the page is told when that changes: the film offers its key until then)
const told = () => dispatchEvent(new Event('b2r:sound'));

// the audio, made on the first click or key of the page (the only moment a browser allows it)
function wake() {
  if (!on) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      ctx.onstatechange = told;
      // a gentle limiter at the end: twenty screws at once never clip
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12;
      out = ctx.createGain();
      out.gain.value = 0.55;
      out.connect(comp).connect(ctx.destination);
      const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noise = n;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, wake, { passive: true, capture: true });

const live = () => on && ctx && ctx.state === 'running';
// the sounds of the scroll (the PC built as the page goes down) are quieter than the editor's: softly(k, ...) plays
// what it calls at k of their level
let level = 1;
export function softly(k, fn) {
  const was = level;
  level = was * k;
  try { fn(); } finally { level = was; }
}
const vary = (x, k = 0.08) => x * (1 + (Math.random() * 2 - 1) * k);

// a voice: source -> filter -> envelope -> pan -> out, gone when it is done
function voice(src, at, { gain = 1, attack = 0.001, decay = 0.05, pan = 0, filter = null }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain * level, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, at + attack + decay);
  let node = src;
  if (filter) { node.connect(filter); node = filter; }
  node.connect(g);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(out); } else g.connect(out);
  src.start(at);
  src.stop(at + attack + decay + 0.05);
}
function hiss(at, { type = 'bandpass', freq = 2000, q = 1, ...rest }) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  s.playbackRate.value = vary(1, 0.2);
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  voice(s, at, { ...rest, filter: f });
  return f;
}
function tone(at, { freq = 200, to = freq, type = 'sine', drop = 0.06, ...rest }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + drop);
  voice(o, at, rest);
}

export const sfx = {
  // a printed module locking into its rails: a bright clack over a short knock of the body
  snap(pan = 0, size = 1) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005, p = vary(1, 0.06) / Math.sqrt(size);
    hiss(t, { freq: 2600 * p, q: 1.6, gain: 0.55, decay: 0.035, pan });
    hiss(t + 0.012, { freq: 4200 * p, q: 3, gain: 0.25, decay: 0.02, pan });          // the latch, a hair later
    tone(t, { freq: 210 * p, to: 95 * p, gain: 0.5, decay: 0.09, drop: 0.07, pan });
  },
  // the adapter sliding home in the bays, the side panel shutting: deep, with a little rattle of metal
  thunk(pan = 0) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005, p = vary(1, 0.05);
    tone(t, { freq: 110 * p, to: 48 * p, gain: 0.9, decay: 0.22, drop: 0.16, pan });
    hiss(t, { type: 'lowpass', freq: 900 * p, q: 0.7, gain: 0.6, decay: 0.09, pan });
    hiss(t + 0.03, { freq: 3800 * p, q: 6, gain: 0.12, decay: 0.08, pan });
  },
  // a screw turning in: `turns` ratchet ticks, closer together as it goes, the last one tight
  screw(pan = 0, ms = 320, turns = 4) {
    if (!live()) return;
    const t0 = ctx.currentTime + 0.005, p = vary(1, 0.1);
    for (let i = 0; i < turns; i++) {
      const k = i / turns, at = t0 + (ms / 1000) * (1 - (1 - k) * (1 - k));
      hiss(at, { type: 'highpass', freq: 3500 * p, q: 0.8, gain: 0.12 + 0.08 * k, decay: 0.012, pan });
    }
    const end = t0 + ms / 1000;
    hiss(end, { freq: 5200 * p, q: 4, gain: 0.35, decay: 0.02, pan });
    tone(end, { freq: 900 * p, to: 600 * p, type: 'triangle', gain: 0.12, decay: 0.03, drop: 0.02, pan });
  },
  // a piece lifting off the table: a soft breath of air
  lift(pan = 0, ms = 500) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005;
    const f = hiss(t, { freq: 500, q: 0.8, gain: 0.07, attack: ms / 2600, decay: ms / 1000, pan });
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + ms / 1000);
  },
  // a cable plugged in: a small, soft click (`delay` s later)
  plug(pan = 0, delay = 0) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005 + delay, p = vary(1, 0.1);
    hiss(t, { freq: 3000 * p, q: 2.5, gain: 0.22, decay: 0.018, pan });
    tone(t, { freq: 380 * p, to: 260 * p, gain: 0.15, decay: 0.03, drop: 0.02, pan });
  },

  // ...and the same backwards, the scroll going up: the PC comes apart onto the table
  // a module pulled out of its rails: the latch lets go, a short scrape out
  unsnap(pan = 0, size = 1) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005, p = vary(1, 0.06) / Math.sqrt(size);
    hiss(t, { freq: 3600 * p, q: 3, gain: 0.3, decay: 0.018, pan });
    tone(t + 0.008, { freq: 120 * p, to: 190 * p, gain: 0.28, decay: 0.06, drop: 0.05, pan });
    const f = hiss(t + 0.015, { freq: 900 * p, q: 0.9, gain: 0.14, attack: 0.012, decay: 0.08, pan });
    f.frequency.setValueAtTime(900 * p, t + 0.015);
    f.frequency.exponentialRampToValueAtTime(2400 * p, t + 0.1);
  },
  // the adapter sliding out of the bays, the side panel opening: a low slide and a soft knock
  unthunk(pan = 0) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005, p = vary(1, 0.05);
    const f = hiss(t, { type: 'lowpass', freq: 1100 * p, q: 0.7, gain: 0.4, attack: 0.03, decay: 0.16, pan });
    f.frequency.setValueAtTime(1100 * p, t);
    f.frequency.exponentialRampToValueAtTime(380 * p, t + 0.18);
    tone(t + 0.02, { freq: 95 * p, to: 70 * p, gain: 0.45, decay: 0.14, drop: 0.1, pan });
  },
  // a screw coming out: the tight first turn cracks, then the ratchet, its ticks further apart
  unscrew(pan = 0, ms = 300, turns = 3) {
    if (!live()) return;
    const t0 = ctx.currentTime + 0.005, p = vary(1, 0.1);
    hiss(t0, { freq: 5200 * p, q: 4, gain: 0.3, decay: 0.02, pan });
    for (let i = 1; i <= turns; i++) {
      const k = i / turns, at = t0 + 0.02 + (ms / 1000) * k * k;
      hiss(at, { type: 'highpass', freq: 3300 * p, q: 0.8, gain: 0.18 - 0.08 * k, decay: 0.012, pan });
    }
  },
  // a piece set down on the table: a soft, low tap
  land(pan = 0) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005, p = vary(1, 0.08);
    tone(t, { freq: 150 * p, to: 88 * p, gain: 0.32, decay: 0.08, drop: 0.06, pan });
    hiss(t, { type: 'lowpass', freq: 1300 * p, q: 0.7, gain: 0.18, decay: 0.035, pan });
  },
  // a cable pulled out: a click, a little higher than going in
  unplug(pan = 0, delay = 0) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005 + delay, p = vary(1, 0.1);
    hiss(t, { freq: 3600 * p, q: 2.5, gain: 0.18, decay: 0.015, pan });
    tone(t, { freq: 300 * p, to: 420 * p, gain: 0.1, decay: 0.025, drop: 0.02, pan });
  },
  // the PC built, the editor is yours: a low settle under a faint, airy chord
  settle() {
    if (!live()) return;
    const t = ctx.currentTime + 0.01;
    tone(t, { freq: 92, to: 62, gain: 0.3, decay: 0.32, drop: 0.25 });
    hiss(t, { type: 'lowpass', freq: 700, q: 0.7, gain: 0.12, decay: 0.12 });
    for (const [f, g, d] of [[660, 0.035, 0.9], [990, 0.025, 0.8], [1320, 0.015, 0.7]])
      tone(t + 0.04, { freq: f, gain: g, attack: 0.03, decay: d, pan: (f - 990) / 1400 });
  },
};

// The air of the scroll: while the stage closes into the editor and the PC is built, a faint breath that follows how
// fast the page moves (`speed`: the stretch's fractions a second), a little higher on the way down than up; 0 lets
// it die away.
let air = null, airOff = 0;
function hushAir() {
  clearTimeout(airOff);
  if (!air) return;
  const a = air;
  air = null;
  try { a.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); a.src.stop(ctx.currentTime + 0.3); } catch { /* gone */ }
}
export function drift(speed, down = true) {
  if (!live()) return;
  const k = Math.min(1, Math.max(0, speed) / 1.4);
  if (!air) {
    if (k < 0.02) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(out);
    src.start();
    air = { src, f, g };
  }
  const now = ctx.currentTime;
  air.g.gain.setTargetAtTime(0.075 * level * k * (2 - k), now, k ? 0.06 : 0.18);
  air.f.frequency.setTargetAtTime((down ? 620 : 440) * (1 + 1.2 * k), now, 0.1);
  clearTimeout(airOff);
  // (still for a while: the source goes)
  if (k < 0.02) airOff = setTimeout(hushAir, 900);
}
