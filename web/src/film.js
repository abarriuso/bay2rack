// The scroll film: the frames of scripts/blender/scroll.py, one drawn per step of the scroll (forwards and
// backwards), and the texts of the page coming in at their frames. Without it (reduced motion, data saving, no
// frames) the section is a plain page: a still and the same texts, one after another.
//
// The frames come in tiers (film.json "sizes", each with its role):
//   base   every 4th frame, small: on every device, coarse first, so the whole film scrubs almost at once
//   fine   every frame, 1600 px: wide screens without touch, only around the scroll position (ahead of the way it
//          goes) and only while the film is on screen - a visitor who never scrolls it downloads a first stretch
//          and no more; each one replaces the base picture of its frame as it arrives
//   sharp  every 4th frame, 2560 px: big screens, only where the scroll RESTS (the key frame there and its
//          neighbours, a dozen at most kept)
// One scheduler, six requests at a time.
//
// A touch screen (a phone) cannot keep a film of decoded pictures, and a picture decoded at the moment it is drawn
// makes the scroll stutter. It has a reel instead (makeReel): the files of one set are kept as they came (a few MB),
// only the pictures around the scroll position are decoded (off the page's thread, cut to what the screen shows),
// ahead of the way the scroll goes, and one in every few along the whole film. Held upright it takes the "tall" set:
// the slice of the picture a phone shows, with twice the frames. Where the scroll rests, the fine picture of that
// frame.
//
// At its end the film turns into the configurator: a coda (a little more scroll after the last frame) closes the
// picture into the shape of the workbench, its 3D view and its steps column; the 3D view then comes in from the
// film's camera. "Configure yours" in the film carries the frame on screen into the 3D view itself.
import './css/film-extra.css';
import { $, BASE, CALM } from './state.js';
import { viewer, startEngine } from './engine.js';

const pad = (n) => String(n).padStart(4, '0');
const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

// Touch devices (phones, tablets; iOS Safari above all) keep every decoded frame in a small memory budget and reload
// the tab when it runs out. There the film takes the largest set that still gives FEW frames within PIXELS, and skips
// frames of it if it must: about 256 MB of decoded pictures, as many frames as the phone set had before.
// (a laptop with a touch screen has a fine pointer first: it is a desktop)
const TOUCH = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches);
const PIXELS = 64e6, FEW = 100;
const REEL_PIXELS = 26e6;       // the reel of a touch screen: decoded pictures at a time (about 100 MB)
const DECODES = 3;              // ...and pictures being decoded at a time
const area = (sz) => (sz.w || 1600) * (sz.h || 900);
// the canvas never holds more than this (a 4K screen at 2x would be 33 Mpx to fill per frame)
const CANVAS_MAX = 4.2e6;
const IN_FLIGHT = 6;            // requests at a time
const FINE_FROM = 1100;         // device px across the canvas from which the fine set loads
const SHARP_FROM = 1700;        // ...and the sharp one, where the scroll rests
const SHARP_KEEP = 12;          // sharp pictures kept (the farthest goes)
const REST_MS = 200;
// the fine pictures asked for around the scroll position: ahead of the way it goes, behind it, and before the first
// scroll (the film may never be played)
const FINE_AHEAD = 140, FINE_BEHIND = 40, FINE_FIRST = 36;
// where the camera of the film looks from (eye - target, Z up, -Y the front): the last shot, over the table; the
// first one, low from the front left (scripts/blender/scroll.py)
const FROM_TABLE = [0.02, -0.24, 1.08], FROM_DESK = [-0.46, -0.88, 0.16];

export async function startFilm() {
  const root = $('#film');
  if (!root) return;
  const still = root.querySelector('.film-still');
  // the still of the theme in use (the page ships the dark one; the light theme has its own film)
  const showStill = (dir) => {
    const src = `${BASE}scroll/${themeNow()}/${dir}/0001.webp`;
    if (still && still.src !== src) still.src = src;
  };
  const plain = () => {
    root.classList.add('plain');
    showStill('960');
    new MutationObserver(() => showStill('960')).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };
  // reduced motion, data saving, or a screen too short for a stage (a page zoomed to 400 %): the plain page
  if (CALM.matches || navigator.connection?.saveData || matchMedia('(max-height: 300px)').matches) { plain(); return; }
  // (the frames are kept by the browser for a long time, under the version film.json gives them: it is asked anew)
  const meta = await fetch(BASE + 'scroll/film.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const canvas = $('#filmCanvas');
  const ctx = canvas?.getContext('2d', { alpha: false });
  if (!meta?.sizes?.length || !ctx) { plain(); return; }

  // ---------------------------------------------------------------- the tiers
  const roleOf = (sz) => sz.role ?? (sz.step === 1 ? 'fine' : 'base');
  const framesOf = (sz) => Math.floor((meta.frames - 1) / sz.step) + 1;
  const last = meta.frames - 1;                             // film frames are 0..last
  const sharpSz = meta.sizes.find((sz) => roleOf(sz) === 'sharp') ?? null;
  const fineSz = meta.sizes.find((sz) => roleOf(sz) === 'fine') ?? null;
  const tallSz = meta.sizes.find((sz) => roleOf(sz) === 'tall') ?? null;
  const plainSz = meta.sizes.find((sz) => roleOf(sz) === 'base') ?? fineSz ?? meta.sizes[0];
  let baseSz = plainSz;
  let skip = 1;
  // a touch screen plays from a reel of decoded pictures (below); without createImageBitmap, the pictures as before
  let useReel = TOUCH && typeof createImageBitmap === 'function' && typeof fetch === 'function';
  let reel = null, reelKey = '';
  if (TOUCH) {
    // largest first: the first set that still has FEW frames inside the budget, else the smallest
    const sets = meta.sizes.filter((sz) => ['base', 'fine'].includes(roleOf(sz))).sort((a, b) => area(b) - area(a));
    const fits = (sz) => Math.min(framesOf(sz), Math.floor(PIXELS / area(sz))) >= FEW;
    baseSz = sets.find(fits) ?? sets.at(-1);
    skip = Math.max(1, Math.ceil(framesOf(baseSz) / Math.floor(PIXELS / area(baseSz))));
  }
  const tiers = {
    base: { sz: baseSz, skip, step: baseSz.step * skip, n: Math.floor(last / (baseSz.step * skip)) + 1 },
    fine: !TOUCH && fineSz && fineSz !== baseSz ? { sz: fineSz, skip: 1, step: fineSz.step, n: framesOf(fineSz) } : null,
    sharp: !TOUCH && sharpSz ? { sz: sharpSz, skip: 1, step: sharpSz.step, n: framesOf(sharpSz) } : null,
  };
  let fineOn = false, sharpOn = false;                      // (fit() decides, by the size of the canvas)
  showStill(baseSz.dir);
  // a set coarse first (every 64th, 32nd...): the whole film scrubs after the first pass and gets finer after
  const coarseFirst = (n) => {
    const order = [], queued = new Set();
    for (let s = 64; s >= 1; s /= 2)
      for (let i = 0; i < n; i += s) if (!queued.has(i)) { queued.add(i); order.push(i); }
    return order;
  };
  const order = coarseFirst(tiers.base.n);
  const ver = meta.v ? `?v=${meta.v}` : '';
  const url = (th, t, i) => `${BASE}scroll/${th}/${t.sz.dir}/${pad(i * t.skip + 1)}.webp${ver}`;

  const sets = {};
  let theme = themeNow();
  let cur = 0, target = 0, running = false, shownIm = null;
  let kc = 0, codaT = 0;                                    // the coda: 0 film, 1 workbench
  let resting = false, restKey = -1, restTimer = 0, visible = true;
  let engaged = false, booted = false, fineAt = -1, fineDir = 1;   // (the fine set: see nextJob)
  // the handoff to the configurator (below): armed once the film was seen to its end or left by its button
  let armed = false, handed = false, holding = false, from = FROM_TABLE;
  let subject = { x: 0.5, y: 0.5 };                         // where the subject of the drawn frame is (canvas fractions)
  const inflight = new Set();
  // each text of the page and the frames it belongs to (film.json has them, in the order of the page)
  const beats = [...root.querySelectorAll('.beat')].map((el, i) => ({ el, from: meta.beats[i]?.from ?? 0, to: meta.beats[i]?.to ?? 0, on: el.classList.contains('on') }));
  const bar = $('#filmBar');
  const stage = root.querySelector('.film-stage');

  const setOf = (th) => (sets[th] ??= { base: new Array(tiers.base.n), fine: tiers.fine ? new Array(tiers.fine.n) : [], fineLeft: tiers.fine?.n ?? 0, sharp: new Map(), next: 0 });

  // ---------------------------------------------------------------- touch screens: the reel
  // sz: the set it plays; cropOf(frame) -> [x, w] the slice of a picture the screen shows (null: all of it);
  // old: the reel it replaces (the same set, another slice: its files are kept)
  let cropOk = true, reelFails = 0;
  function makeReel(th, sz, cropOf, old) {
    const n = framesOf(sz), step = sz.step;
    const wide = cropOf ? cropOf(0)[1] : sz.w;
    const room = Math.max(24, Math.floor(REEL_PIXELS / (wide * sz.h)));
    // one in `every` along the whole film stays decoded (a fling, a jump); the rest of the room goes around the
    // scroll position: `half` behind, `half` twice ahead (and as much kept the other way, for a scroll that turns)
    let every = 1;
    while (Math.ceil(n / every) > room * 0.4) every *= 2;
    const half = Math.max(3, Math.floor((room - Math.ceil(n / every)) / 4));
    const blobs = old?.sz === sz && old.th === th ? old.blobs : new Array(n);
    const maps = new Map(), decoding = new Set(), files = coarseFirst(n);
    let next = 0, fetching = 0, dead = false, at = 0, dir = 1;
    let still = null, stillAsk = 0;                       // the fine picture of the frame the scroll rests on
    const near = (i, k) => i >= at - half * k && i <= at + half * k;
    const ahead = (i) => i >= at - half * (dir > 0 ? 1 : 2) && i <= at + half * (dir > 0 ? 2 : 1);
    const cut = (blob, c) => (c && cropOk ? createImageBitmap(blob, c[0], 0, c[1], sz.h) : createImageBitmap(blob));
    function decode(i) {
      decoding.add(i);
      const cropped = !!cropOf && cropOk;
      cut(blobs[i], cropOf?.(i * step)).then((bmp) => {
        decoding.delete(i);
        if (dead || !(i % every === 0 || near(i, 2))) bmp.close?.();
        else {
          maps.set(i, bmp);
          // (the picture for the frame on screen, or a nearer one than what is drawn)
          if (th === theme && (Math.abs(i * step - cur) <= step * 2 || !shownIm)) kick();
        }
        feed();
      }, () => {
        decoding.delete(i);
        if (dead) return;
        // no slices on this browser: whole pictures; nothing at all: the pictures as a page has them
        if (cropped) cropOk = false;
        else if (++reelFails > 6 && !maps.size) { noReel(); return; }
        feed();
      });
    }
    function feed() {
      if (dead) return;
      while (fetching < IN_FLIGHT && next < files.length) {
        const i = files[next++];
        if (blobs[i]) continue;
        fetching++;
        fetch(`${BASE}scroll/${th}/${sz.dir}/${pad(i + 1)}.webp${ver}`).then((r) => (r.ok ? r.blob() : null)).catch(() => null).then((b) => {
          fetching--;
          if (b) blobs[i] = b;
          feed();
        });
      }
      const ready = (i) => i >= 0 && i < n && blobs[i] && !maps.has(i) && !decoding.has(i);
      // nearest the scroll position first, the way it goes before the way it came; then the ones along the film
      for (let d = 0; d <= half * 2 && decoding.size < DECODES; d++)
        for (const i of d ? [at + d * dir, at - d * dir] : [at]) if (decoding.size < DECODES && ahead(i) && ready(i)) decode(i);
      for (let i = 0; i < n && decoding.size < DECODES; i += every) if (ready(i)) decode(i);
    }
    const r = {
      th, sz, blobs, step,
      // the scroll is at film frame f, going to `to`: the pictures around it, what fell behind let go
      aim(f, to) {
        const c = Math.min(n - 1, Math.max(0, Math.round(f / step)));
        const d = to > f ? 1 : to < f ? -1 : dir;
        if (c === at && d === dir) return;
        at = c; dir = d;
        for (const [i, bmp] of maps) if (i % every && !near(i, 2)) { bmp.close?.(); maps.delete(i); }
        feed();
      },
      // -> [picture, its film frame, whether the subject is in its middle (an upright cut)]
      get(f) {
        if (resting && still?.frame === Math.round(f)) return [still.bmp, still.frame, still.mid];
        const c = Math.round(f / step), mid = roleOf(sz) === 'tall' || (!!cropOf && cropOk);
        for (let d = 0; d < n; d++) {
          let b = maps.get(c - d);
          if (b) return [b, (c - d) * step, mid];
          if ((b = maps.get(c + d))) return [b, (c + d) * step, mid];
        }
        return null;
      },
      // the scroll rests on `frame`: its picture from the fine set (sharper than the reel's), cut the same way
      rest(frame, cropFine) {
        if (!fineSz || fineSz === sz || frame % fineSz.step || still?.frame === frame) return;
        const ask = ++stillAsk;
        fetch(`${BASE}scroll/${th}/${fineSz.dir}/${pad(frame / fineSz.step + 1)}.webp${ver}`).then((x) => (x.ok ? x.blob() : null))
          .then((b) => (b ? (cropFine && cropOk ? createImageBitmap(b, cropFine[0], 0, cropFine[1], fineSz.h) : createImageBitmap(b)) : null))
          .then((bmp) => {
            if (!bmp) return;
            if (dead || ask !== stillAsk) { bmp.close?.(); return; }
            still?.bmp.close?.();
            still = { frame, bmp, mid: !!cropFine && cropOk };
            if (th === theme && resting && Math.round(cur) === frame) kick();
          }).catch(() => {});
      },
      end() {
        dead = true;
        for (const bmp of maps.values()) bmp.close?.();
        maps.clear();
        still?.bmp.close?.();
        still = null;
      },
    };
    feed();
    return r;
  }
  // the reel cannot be (no picture could be decoded): the film as a page without touch has it, within its budget
  function noReel() {
    useReel = false;
    reel?.end();
    reel = null;
    fit();
    pump();
  }

  // the next picture to ask for: the sharp ones where the film rests, the base set, then the fine one nearest the
  // scroll position
  function nextJob(s) {
    if (resting && sharpOn) for (const k of [restKey, restKey - 1, restKey + 1])
      if (k >= 0 && k < tiers.sharp.n && !s.sharp.has(k)) return ['sharp', k];
    if (resting && fineOn && visible) { const c = Math.round(cur / tiers.fine.step); if (c < tiers.fine.n && !s.fine[c]) return ['fine', c]; }
    while (s.next < order.length) { const i = order[s.next++]; if (!s.base[i]) return ['base', i]; }
    if (fineOn && visible && s.fineLeft > 0) {
      const n = tiers.fine.n, c = Math.min(n - 1, Math.max(0, Math.round(cur / tiers.fine.step)));
      const fwd = engaged ? FINE_AHEAD : FINE_FIRST, back = engaged ? FINE_BEHIND : 0;
      const up = fineDir >= 0 ? fwd : back, down = fineDir >= 0 ? back : fwd;
      for (let d = 0; d <= Math.max(up, down); d++) {
        if (d <= up && c + d < n && !s.fine[c + d]) return ['fine', c + d];
        if (d && d <= down && c - d >= 0 && !s.fine[c - d]) return ['fine', c - d];
      }
    }
    return null;
  }
  function pump() {
    if (useReel) return;                                    // (a touch screen: the reel asks for its own)
    const s = setOf(theme), th = theme;
    while (inflight.size < IN_FLIGHT) {
      const job = nextJob(s);
      if (!job) return;
      const [tier, i] = job, t = tiers[tier];
      const im = new Image();
      im.decoding = 'async';
      const done = (ok) => {
        im.onload = im.onerror = null;
        inflight.delete(im);
        if (ok) {
          im.ok = true;
          const frame = i * t.step;
          if (th === theme && (tier === 'sharp' ? resting && i === restKey : Math.abs(frame - cur) <= tiers.base.step * 2)) kick();
        }
        pump();
      };
      // decoded before it counts as there (off the page's thread): a picture decoded when it is first drawn holds that
      // frame up by its decode (14 ms for a sharp one, past the 16.7 ms of a frame with the draw)
      im.onload = () => (im.decode ? im.decode().then(() => done(true), () => done(true)) : done(true));
      im.onerror = () => done(false);
      im.src = url(th, t, i);
      inflight.add(im);
      if (tier === 'sharp') { s.sharp.set(i, im); trimSharp(s); }
      else { s[tier][i] = im; if (tier === 'fine') s.fineLeft--; }
    }
  }
  // a dozen sharp pictures at most (each 15 MB decoded): the farthest from where the film rests goes
  function trimSharp(s) {
    while (s.sharp.size > SHARP_KEEP) {
      let far = -1;
      for (const k of s.sharp.keys()) if (far < 0 || Math.abs(k - restKey) > Math.abs(far - restKey)) far = k;
      const im = s.sharp.get(far);
      im.onload = im.onerror = null;
      inflight.delete(im);
      im.src = '';
      s.sharp.delete(far);
    }
  }

  // the slice of a picture of the set `sz` that an upright canvas shows, around the subject (-> [x, width] in the
  // picture's pixels; null: all of it)
  function sliceOf(sz, frame) {
    const cw = canvas.width, ch = canvas.height;
    if (!sz || cw / ch >= 4 / 3) return null;
    const w = Math.min(sz.w, Math.ceil(sz.h * cw / ch));
    if (w >= sz.w) return null;
    const fx = roleOf(sz) === 'tall' ? 0.5 : subjectAt(1 + frame);
    return [Math.min(sz.w - w, Math.max(0, Math.round(sz.w * fx - w / 2))), w];
  }
  // the reel for this screen, this theme: upright, the tall set (as far as it is wide enough); else the plain one
  function thread() {
    if (!useReel) return;
    const a = canvas.width / canvas.height;
    const sz = a < 4 / 3 && tallSz && a <= tallSz.w / tallSz.h + 0.01 ? tallSz : plainSz;
    const sl = sliceOf(sz, 0);
    const key = `${theme}|${sz.dir}|${sl ? sl[1] : 0}`;
    if (key === reelKey && reel) return;
    reelKey = key;
    const old = reel;
    old?.end();
    reel = makeReel(theme, sz, sl ? (frame) => sliceOf(sz, frame) : null, old);
    reel.aim(cur, target);
    shownIm = null;
  }

  // where the subject of a frame sits across the picture (the shots keep it off the side of the text): a phone
  // crops the sides, and keeps this in the middle
  const subjectAt = (frame) => meta.beats.find((b) => frame <= b.to)?.subject ?? 0.5;

  // the picture for the film frame f: the sharp one where it rests, the fine one of that frame or one within two,
  // else the nearest base one
  // (a picture of another frame than the scroll's is the film out of step with it: the nearest frame wins, and of
  // two as near, the sharper)
  function pick(f) {
    if (useReel) return reel?.get(f) ?? null;
    const s = sets[theme];
    if (!s) return null;
    if (resting && sharpOn && f === restKey * tiers.sharp.step) { const im = s.sharp.get(restKey); if (im?.ok) return [im, f]; }
    let best = null;
    const b = s.base, c = Math.round(f / tiers.base.step);
    for (let d = 0; d < b.length; d++) {
      if (b[c - d]?.ok) { best = [b[c - d], (c - d) * tiers.base.step]; break; }
      if (b[c + d]?.ok) { best = [b[c + d], (c + d) * tiers.base.step]; break; }
    }
    if (fineOn) {
      const c = Math.round(f / tiers.fine.step);
      for (const d of [0, -1, 1, -2, 2]) {
        const im = s.fine[c + d], frame = (c + d) * tiers.fine.step;
        if (im?.ok) { if (!best || Math.abs(frame - f) <= Math.abs(best[1] - f)) best = [im, frame]; break; }
      }
    }
    return best;
  }

  // A sharper picture of the frame already on screen (the fine or the sharp one, come in where the scroll rests) fades
  // in over the softer one instead of snapping to it; another frame is drawn as it is (the film moves on).
  const FADE_MS = 260;
  let shownFrame = -1, shownMid = false, fade = null;
  function paint(im, frame, mid, alpha = 1) {
    const cw = canvas.width, ch = canvas.height;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    if (!iw || !ih) return null;
    const s = Math.max(cw / iw, ch / ih);
    const w = iw * s, hh = ih * s;
    // a screen less wide than the picture crops its sides. Tall (the text is at the foot, see the styles): the
    // subject goes to the middle. Wide: it stays as far across as the shot put it, so the text keeps its side.
    const tall = cw / ch < 4 / 3;
    const fx = subjectAt(1 + frame);
    // (a reel's upright pictures are cut around the subject already: it is in their middle)
    const px = mid ? 0.5 : fx;
    const x = Math.min(0, Math.max(cw - w, cw * (tall ? 0.5 : fx) - w * px));
    ctx.globalAlpha = alpha;
    // (a picture let go meanwhile - a reel's closed bitmap, a sharp one dropped - draws nothing)
    try { ctx.drawImage(im, x, (ch - hh) / 2, w, hh); } catch { return null; } finally { ctx.globalAlpha = 1; }
    return (x + w * px) / cw;
  }
  function draw(force) {
    const got = pick(Math.round(cur));
    if (!got) return;
    const [im, frame, mid = false] = got;
    if (fade && (fade.im !== im || force)) fade = null;     // (the film moved on, or the canvas was redone)
    if (fade) {
      const a = Math.min(1, (performance.now() - fade.t0) / FADE_MS);
      paint(fade.im0, frame, fade.mid0);
      paint(im, frame, mid, a * a * (3 - 2 * a));
      if (a >= 1) fade = null;
      return;
    }
    if (im === shownIm && !force) return;
    if (!root.classList.contains('live')) root.classList.add('live');
    // the same frame, a new picture of it (a sharper one, come in): faded in
    if (!force && shownIm && frame === shownFrame) {
      fade = { im0: shownIm, mid0: shownMid, t0: performance.now(), im };
      kick();
    } else {
      const sx = paint(im, frame, mid);
      if (sx == null) return;
      subject = { x: sx, y: 0.5 };
    }
    shownIm = im; shownFrame = frame; shownMid = mid;
  }

  let kWritten = -1, rolling = false;
  // the picture follows the scroll with a little weight: a fifth of the way per 60th of a second, whatever the
  // screen's rate (at 120 Hz, a tenth of it per refresh: the same glide, twice the pictures)
  let lastT = 0;
  function tick(now) {
    const dt = Math.min(100, Math.max(1, now - (lastT || now - 1000 / 60)));
    lastT = now;
    const ease = 1 - Math.pow(0.8, dt / (1000 / 60));
    cur += (target - cur) * ease;
    if (Math.abs(target - cur) < 0.05) cur = target;
    kc += (codaT - kc) * ease;
    if (Math.abs(codaT - kc) < 0.002) kc = codaT;
    reel?.aim(cur, target);
    if (fineOn) {
      // the scroll has moved on a frame (or turned): the fine pictures around the new place
      const c = Math.round(cur / tiers.fine.step), d = Math.sign(target - cur) || fineDir;
      if (c !== fineAt || d !== fineDir) { fineAt = c; fineDir = d; pump(); }
    }
    draw(false);                                            // (the canvas redone: fit() draws it whole)
    const frame = 1 + cur;
    // only what changed is written: no style work for the page while the texts stay as they are
    for (const b of beats) {
      const on = frame >= b.from && frame <= b.to + 0.999;
      if (on !== b.on) { b.on = on; b.el.classList.toggle('on', on); }
    }
    if (bar) bar.style.transform = `scaleX(${(cur / last).toFixed(4)})`;
    // past the first text (it has its own keys) and before the coda: the key that skips the film
    const roll = beats.length > 1 && frame > beats[0].to + 0.999 && codaT === 0 && kc === 0;
    if (roll !== rolling) { rolling = roll; root.classList.toggle('rolling', roll); }
    // the coda: eased, written only when it moves
    const k = kc * kc * (3 - 2 * kc);
    if (Math.abs(k - kWritten) > 0.0005 || (k !== kWritten && (k === 0 || k === 1))) {
      kWritten = k;
      stage.style.setProperty('--k', k.toFixed(4));
      root.classList.toggle('closing', k > 0);
      if (k > 0.5) armed = true;                            // the film was seen to its end: the 3D view takes it on
    }
    if (cur !== target || kc !== codaT || fade) requestAnimationFrame(tick);
    else { running = false; clearTimeout(restTimer); restTimer = setTimeout(rest, REST_MS); }
  }
  function kick() { if (!running) { running = true; lastT = 0; requestAnimationFrame(tick); } }

  // the scroll has stopped: the sharp key frame there (and its neighbours) on a big screen
  function rest() {
    restTimer = 0;
    if (useReel) {
      if (!reel || !visible || cur !== target || resting) return;
      resting = true;
      const frame = Math.round(cur);
      reel.rest(frame, sliceOf(fineSz, frame));
      kick();                                             // (a picture of this frame it has already)
      return;
    }
    if (!fineOn || !visible || cur !== target || resting) return;
    resting = true;
    const s = setOf(theme);
    if (sharpOn) {
      // the sharp pictures are every few frames: the film settles on the nearest of them (a frame or two, gliding)
      // so that what comes in sharper is the very frame on screen, not one beside it
      restKey = Math.min(tiers.sharp.n - 1, Math.max(0, Math.round(cur / tiers.sharp.step)));
      // (not across the edge of a text: that one stays as it is, and the frame takes its fine picture instead)
      const k = restKey * tiers.sharp.step;
      const same = beats.every((x) => (1 + k >= x.from && 1 + k <= x.to + 0.999) === x.on);
      if (!same) restKey = -1;
      else if (k !== target) { target = k; kick(); }
      else if (s.sharp.get(restKey)?.ok) kick();
    }
    pump();
  }

  // The geometry is read when something resizes, never while scrolling: a scroll only reads scrollY (no layout).
  // The stage sticks from where the film starts until its foot meets the film's; that stretch is the whole film and
  // its coda. It is measured with the stage's own height (svh, steady), not innerHeight, which on iPhone changes as
  // Safari's bars fold and unfold and would nudge the frame.
  const codaEl = root.querySelector('.film-coda');
  let filmTop = 0, span = 1, stick = 0, coda = 0;
  function geometry() {
    const r = root.getBoundingClientRect();
    filmTop = r.top + scrollY;
    stick = parseFloat(getComputedStyle(stage).top) || 0;
    const all = Math.max(1, r.height - stage.offsetHeight);
    coda = Math.min(all * 0.5, codaEl?.offsetHeight ?? 0);
    span = Math.max(1, all - coda);
    // The coda closes into the configurator as it is on this screen, at this zoom: its edges, its height, its steps
    // column - measured, not worked out again here. The last text steps into that column, as small as it needs to be
    // to fit (its widest line included: a long word of the heading).
    const wb = $('.workbench'), panel = wb?.querySelector('.panel'), lastBeat = beats.at(-1)?.el;
    const set = (k, x) => (x == null ? stage.style.removeProperty(k) : stage.style.setProperty(k, x));
    const sideBySide = wb && panel && panel.offsetWidth < wb.offsetWidth * 0.7;
    if (sideBySide && lastBeat) {
      const s = stage.getBoundingClientRect(), b = wb.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(panel).paddingLeft) || 0;
      const high = Math.min(b.height, s.height);
      const w = Math.max(lastBeat.offsetWidth, ...[...lastBeat.children].map((c) => c.scrollWidth));
      set('--fr-l', `${b.left - s.left}px`);
      set('--fr-r', `${s.right - b.right}px`);
      set('--fr-t', `${(s.height - high) / 2}px`);
      set('--fr-b', `${(s.height - high) / 2}px`);
      set('--fr-col', `${panel.offsetWidth}px`);
      set('--fr-s', Math.min(1, Math.max(0.3, (panel.clientWidth - 2 * pad) / Math.max(1, w))).toFixed(4));
      set('--fr-dx', `${b.left - s.left + pad - lastBeat.offsetLeft}px`);
    } else for (const k of ['--fr-l', '--fr-r', '--fr-t', '--fr-b', '--fr-col', '--fr-s', '--fr-dx']) set(k, null);
  }
  // The window changes its width or its zoom: everything in the film is as tall as the screen, so the same scrollY
  // would be another moment of the film. The place is kept instead: how far through the film (or its coda) the page
  // was goes back on once the new sizes are known. (A phone's bars folding change only the height: nothing to do.)
  let lastY = scrollY, lastW = innerWidth, lastDpr = devicePixelRatio, keep = null;
  addEventListener('resize', () => {
    if (innerWidth === lastW && devicePixelRatio === lastDpr) return;
    lastW = innerWidth; lastDpr = devicePixelRatio;
    if (keep) return;
    const y = lastY + stick - filmTop;
    if (y <= 0 || y >= span + coda) return;                 // (not in the film: the page keeps its own place)
    keep = y <= span ? { t: y / span } : { c: (y - span) / Math.max(1, coda) };
    // (the sizes are known before the next frame is drawn; if nothing of the film changed size, they still are)
    requestAnimationFrame(() => requestAnimationFrame(() => { if (keep) resize(); }));
  });
  function measure() {
    if (keep) return;                                       // (the sizes are changing: see above)
    lastY = scrollY;
    const y = lastY + stick - filmTop;
    const t = Math.min(1, Math.max(0, y / span)) * last;
    // the coda closes over its first three quarters and holds the last one, then the stage scrolls away
    const c = coda ? Math.min(1, Math.max(0, (y - span) / (coda * 0.75))) : 0;
    if (t !== target) { target = t; if (booted) engaged = true; if (resting) resting = false; }
    clearTimeout(restTimer);
    if (t === cur && c === codaT && !running) { restTimer = setTimeout(rest, REST_MS); return; }
    codaT = c;
    kick();
  }

  // The canvas bitmap: as sharp as the screen (up to 2x) but never sharper than the largest frame it will get (more
  // pixels would only stretch the same picture, and cost a bigger fill per frame), and within CANVAS_MAX.
  let bw = 0, bh = 0, settle = 0;
  function fit() {
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const k0 = Math.min(dpr, Math.sqrt(CANVAS_MAX / (cssW * cssH)));
    if (!useReel && tiers.fine && !fineOn && cssW * dpr > FINE_FROM) { fineOn = true; queueMicrotask(pump); }   // (once on, it stays)
    sharpOn = !useReel && !!tiers.sharp && cssW * k0 > SHARP_FROM;
    // (a reel: the fine picture where the scroll rests is the sharpest it gets)
    const top = useReel ? fineSz ?? plainSz : (sharpOn ? tiers.sharp : fineOn ? tiers.fine : tiers.base).sz;
    const nat = top.w && top.h ? 1 / Math.max(cssW / top.w, cssH / top.h) : 2;
    const k = Math.min(k0, nat);
    const w = Math.max(1, Math.round(cssW * k)), h = Math.max(1, Math.round(cssH * k));
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = bw = w;                                // (this clears the bitmap: the frame goes back on below,
      canvas.height = bh = h;                               //  before the browser paints)
    }
    thread();
    draw(true);
  }
  function resize() {
    geometry();
    if (keep) {
      const k = keep;
      keep = null;
      scrollTo({ top: filmTop - stick + (k.t != null ? k.t * span : span + k.c * coda), behavior: 'instant' });
    }
    measure();
    // only the height moved, by a little (the bars of a phone's browser, a keyboard): the bitmap stays, stretched to
    // cover by object-fit, and is redone once it has settled - no blank canvas between two frames
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const k = bw / Math.max(1, cssW);
    clearTimeout(settle);
    if (bw && Math.abs(cssW * k - bw) < 2 && Math.abs(cssH * k - bh) < bh * 0.2) settle = setTimeout(fit, 300);
    else fit();
  }

  root.classList.add('coda');                              // (the film gets its coda's length: see film-extra.css)
  pump();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  ro.observe(root);                                         // the film's own height (the svh of a rotated phone)
  if (beats.length) ro.observe(beats.at(-1).el);           // the last text (another language): the coda's column
  const top = $('.top');
  if (top) ro.observe(top);                                 // the header above it (where the film starts)
  if ($('.workbench')) ro.observe($('.workbench'));         // the configurator (the shape the coda closes into)
  addEventListener('scroll', measure, { passive: true });
  // no sharp pictures for a film that is not on screen
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) pump();                                    // (the fine pictures wait while the film is off screen)
    if (visible && !running) { clearTimeout(restTimer); restTimer = setTimeout(rest, REST_MS); }
  }).observe(root);
  // the keyboard: a link of a text that is not on screen yet (Tab) takes the film to that text's frames, so what has
  // the focus is always in view
  root.addEventListener('focusin', (e) => {
    const b = beats.find((x) => x.el.contains(e.target));
    if (!b || b.on) return;
    const p = ((b.from + b.to) / 2 - 1) / Math.max(1, last);
    scrollTo({ top: filmTop - stick + Math.min(1, Math.max(0, p)) * span, behavior: 'instant' });
  });
  // the other theme has its own film: its frames load when the theme changes, the old ones are let go (a phone
  // cannot hold both sets)
  new MutationObserver(() => {
    if (themeNow() === theme) return;
    const old = sets[theme];
    if (old) {
      for (const im of [...old.base, ...old.fine, ...old.sharp.values()])
        if (im && !im.ok) { im.onload = im.onerror = null; im.src = ''; }
      for (const im of old.sharp.values()) im.src = '';
    }
    inflight.clear();
    delete sets[theme];
    theme = themeNow();
    showStill(baseSz.dir);
    thread();
    pump();
    shownIm = null;
    kick();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  geometry();
  fit();
  measure();
  booted = true;

  // ---------------------------------------------------------------- into the configurator
  // The 3D view, the first time it comes on screen after the film (seen to its end, or left by its button), comes in
  // from the film's camera: from over the table down to the view of the configurator.
  const view = $('#view');
  const status = $('#status');
  function cameraFromFilm() {
    const v = viewer, b = v?.focus ?? v?.whole;
    if (handed || !b || !v.look || !v.fit) return handed;
    const c = ['x', 'y', 'z'].map((a) => (b.min[a] + b.max[a]) / 2);
    const r = Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) / 2;
    const n = Math.hypot(...from), d = r * 3.6;
    v.look(c.map((x, i) => x + (from[i] / n) * d), c);
    v.fit();                                                // (it glides from there to its own view)
    handed = true;
    return true;
  }
  if (view && 'IntersectionObserver' in window) {
    let seen = false;
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (seen && armed && !holding && cameraFromFilm()) io.disconnect();
    }, { threshold: 0.5 });
    io.observe(view);
    // the view came on screen before its first model: that model comes in from the film instead
    if (status) {
      const mo = new MutationObserver(() => {
        if (handed) { mo.disconnect(); return; }
        if (seen && armed && !holding && cameraFromFilm()) { mo.disconnect(); io.disconnect(); }
      });
      mo.observe(status, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // "Configure yours": the frame on screen goes into the 3D view of the configurator (the page jumps there under
  // it), waits there for the model a moment and gives way to it.
  for (const a of root.querySelectorAll('.film-beats a[href="#configurator"]')) a.addEventListener('click', (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !root.classList.contains('live') || holding) return;
    const vw = view?.closest('.viewer');
    if (!vw) return;
    from = a.closest('.beat') === beats[0]?.el ? FROM_DESK : FROM_TABLE;
    armed = true;
    startEngine();
    // what is on screen now: the stage, closed by the coda as far as it is
    const sr = stage.getBoundingClientRect();
    const wr = root.querySelector('.film-window')?.getBoundingClientRect() ?? sr;
    const kNow = Math.max(0, kWritten);
    const lerp = (p, q) => p + (q - p) * kNow;
    const start = { top: lerp(sr.top, wr.top), left: lerp(sr.left, wr.left), right: lerp(sr.right, wr.right), bottom: lerp(sr.bottom, wr.bottom) };
    const shot = document.createElement('canvas');
    shot.width = canvas.width; shot.height = canvas.height;
    shot.getContext('2d', { alpha: false }).drawImage(canvas, 0, 0);
    const layer = document.createElement('div');
    layer.className = 'film-handoff';
    layer.setAttribute('aria-hidden', 'true');
    // (upright, the coda slid the picture up into its window: so does the copy)
    const ty = sr.width / sr.height < 4 / 3 ? -kNow * (sr.height - wr.height) / 2 : 0;
    Object.assign(shot.style, { left: sr.left + 'px', top: sr.top + ty + 'px', width: sr.width + 'px', height: sr.height + 'px' });
    layer.append(shot);
    const W = document.documentElement.clientWidth, H = innerHeight;
    const inset = (q) => `inset(${q.top}px ${W - q.right}px ${H - q.bottom}px ${q.left}px)`;
    layer.style.clipPath = inset(start);
    document.body.append(layer);
    // the jump, instant (the page's own handler of in-page links would glide through the whole page), and what that
    // handler does besides: the focus goes along, so the next Tab carries on from the configurator
    e.preventDefault();
    e.stopPropagation();
    const wb = document.getElementById('configurator');
    wb.scrollIntoView({ behavior: 'instant' });
    if (!wb.matches('a, button, input, select, textarea, summary, [tabindex]')) wb.setAttribute('tabindex', '-1');
    wb.focus({ preventScroll: true });
    holding = true;
    requestAnimationFrame(() => {
      const vr = vw.getBoundingClientRect();
      // the subject of the frame lands in the middle of the view, the copy scaled down as far as it still covers it
      const sx = sr.left + subject.x * sr.width, sy = sr.top + ty + subject.y * sr.height;
      const sc = Math.min(1, Math.max(vr.width / sr.width, vr.height / sr.height));   // (the copy still covers the view)
      shot.style.transformOrigin = `${sx - sr.left}px ${sy - sr.top - ty}px`;
      const ease = 'cubic-bezier(.7, 0, .2, 1)', ms = 760;
      shot.animate([{ transform: 'none' }, { transform: `translate(${vr.left + vr.width / 2 - sx}px, ${vr.top + vr.height / 2 - sy}px) scale(${sc})` }],
        { duration: ms, easing: ease, fill: 'forwards' });
      const land = layer.animate([{ clipPath: inset(start) }, { clipPath: inset(vr) }], { duration: ms, easing: ease, fill: 'forwards' });
      let gone = false, cap = 0;
      const away = (fast) => {
        if (gone) return;
        gone = true;
        clearTimeout(cap);
        for (const [ev, f] of quit) removeEventListener(ev, f);
        holding = false;
        cameraFromFilm();
        layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fast ? 180 : 520, easing: 'ease-out', fill: 'forwards' })
          .finished.then(() => layer.remove(), () => layer.remove());
      };
      // a scroll, a wheel, a touch or a key: the picture goes at once (it is fixed: it would come loose of the view)
      const quit = ['wheel', 'touchstart', 'keydown', 'scroll'].map((ev) => [ev, () => away(true)]);
      land.finished.then(() => {
        if (gone) return;
        for (const [ev, f] of quit) addEventListener(ev, f, { passive: true, once: true });
        const ready = () => viewer?.whole && status && /\bok\b/.test(status.className);
        if (ready()) { away(false); return; }
        const mo = new MutationObserver(() => { if (ready()) { mo.disconnect(); away(false); } });
        if (status) mo.observe(status, { attributes: true, attributeFilter: ['class'] });
        cap = setTimeout(() => { mo.disconnect(); away(false); }, 2400);
      }, () => away(true));
    });
  });
}
