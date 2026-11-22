// The sounds of Bay2Rack, made here with Web Audio: no files to load, nothing borrowed. They come from the world the
// page builds, a homelab inside a beige 90s tower on a workbench, and each is made the way that thing sounds: as a
// few short resonances of its body (a sum of decaying sines, its "modes") under a dry click of noise.
//   - a printed module is ABS plastic latching: a dry click, a small hollow plastic body, and the latch's tooth a hair
//     later (click-clack);
//   - the adapter and the side panel are sheet steel: a low knock, a faint long ring and a little rattle;
//   - a screw is a screwdriver biting into steel: a grind of the thread, a tick a turn, the head meeting the metal;
//   - a piece set down knocks on the wood of the bench; a cable's plug rubs, then seats;
//   - the page's keys are a short clicky key; a render is the hard disk seeking; its end, the PC speaker's beep - a
//     square wave softened under a low-pass, as it sounded from inside the case; the PC built powers on (the switch,
//     the fan winding up, one beep);
//   - the scroll's air is the case fan, spinning up and down with the page.
// All short, quiet, and a little different each time (the same click a dozen times sounds like a machine). A browser
// lets a page make sounds only after a click or a key on it. They are off until asked for (the speaker key, in the
// film and in the 3D view's bar; remembered), on every device: a page that makes noise unasked - in an office, on a
// train - is no workshop manners, and the film's key offers them all along. With reduced motion the fan, the sound of
// the page moving, stays still.
const KEY = 'sound';
const CALM = matchMedia('(prefers-reduced-motion: reduce)');
let ctx = null, out = null, noise = null;
let on = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();

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
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12;
      out = ctx.createGain();
      out.gain.value = 0.5;
      out.connect(comp).connect(ctx.destination);
      const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noise = n;
      setTimeout(told);                                   // (it may be running from the start: no state change)
    }
    // (iOS: 'interrupted' after a call or another app's audio - it comes back on the next touch)
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume().then(told, () => {});
  } catch { ctx = null; }
}
for (const ev of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend']) addEventListener(ev, wake, { passive: true, capture: true });

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
const soon = (delay = 0) => ctx.currentTime + 0.005 + delay;

// where a sound goes: (a pan ->) out
function toOut(node, pan) {
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p).connect(out);
  } else node.connect(out);
}
// a burst of noise, a few ms, through a filter: the dry part of a knock or a click
function click(at, { freq = 3000, q = 1, type = 'bandpass', gain = 0.2, len = 0.006, pan = 0 }) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain * level, at);
  g.gain.exponentialRampToValueAtTime(1e-4, at + len);
  s.connect(f).connect(g);
  toOut(g, pan);
  s.start(at, Math.random() * 0.9);                       // (another grain of the noise each time)
  s.stop(at + len + 0.02);
}
// the body that rings after it: [frequency, level, decay s] a mode, each a sine dying away
function body(at, modes, { gain = 1, pan = 0 } = {}) {
  const sum = ctx.createGain();
  sum.gain.value = gain * level;
  toOut(sum, pan);
  for (const [f, a, d] of modes) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = vary(f, 0.015);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(a, at + 0.0015);
    g.gain.exponentialRampToValueAtTime(1e-4, at + 0.0015 + d);
    o.connect(g).connect(sum);
    o.start(at);
    o.stop(at + d + 0.03);
  }
}
// noise that swells and fades with its filter sweeping: air, a slide, a grind
function swish(at, { from, to = from, q = 1, type = 'bandpass', gain = 0.1, attack = 0.01, dur = 0.1, pan = 0 }) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  s.loop = true;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + attack + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain * level, at + attack);
  g.gain.exponentialRampToValueAtTime(1e-4, at + attack + dur);
  s.connect(f).connect(g);
  toOut(g, pan);
  s.start(at, Math.random() * 0.9);
  s.stop(at + attack + dur + 0.03);
}
// the PC speaker: a square wave held for `dur`, rounded under a low-pass (from inside the case, never shrill)
function beep(at, { freq, dur, gain, pan = 0 }) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.value = freq * 1.5; f.Q.value = 0.5;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain * level, at + 0.005);
  g.gain.setValueAtTime(gain * level, at + dur);
  g.gain.setTargetAtTime(0, at + dur, 0.012);
  o.connect(f).connect(g);
  toOut(g, pan);
  o.start(at);
  o.stop(at + dur + 0.1);
}

export const sfx = {
  // a printed module locking into its rails: a dry click, its small plastic body, the latch's tooth a hair later
  snap(pan = 0, size = 1) {
    if (!live()) return;
    const t = soon(), p = vary(1, 0.05) / Math.sqrt(size);
    click(t, { freq: 3200 * p, q: 0.9, gain: 0.42, len: 0.008, pan });
    body(t, [[176 * p, 0.32, 0.06], [690 * p, 0.45, 0.045], [1530 * p, 0.26, 0.03], [2710 * p, 0.13, 0.02]], { gain: 0.7, pan });
    click(t + vary(0.017, 0.15), { freq: 4700 * p, q: 2, gain: 0.17, len: 0.005, pan });
  },
  // ...and pulled out: the tooth lets go first, then the plastic scrapes out of the rails
  unsnap(pan = 0, size = 1) {
    if (!live()) return;
    const t = soon(), p = vary(1, 0.05) / Math.sqrt(size);
    click(t, { freq: 4400 * p, q: 2, gain: 0.22, len: 0.005, pan });
    body(t + 0.01, [[640 * p, 0.26, 0.03], [1460 * p, 0.14, 0.022]], { gain: 0.6, pan });
    swish(t + 0.02, { from: 1200 * p, to: 2600 * p, q: 1.2, gain: 0.09, attack: 0.012, dur: 0.07, pan });
  },
  // the adapter home in the bays, the side panel shut: sheet steel - a low knock, a faint long ring, a little rattle
  thunk(pan = 0) {
    if (!live()) return;
    const t = soon(), p = vary(1, 0.04);
    click(t, { type: 'lowpass', freq: 700 * p, q: 0.7, gain: 0.5, len: 0.04, pan });
    body(t, [[78 * p, 0.8, 0.2], [131 * p, 0.55, 0.14], [217 * p, 0.32, 0.09], [1720 * p, 0.035, 0.26], [2930 * p, 0.022, 0.19]], { gain: 0.8, pan });
    click(t + vary(0.022, 0.15), { freq: 3400 * p, q: 5, gain: 0.07, len: 0.05, pan });
    click(t + vary(0.041, 0.15), { freq: 3100 * p, q: 5, gain: 0.045, len: 0.04, pan });
  },
  // ...and out: the steel slides off its rails, a soft knock as it comes free
  unthunk(pan = 0) {
    if (!live()) return;
    const t = soon(), p = vary(1, 0.04);
    swish(t, { type: 'lowpass', from: 950 * p, to: 340 * p, q: 0.8, gain: 0.34, attack: 0.03, dur: 0.15, pan });
    body(t + 0.05, [[92 * p, 0.42, 0.12], [160 * p, 0.22, 0.08], [1810 * p, 0.02, 0.15]], { gain: 0.65, pan });
  },
  // a screw driven in: the thread grinds, a tick a turn (closer together as it goes), the head meets the steel
  screw(pan = 0, ms = 320, turns = 4) {
    if (!live()) return;
    const t0 = soon(), p = vary(1, 0.08), s = ms / 1000;
    swish(t0, { from: 2100 * p, to: 2900 * p, q: 7, gain: 0.035, attack: s * 0.3, dur: s * 0.75, pan });
    for (let i = 0; i < turns; i++) {
      const k = i / turns, at = t0 + s * (1 - (1 - k) * (1 - k));
      click(at, { freq: vary(3900 * p, 0.06), q: 3, gain: 0.08 + 0.07 * k, len: 0.007, pan });
    }
    const end = t0 + s;
    click(end, { freq: 2600 * p, q: 1.5, gain: 0.28, len: 0.01, pan });
    body(end, [[330 * p, 0.12, 0.04], [1240 * p, 0.14, 0.03], [2770 * p, 0.035, 0.18], [4310 * p, 0.018, 0.11]], { pan });
  },
  // ...and out: the tight first turn cracks free, then the ticks, further apart, over a lighter grind
  unscrew(pan = 0, ms = 300, turns = 3) {
    if (!live()) return;
    const t0 = soon(), p = vary(1, 0.08), s = ms / 1000;
    click(t0, { freq: 5000 * p, q: 3, gain: 0.26, len: 0.008, pan });
    body(t0, [[1210 * p, 0.12, 0.03], [2640 * p, 0.03, 0.13]], { pan });
    swish(t0 + 0.02, { from: 2800 * p, to: 2000 * p, q: 7, gain: 0.025, attack: s * 0.2, dur: s * 0.8, pan });
    for (let i = 1; i <= turns; i++) {
      const k = i / turns;
      click(t0 + 0.02 + s * k * k, { freq: vary(3700 * p, 0.06), q: 3, gain: 0.14 - 0.06 * k, len: 0.007, pan });
    }
  },
  // a piece lifting off the bench: a soft brush of air, darker than the fan's
  lift(pan = 0, ms = 500) {
    if (!live()) return;
    const t = soon(), s = ms / 1000;
    swish(t, { type: 'lowpass', from: 280, to: vary(1500, 0.1), q: 0.6, gain: 0.07, attack: s * 0.4, dur: s * 0.6, pan });
  },
  // a piece set down: a knock on the bench's wood
  land(pan = 0) {
    if (!live()) return;
    const t = soon(), p = vary(1, 0.06);
    click(t, { type: 'lowpass', freq: 1600 * p, q: 0.7, gain: 0.2, len: 0.012, pan });
    body(t, [[196 * p, 0.5, 0.05], [455 * p, 0.3, 0.035], [1010 * p, 0.12, 0.02]], { gain: 0.4, pan });
  },
  // a cable plugged in (`delay` s later): the plug rubs in its socket, then seats with a small click
  plug(pan = 0, delay = 0) {
    if (!live()) return;
    const t = soon(delay), p = vary(1, 0.08);
    swish(t, { from: 1900 * p, to: 2400 * p, q: 2, gain: 0.05, attack: 0.008, dur: 0.02, pan });
    click(t + 0.028, { freq: 3300 * p, q: 2, gain: 0.2, len: 0.006, pan });
    body(t + 0.028, [[880 * p, 0.12, 0.02], [2100 * p, 0.06, 0.015]], { gain: 0.5, pan });
  },
  // ...pulled out: the latch clicks free first, then the plug slides out, a little higher
  unplug(pan = 0, delay = 0) {
    if (!live()) return;
    const t = soon(delay), p = vary(1, 0.08);
    click(t, { freq: 3800 * p, q: 2, gain: 0.16, len: 0.005, pan });
    body(t, [[1020 * p, 0.08, 0.016]], { gain: 0.5, pan });
    swish(t + 0.01, { from: 2200 * p, to: 3000 * p, q: 2, gain: 0.045, attack: 0.006, dur: 0.025, pan });
  },
  // the PC built, the editor is yours: it powers on - the switch, the fan winding up, one beep from its speaker
  settle() {
    if (!live()) return;
    const t = soon(0.01);
    click(t, { freq: 2400, q: 1.2, gain: 0.26, len: 0.008 });
    body(t, [[340, 0.22, 0.045], [1250, 0.09, 0.02]], { gain: 0.8 });
    swish(t + 0.05, { from: 150, to: 560, q: 0.9, gain: 0.05, attack: 0.55, dur: 1.3 });
    const o = ctx.createOscillator(), g = ctx.createGain();          // (the fan's blades, a hum going up)
    o.type = 'triangle';
    o.frequency.setValueAtTime(45, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.7);
    g.gain.setValueAtTime(0, t + 0.05);
    g.gain.linearRampToValueAtTime(0.012 * level, t + 0.6);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 1.8);
    o.connect(g).connect(out);
    o.start(t + 0.05);
    o.stop(t + 1.85);
    beep(t + 0.75, { freq: 930, dur: 0.1, gain: 0.015 });
  },

  // the page's keys: a short clicky key - a little lower for one that turns something off
  tap(up = true) {
    if (!live()) return;
    const t = soon(-0.002), p = vary(1, 0.04) * (up ? 1 : 0.82);
    click(t, { freq: 2800 * p, q: 1.4, gain: 0.09, len: 0.006 });
    body(t, [[520 * p, 0.05, 0.02], [1900 * p, 0.05, 0.015]], { gain: 0.65 });
    click(t + vary(0.022, 0.1), { freq: 4200 * p, q: 3, gain: 0.035, len: 0.004 });
  },
  // a render under way: the hard disk seeking, a few tiny ticks at uneven gaps
  work() {
    if (!live()) return;
    let t = soon();
    for (let i = 0, n = 3 + Math.floor(Math.random() * 2); i < n; i++) {
      click(t, { freq: vary(2200, 0.15), q: 4, gain: vary(0.14, 0.25), len: 0.004 });
      t += 0.02 + Math.random() * 0.035;
    }
  },
  // the render on screen: the disk's last tick and one short, soft beep
  done() {
    if (!live()) return;
    const t = soon(0.01);
    click(t, { freq: 2300, q: 4, gain: 0.05, len: 0.004 });
    beep(t + 0.04, { freq: 930, dur: 0.085, gain: 0.018 });
  },
  // a render that failed: lower, long then short, the way a 90s PC said something was wrong
  fail() {
    if (!live()) return;
    const t = soon(0.01);
    beep(t, { freq: 440, dur: 0.2, gain: 0.02 });
    beep(t + 0.3, { freq: 440, dur: 0.07, gain: 0.018 });
  },
};

// The air of the scroll: the case fan, spinning with the page - a breath of air and, under it, the faint hum of its
// blades, both higher the faster it goes, a little higher on the way down than up. It winds up quickly and down
// slowly, as a fan does; a speed of 0 lets it run down. Two of them: the stage closing into the editor and the PC
// built (drift: `speed` in the stretch's fractions a second), and, softer and lower, the rest of the page and the
// steps (breeze: in screens a second). With reduced motion they stay still.
function air({ peak, full, low, high, hum }) {
  let a = null, off = 0;
  const hush = () => {
    clearTimeout(off);
    if (!a) return;
    const x = a;
    a = null;
    try {
      x.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      x.src.stop(ctx.currentTime + 0.3);
      x.o.stop(ctx.currentTime + 0.3);
    } catch { /* gone */ }
  };
  const set = (speed, down = true) => {
    if (!live() || CALM.matches) return;
    const k = Math.min(1, Math.max(0, speed) / full);
    if (!a) {
      if (k < 0.02) return;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 0.6; f.frequency.value = low;
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = hum * 0.5;
      og.gain.value = 0.12;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g);
      o.connect(og).connect(g);
      g.connect(out);
      src.start();
      o.start();
      a = { src, f, o, g };
    }
    const now = ctx.currentTime;
    a.g.gain.setTargetAtTime(peak * level * k * (2 - k), now, k ? 0.08 : 0.35);
    a.f.frequency.setTargetAtTime((down ? high : low) * (1 + 1.1 * k), now, 0.2);
    a.o.frequency.setTargetAtTime(hum * (down ? 1 : 0.85) * (0.5 + k), now, 0.25);
    clearTimeout(off);
    // (still for a while: the source goes)
    if (k < 0.02) off = setTimeout(hush, 1200);
  };
  return { set, hush };
}
const stageAir = air({ peak: 0.07, full: 1.4, low: 420, high: 580, hum: 150 });
const pageAir = air({ peak: 0.028, full: 3, low: 300, high: 380, hum: 100 });
function hushAir() { stageAir.hush(); pageAir.hush(); }
CALM.addEventListener?.('change', () => { if (CALM.matches) hushAir(); });
export const drift = (speed, down) => stageAir.set(speed, down);
export const breeze = (speed, down) => pageAir.set(speed, down);
