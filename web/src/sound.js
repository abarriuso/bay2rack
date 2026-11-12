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
  if (v) wake();
}

// the audio, made on the first click or key of the page (the only moment a browser allows it)
function wake() {
  if (!on) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
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
const vary = (x, k = 0.08) => x * (1 + (Math.random() * 2 - 1) * k);

// a voice: source -> filter -> envelope -> pan -> out, gone when it is done
function voice(src, at, { gain = 1, attack = 0.001, decay = 0.05, pan = 0, filter = null }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
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
  // a cable plugged in: a small, soft click
  plug(pan = 0) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005, p = vary(1, 0.1);
    hiss(t, { freq: 3000 * p, q: 2.5, gain: 0.22, decay: 0.018, pan });
    tone(t, { freq: 380 * p, to: 260 * p, gain: 0.15, decay: 0.03, drop: 0.02, pan });
  },
};
