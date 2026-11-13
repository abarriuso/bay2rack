// The scroll film: the frames of scripts/blender/scroll.py, one drawn per step of the scroll (forwards and
// backwards), and the texts of the page coming in at their frames. Without it (reduced motion, data saving, no
// frames) the section is a plain page: a still and the same texts, one after another.
//
// The frames come in tiers (film.json "sizes", each with its role):
//   base   every 4th frame, small: on every device, coarse first, so the whole film scrubs almost at once
//   fine   every frame, 1600 px: wide screens without touch, only around the scroll position (ahead of the way it
//          goes) and only while the film is on screen - a visitor who never scrolls it downloads a first stretch
//          and no more; each one replaces the base picture of its frame as it arrives
//   sharp  every 2nd frame, 2560 px: big screens, only where the scroll RESTS (the key frame there and its
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
// picture into the shape of the workbench, its 3D view and its steps column. Then the kit on the table turns 3D -
// the same pieces, in the same places, on the same table, from the same camera - and the rest of the scroll builds
// the PC from it (assemble.js). The configurator is right under the stage, its 3D view where the coda's window is:
// there the film gives way to it, built.
import './css/film-extra.css';
import { $, BASE, CALM, NARROW } from './state.js';
import { viewer, startEngine } from './engine.js';
import { sfx, softly, drift, audible, setSound, soundOn } from './sound.js';

const pad = (n) => String(n).padStart(4, '0');
// a reload, or back to this page: where it was, kept by the film (see the end of startFilm)
const back = (() => { try { const f = history.state?.film; return f && Number.isFinite(f.y) ? f : null; } catch { return null; } })();
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
// how far into the film the configurator's engine starts (it has the film's build ready by its end)
const ENGINE_AT = 0.4;

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
    // (the place kept by a film that ran before - motion allowed then: this page has another length; the configurator
    // if the visitor was in it, else that place as near as it is)
    if (back) {
      try { history.scrollRestoration = 'auto'; } catch { /* (old browser) */ }
      if (back.built) $('#configurator')?.scrollIntoView({ behavior: 'instant' });
      else scrollTo({ top: back.y, behavior: 'instant' });
    }
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
  let ka = 0, asmT = 0;                                     // ...and the build in it: 0 the kit on the table, 1 the PC
  let resting = false, restKey = -1, restTimer = 0, visible = true;
  let engaged = false, booted = false, fineAt = -1, fineDir = 1;   // (the fine set: see nextJob)
  let merged = false;                                       // the configurator over the stage (see the end)
  let built = false, rested = 0, touching = 0;              // (the PC built once: its stretch gone, see the end)
  let auto = null;                                          // (the build playing itself: see the end)
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
    let next = 0, fetching = 0, dead = false, at = Math.min(n - 1, Math.max(0, Math.round(cur / step))), dir = 1;
    const asked = new Set();
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
      // the files where the film is first (a reel made anew - the other theme - starts there), then the whole film
      const around = [at, at + dir, at - dir, at + 2 * dir].filter((i) => i >= 0 && i < n && !blobs[i] && !asked.has(i));
      while (fetching < IN_FLIGHT && (around.length || next < files.length)) {
        const i = around.length ? around.shift() : files[next++];
        if (blobs[i] || asked.has(i)) continue;
        asked.add(i);
        fetching++;
        fetch(`${BASE}scroll/${th}/${sz.dir}/${pad(i + 1)}.webp${ver}`).then((r) => (r.ok ? r.blob() : null)).catch(() => null).then((b) => {
          fetching--;
          asked.delete(i);
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
    const c = Math.min(tiers.base.n - 1, Math.round(cur / tiers.base.step));
    for (const i of [c, c + 1, c - 1]) if (i >= 0 && i < tiers.base.n && !s.base[i]) return ['base', i];
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
  let swap = null;                                          // the other theme on its way: { shot, tol } (see below)
  function draw(force) {
    const got = pick(Math.round(cur));
    if (!got) { if (swap && force) paint(swap.shot, Math.round(cur), false); return; }
    const [im, frame, mid = false] = got;
    if (swap) {
      // (a picture of another moment - the first ones of a film are spread over all of it - would flash by)
      // (on a wide screen it waits a moment for the fine picture of this very frame: a base one is up to two away)
      // (and after a few seconds - a slow network - whatever it has)
      const late = performance.now() - swap.t0;
      const tol = late > 4000 ? Infinity : !useReel && fineOn && late < 1500 ? 1 : swap.tol;
      if (Math.abs(frame - Math.round(cur)) > tol) { if (force) paint(swap.shot, frame, false); return; }
      fade = { im0: swap.shot, mid0: false, t0: performance.now(), im };
      swap = null;
      shownIm = im; shownFrame = frame; shownMid = mid;
      kick();
    }
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

  let kWritten = -1, rolling = false, airing = false;
  // the picture follows the scroll with a little weight: a fifth of the way per 60th of a second, whatever the
  // screen's rate (at 120 Hz, a tenth of it per refresh: the same glide, twice the pictures)
  let lastT = 0;
  function tick(now) {
    const dt = Math.min(100, Math.max(1, now - (lastT || now - 1000 / 60)));
    lastT = now;
    const ease = 1 - Math.pow(0.8, dt / (1000 / 60));
    cur += (target - cur) * ease;
    if (Math.abs(target - cur) < 0.05) cur = target;
    const kc0 = kc;
    kc += (codaT - kc) * ease;
    if (Math.abs(codaT - kc) < 0.002) kc = codaT;
    const ka0 = ka;
    ka += (asmT - ka) * ease;
    if (Math.abs(asmT - ka) < 0.0004) ka = asmT;
    if (ka !== ka0) stage3d();
    // (the air of the scroll while the stage closes and the PC is built: as fast as they move)
    if (ka !== ka0 || kc !== kc0) { airing = true; drift((Math.abs(ka - ka0) + Math.abs(kc - kc0) * 0.5) / (dt / 1000), ka > ka0 || kc > kc0); }
    else if (airing) { airing = false; drift(0); }
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
    }
    if (cur !== target || kc !== codaT || ka !== asmT || fade || (swap && performance.now() - swap.t0 < 5000)) requestAnimationFrame(tick);
    else {
      running = false;
      if (airing) { airing = false; drift(0); }
      clearTimeout(restTimer);
      restTimer = setTimeout(rest, REST_MS);
    }
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
  const codaEl = root.querySelector('.film-coda'), asmEl = root.querySelector('.film-assemble');
  let filmTop = 0, span = 1, stick = 0, coda = 0, close = 0, asm = 0;
  function geometry() {
    const r = root.getBoundingClientRect();
    filmTop = r.top + scrollY;
    stick = parseFloat(getComputedStyle(stage).top) || 0;
    const all = Math.max(1, r.height - stage.offsetHeight);
    close = Math.min(all * 0.25, codaEl?.offsetHeight ?? 0);
    asm = Math.min(all * 0.35, asmEl?.offsetHeight ?? 0);
    coda = close + asm;
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
    // (stacked: the view on top, the steps under it - the coda closes into that, as tall as the view is)
    stage.classList.toggle('stacked', !!wb && !sideBySide);
    set('--win', wb && !sideBySide && $('.viewer') ? `${$('.viewer').offsetHeight}px` : null);
    // the configurator comes up under the stage: where the stage lets go, its 3D view is where the coda's window is
    // (so the two scroll on together, one over the other, and the film can give way to it there)
    const win = root.querySelector('.film-window'), vw = $('.viewer'), build = $('#build');
    if (win && vw && build) {
      const s = stage.getBoundingClientRect();
      const wt = win.getBoundingClientRect().top - s.top, v = vw.getBoundingClientRect();
      const y = wt - stage.offsetHeight - (v.top - build.getBoundingClientRect().top);
      build.style.setProperty('--merge-y', `${y.toFixed(3)}px`);
      // the 3D view's place on the stage while the PC is built: there, its size (the view itself, inside the
      // viewer's frame: a phone's has a line under it)
      const c = $('#view')?.getBoundingClientRect() ?? v;
      set('--v3-l', `${(c.left - s.left).toFixed(3)}px`);
      set('--v3-t', `${(wt + c.top - v.top).toFixed(3)}px`);
      set('--v3-w', `${c.width}px`);
      set('--v3-h', `${c.height}px`);
    }
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
    const prev = lastY;
    lastY = scrollY;
    const y = lastY + stick - filmTop;
    const t = Math.min(1, Math.max(0, y / span)) * last;
    // the coda closes over its first stretch (and holds a little), the PC is built over the next, then the stage
    // scrolls away
    const c = close ? Math.min(1, Math.max(0, (y - span) / (close * 0.8))) : 0;
    const a = asm ? Math.min(1, Math.max(0, (y - span - close) / asm)) : 0;
    if (t >= last * ENGINE_AT) prepare();
    setMerged(y >= span + coda);                       // (where the stage has let go: no sooner, by a fraction)
    autoplay(lastY - prev, a);
    if (t !== target) { target = t; if (booted) engaged = true; if (resting) resting = false; }
    clearTimeout(restTimer);
    if (t === cur && c === codaT && a === asmT && !running) { restTimer = setTimeout(rest, REST_MS); return; }
    codaT = c;
    asmT = a;
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
  if ($('#view')) ro.observe($('#view'));                   // ...and its 3D view (where the PC is built)
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
    // what is on screen stays (a copy: the pictures behind it are let go) until the new film has this frame
    if (shownIm && canvas.width) {
      const shot = document.createElement('canvas');
      shot.width = canvas.width; shot.height = canvas.height;
      shot.getContext('2d', { alpha: false }).drawImage(canvas, 0, 0);
      swap = { shot, tol: useReel ? 2 : tiers.base.step, t0: performance.now() };
    }
    fade = null;
    shownIm = null;
    // the sharper picture where it rests: the new film's
    resting = false;
    clearTimeout(restTimer);
    restTimer = setTimeout(rest, REST_MS);
    thread();
    pump();
    kick();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------------------------------------------------------------- into the configurator
  // The last stretch of the stage builds the PC (assemble.js). The 3D view's own canvas comes into the coda's window
  // (.film-3d: where the 3D view will be, at its size), over the film's last picture, and shows that same picture:
  // the film's bare table (the plate, laid on the 3D floor) and the kit on it in 3D. It fades in over the picture
  // (the two differ only in the light on the pieces), and the scroll builds the PC. Where the stage lets go, the
  // configurator is right under it, its 3D view exactly where the window is: the canvas goes home to it and the steps
  // come in where the last text was. Back up, all of it the other way (once built, over a shorter stretch: see
  // collapse()). A visitor who changed the build, or came with settings in the link, gets the configurator as it is:
  // the film just gives way to it.
  let assembly = null, preparing = false, pinned = false;
  const view = $('#view');
  const box3d = document.createElement('div');
  box3d.className = 'film-3d';
  box3d.setAttribute('aria-hidden', 'true');
  const plate = document.createElement('img');
  plate.className = 'film-plate';
  plate.alt = '';
  plate.decoding = 'async';
  box3d.append(plate);
  root.querySelector('.film-window')?.after(box3d);
  // (a phone, or a small window: the lighter plate; it is a blur of a floor)
  const plateSrc = () => `${BASE}scroll/${themeNow()}/plate${TOUCH || innerWidth * (devicePixelRatio || 1) < 2000 ? '-1600' : ''}.webp`;
  const setPlate = () => {
    const src = plateSrc();
    if (plate.getAttribute('src') === src) return;
    plate.onload = () => { plate.style.width = `${plate.naturalWidth}px`; plate.style.height = `${plate.naturalHeight}px`; stage3d(); };
    plate.setAttribute('src', src);
  };
  new MutationObserver(() => { if (plate.getAttribute('src')) setPlate(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const firstLook = () => !built && !/=/.test(location.hash);
  // another build (the visitor's), or a look of the view's own on: the PC is no longer the film's - it stays as it
  // is, and the film gives way to it without the stretch that built it
  const letGo = () => {
    if (!assembly) return;
    const a = assembly;
    assembly = null;
    a.finish();
    pin(false);
    root.classList.remove('live3d');
    if (built && !root.classList.contains('bare')) queueMicrotask(() => relength(() => root.classList.add('bare')));
  };

  // where the film's last picture lies, seen from where the 3D view is on the stage (CSS px): as paint() lays it, and
  // as the coda moves it
  function pictureRect() {
    const W = canvas.clientWidth, H = canvas.clientHeight, A = plainSz.w && plainSz.h ? plainSz.w / plainSz.h : 16 / 9;
    const pw = Math.max(W, H * A), ph = pw / A, fx = subjectAt(1 + last);
    const x = Math.min(0, Math.max(W - pw, W * (W / H < 4 / 3 ? 0.5 : fx) - pw * fx));
    const s = stage.getBoundingClientRect(), w = root.querySelector('.film-window').getBoundingClientRect();
    const b = box3d.getBoundingClientRect();
    let y = (H - ph) / 2;
    if (stage.classList.contains('stacked')) y += (w.height - H) / 2;   // (stacked, the coda slides it up)
    return { left: x - (b.left - s.left), top: y - (b.top - s.top), width: pw, height: ph };
  }
  const viewBox = () => ({ left: 0, top: 0, width: view.clientWidth, height: view.clientHeight });
  // the page laid out anew (a resized window, a turned phone): the build framed as it now is (after geometry(): this
  // observer comes after the film's own)
  const relayout = new ResizeObserver(() => { if (assembly) { assembly.reframe(pictureRect(), viewBox()); stage3d(); } });
  for (const el of [root, stage, view]) if (el) relayout.observe(el);
  // the engine starts in the film; its first model - the film's build - is laid out on the table the moment it comes,
  // before it is ever drawn
  async function prepare() {
    if (preparing) return;
    preparing = true;
    try {
      const [mod] = await Promise.all([import('./assemble.js'), startEngine()]);
      mod.preloadTable();
      const v = viewer;
      if (!v || v.model || !firstLook()) return;              // (a model on screen already: it stays as it is)
      setPlate();
      const load = v.load;
      let first = true;
      v.load = function (buf, ext, opts = {}) {
        const film = first && firstLook();
        first = false;
        load.call(this, buf, ext, film ? { ...opts, still: true } : opts);
        if (assembly && v.model !== assembly.model) letGo();
        if (!film) return;
        mod.fromTable(v, pictureRect(), viewBox()).then((a) => {
          if (!a || !firstLook() || v.model !== a.model) { a?.finish(); return; }
          assembly = a;
          root.classList.add('live3d');
          stage3d();
        });
      };
    } catch (e) { console.warn(e); }
  }

  // the canvas on the stage (while the PC is built) or home in the configurator
  function pin(on) {
    const v = viewer;
    if (on === pinned || !v) return;
    pinned = on;
    const c = v.renderer.domElement;
    (on ? box3d : view).append(c);
    c.tabIndex = on ? -1 : 0;
    v.pinned = on;
    v.controls.enabled = !on;
    box3d.classList.toggle('on', on);
    v.dirty = true;
  }
  const smooth = (x) => x * x * (3 - 2 * x);
  const seg = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  // the build at the scroll's place: the pieces, the camera, the table under them, the window over the picture
  function stage3d() {
    const v = viewer;
    if (assembly && v?.model !== assembly.model) letGo();  // (another build came: it is the visitor's)
    const home = merged && ka >= 1;
    // (back into the stretch from the configurator: it comes apart from where the visitor left it, if it can)
    if (assembly?.parked && !home && !assembly.resume(pictureRect(), viewBox())) letGo();
    if (!assembly) { pin(false); box3d.style.opacity = 0; return; }
    if (home) { assembly.park(); pin(false); return; }    // (the configurator's: the view is the visitor's)
    assembly.at(ka);
    pin(!merged && ka > 0);
    box3d.style.opacity = smooth(seg(ka, 0, assembly.fade * 0.9)).toFixed(4);
    // the bare table: on the 3D floor, under the camera as it rises; it gives way to the studio as the camera leaves it
    const m = plate.naturalWidth ? assembly.plateMatrix(plate.naturalWidth, plate.naturalHeight) : null;
    plate.style.opacity = m ? (1 - smooth(seg(ka, 0.26, 0.58))).toFixed(4) : 0;
    if (m) plate.style.transform = m;
  }
  let settled = 0, arrived = 0;
  function setMerged(m) {
    if (m === merged) return;
    merged = m;
    if (m) arrived = performance.now();
    root.classList.toggle('merged', m);
    if (m) prepare();
    // (scrolled into the editor: it is yours - a soft settle, now and then)
    if (m && engaged && performance.now() - settled > 4000) { settled = performance.now(); softly(0.6, () => sfx.settle()); }
    stage3d();
    atRest();
  }
  // Only the first time do the pieces come from the table. Once the visitor is in the configurator and the page is
  // at rest (no finger on it: a phone's glide is over), the stretch that built the PC goes: all of it is above, so the
  // page's place is moved up by as much and nothing on screen moves. Back up from the configurator, the film is right
  // there - not a long way back through the build.
  addEventListener('touchstart', () => { touching++; }, { passive: true });
  for (const ev of ['touchend', 'touchcancel']) addEventListener(ev, () => { touching = Math.max(0, touching - 1); atRest(); aim(); }, { passive: true });
  addEventListener('scroll', () => {
    const y = scrollY;
    if (y !== wentY) { went = Math.sign(y - wentY); wentY = y; }
    atRest();
    aim();
  }, { passive: true });
  // A phone's configurator is one screen. Come down into it by a swipe, the glide may carry the page a little past it:
  // once at rest, just after arriving, it is put square on the screen. (Only then - going on down, or back up, the
  // page stays where the visitor leaves it.)
  const stacked = matchMedia(NARROW);
  let went = 0, wentY = scrollY, aimT = 0;
  function aim() {
    clearTimeout(aimT);
    aimT = setTimeout(() => {
      if (!merged || went <= 0 || touching || !stacked.matches || performance.now() - arrived > 2500) return;
      const t = $('.workbench')?.getBoundingClientRect().top ?? 0;
      if (Math.abs(t) > 1 && Math.abs(t) < innerHeight * 0.25) scrollBy({ top: t, behavior: 'smooth' });
    }, 160);
  }
  function atRest() {
    clearTimeout(rested);
    if (!built && merged) rested = setTimeout(collapse, 450);
  }
  function collapse() {
    if (built || !merged) return;
    if (touching) { atRest(); return; }
    built = true;
    // (the PC of the film: a short stretch, where it comes apart and back again; else none)
    relength(() => { root.classList.add('built'); root.classList.toggle('bare', !assembly); });
  }
  // The stretch above the configurator changes its length: where the 3D view is on screen, before and after - whatever
  // the browser's own scroll anchoring did meanwhile - the page is put back so that it has not moved.
  function relength(change) {
    const was = view.getBoundingClientRect().top;
    change();
    const moved = view.getBoundingClientRect().top - was;
    if (Math.abs(moved) > 0.5) {
      dispatchEvent(new Event('b2r:jump'));                  // (the page's place moves, not the visitor: the header stays - main.js)
      scrollBy({ top: moved, behavior: 'instant' });
    }
    geometry();
    measure();
  }
  // the keyboard in the configurator while the film still covers it (a Tab from the last text): the page goes on to it
  $('#build')?.addEventListener('focusin', () => { if (!merged) toConfigurator(); });
  function toConfigurator() {
    scrollTo({ top: filmTop - stick + span + coda + 1, behavior: 'instant' });
    measure();
    collapse();
  }
  // Once the film's picture has become the 3D view, the build plays itself: the page goes on into the configurator
  // on its own, at the pace of the build (the scroll is still what drives it - the same poses, the same sounds - so a
  // hand on the page takes it back at once: a finger, the wheel or a key upwards; a scroll on down goes along with it).
  const AUTO_MS = 4600;                                     // (the whole build, from the 3D view in)
  function autoplay(dy, a) {
    if (auto || touching || dy <= 0 || dy > innerHeight * 2 || merged || !assembly || assembly.parked) return;
    if (a < assembly.fade || a > 0.97) return;
    glide(filmTop - stick + span + coda + 1, AUTO_MS * (1 - a) / (1 - assembly.fade));
  }
  // the page taken to `to` over `ms`, a frame at a time (the film follows it as it follows any scroll)
  function glide(to, ms) {
    auto = { from: scrollY, to, t0: performance.now(), ms, set: scrollY, dir: Math.sign(to - scrollY) || 1 };
    requestAnimationFrame(play);
  }
  function play(now) {
    if (!auto) return;
    const y = scrollY, d = auto.dir;
    // (taken back the other way, or - on the way down - the build is the visitor's now)
    if ((y - auto.set) * d < -2 || (d > 0 && !assembly)) { auto = null; return; }
    const k = Math.min(1, (now - auto.t0) / auto.ms);
    const want = auto.from + (auto.to - auto.from) * (1 - Math.cos(Math.PI * k)) / 2;
    // (a scroll of the visitor's ahead of it leads: it goes on from there)
    if ((want - y) * d > 0.5) { auto.set = want; scrollTo({ top: want, behavior: 'instant' }); } else auto.set = y;
    if (k < 1 && (auto.to - y) * d > 0) requestAnimationFrame(play); else auto = null;
  }
  // a phone's configurator holds the screen: its key takes the page back up into the film (main.js) - the PC comes
  // apart on the way, as it does for a scroll up - to where the film's last frames are
  addEventListener('b2r:up', (e) => {
    e.preventDefault();
    glide(filmTop - stick + span, built && !root.classList.contains('bare') ? 2600 : 1600);
  });
  const stopAuto = () => { auto = null; };
  addEventListener('touchstart', stopAuto, { passive: true });
  addEventListener('wheel', (e) => { if (e.deltaY < 0) stopAuto(); }, { passive: true });
  addEventListener('keydown', (e) => { if (/^(ArrowUp|PageUp|Home)$/.test(e.key) || (e.key === ' ' && e.shiftKey)) stopAuto(); });

  // The sounds of the build: a browser lets a page make them only after a click or a key on it, never for a scroll.
  // Until then (and unless they were turned off) the film offers a quiet key for them, by the one that skips it.
  const hush = () => root.classList.toggle('hush', soundOn() && !audible());
  addEventListener('b2r:sound', hush);
  hush();
  root.querySelector('.film-sound')?.addEventListener('click', () => {
    setSound(true);
    hush();
    setTimeout(() => softly(0.6, () => sfx.snap(0, 1)), 80);
  });
  // "Configure yours", the key that skips the film: the page goes on to where the film has given way
  for (const a of root.querySelectorAll('a[href="#configurator"], .film-skip')) a.addEventListener('click', (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    toConfigurator();
    const wb = $('#configurator');
    if (!wb.matches('[tabindex]')) wb.setAttribute('tabindex', '-1');
    wb.focus({ preventScroll: true });
  });

  // (all of the film set up: it starts - a page opened further down starts the engine at once, see measure())
  geometry();
  fit();
  measure();
  booted = true;

  // ---------------------------------------------------------------- a reload, or back to this page
  // The browser would put the page back where it was before the film has its length (this script lays it out, once
  // the list of frames has come), and with the stretch the build took away back in: somewhere in the film, not in the
  // configurator. So the film keeps the page's place in its history entry and puts it back itself, laid out as it was.
  if (back) {
    // (a PC built before this load is not the film's one any more: the configurator as it is)
    let y = back.y;
    if (back.built) {
      built = true;
      root.classList.add('built', 'bare');
      geometry();
      // (the short stretch it had then, under the configurator's place: gone)
      const from = filmTop - stick + span + close;
      if (back.cut > 0 && y > from) y = Math.max(from, y - back.cut);
    }
    scrollTo({ top: y, behavior: 'instant' });
    measure();
  }
  let placeT = 0;
  const keepPlace = () => {
    clearTimeout(placeT);
    try {
      const cut = built && !root.classList.contains('bare') ? asm : 0;
      history.replaceState({ ...(history.state ?? {}), film: { y: Math.round(scrollY), built, cut } }, '');
      history.scrollRestoration = 'manual';
    } catch { /* (too many in a row: the next one) */ }
  };
  addEventListener('scroll', () => { clearTimeout(placeT); placeT = setTimeout(keepPlace, 300); }, { passive: true });
  addEventListener('pagehide', keepPlace);
}
