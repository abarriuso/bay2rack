// The scroll film: the frames of scripts/blender/scroll.py, one drawn per step of the scroll (forwards and
// backwards), and the texts of the page coming in at their frames. Without it (reduced motion, data saving, no
// frames) the section is a plain page: a still and the same texts, one after another.
import { $, BASE, CALM } from './state.js';

const pad = (n) => String(n).padStart(4, '0');
const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

// Touch devices (phones, tablets; iOS Safari above all) keep every decoded frame in a small memory budget and reload
// the tab when it runs out. There the film takes the largest set that still gives FEW frames within PIXELS, and skips
// frames of it if it must: about 256 MB of decoded pictures, as many frames as the phone set had before.
const TOUCH = navigator.maxTouchPoints > 1 || matchMedia('(pointer: coarse)').matches;
const PIXELS = 64e6, FEW = 100;
const area = (sz) => (sz.w || 1600) * (sz.h || 900);
// the canvas never holds more than this (a 4K screen at 2x would be 33 Mpx to fill per frame)
const CANVAS_MAX = 4.2e6;

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
  const meta = await fetch(BASE + 'scroll/film.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const canvas = $('#filmCanvas');
  const ctx = canvas?.getContext('2d', { alpha: false });
  if (!meta || !ctx) { plain(); return; }

  // the frames: the big set on wide screens, the small one on phones (and on any touch screen, see TOUCH)
  const framesOf = (sz) => Math.floor((meta.frames - 1) / sz.step) + 1;
  let size, skip = 1;
  if (TOUCH) {
    // largest first: the first set that still has FEW frames inside the budget, else the smallest
    const fits = (sz) => Math.min(framesOf(sz), Math.floor(PIXELS / area(sz))) >= FEW;
    size = meta.sizes.find(fits) ?? meta.sizes.at(-1);
    skip = Math.max(1, Math.ceil(framesOf(size) / Math.floor(PIXELS / area(size))));
  } else size = innerWidth * Math.min(devicePixelRatio, 2) > 1100 ? meta.sizes[0] : meta.sizes.at(-1);
  const step = size.step * skip;                           // film frames per picture we load
  const count = Math.floor((meta.frames - 1) / step) + 1;
  showStill(size.dir);
  // coarse first (every 64th, 32nd...), so the whole film can be scrubbed after the first pass and gets finer after
  const order = [];
  const queued = new Set();
  for (let s = 64; s >= 1; s /= 2)
    for (let i = 0; i < count; i += s) if (!queued.has(i)) { queued.add(i); order.push(i); }
  const sets = {};
  let theme = themeNow();
  let shown = -1, cur = 0, target = 0, dirty = true, running = false;
  // each text of the page and the frames it belongs to (film.json has them, in the order of the page)
  const beats = [...root.querySelectorAll('.beat')].map((el, i) => ({ el, from: meta.beats[i]?.from ?? 0, to: meta.beats[i]?.to ?? 0, on: el.classList.contains('on') }));
  const bar = $('#filmBar');
  const stage = root.querySelector('.film-stage');

  function load(th) {
    if (sets[th]) return sets[th];
    const imgs = new Array(count);
    let next = 0;
    const pump = () => {
      if (imgs.dropped || next >= order.length) return;
      const i = order[next++];
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { im.ok = true; if (th === theme && Math.abs(i - Math.round(cur)) <= 16) { dirty = true; kick(); } pump(); };
      im.onerror = pump;
      im.src = `${BASE}scroll/${th}/${size.dir}/${pad(i * skip + 1)}.webp`;
      imgs[i] = im;
    };
    for (let k = 0; k < 6; k++) pump();                    // six at a time
    return (sets[th] = imgs);
  }

  // where the subject of a frame sits across the picture (the shots keep it off the side of the text): a phone
  // crops the sides, and keeps this in the middle
  const subjectAt = (frame) => meta.beats.find((b) => frame <= b.to)?.subject ?? 0.5;

  function draw() {
    const imgs = sets[theme];
    const i = Math.round(cur);
    let im = null;
    for (let d = 0; d < count && !im; d++) im = imgs[i - d]?.ok ? imgs[i - d] : imgs[i + d]?.ok ? imgs[i + d] : null;
    if (!im) return;
    if (!root.classList.contains('live')) root.classList.add('live');
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, hh = im.naturalHeight * s;
    // a screen less wide than the picture crops its sides. Tall (the text is at the foot, see the styles): the
    // subject goes to the middle. Wide: it stays as far across as the shot put it, so the text keeps its side.
    const fx = subjectAt(1 + i * step);
    const x = Math.min(0, Math.max(cw - w, cw * (cw / ch < 4 / 3 ? 0.5 : fx) - w * fx));
    ctx.drawImage(im, x, (ch - hh) / 2, w, hh);
    shown = i;
  }

  function tick() {
    cur += (target - cur) * 0.2;                           // the picture follows the scroll with a little weight
    if (Math.abs(target - cur) < 0.02) cur = target;
    if (Math.round(cur) !== shown || dirty) { dirty = false; draw(); }
    const frame = 1 + cur * step;
    // only what changed is written: no style work for the page while the texts stay as they are
    for (const b of beats) {
      const on = frame >= b.from && frame <= b.to + 0.999;
      if (on !== b.on) { b.on = on; b.el.classList.toggle('on', on); }
    }
    if (bar) bar.style.transform = `scaleX(${(cur / (count - 1)).toFixed(4)})`;
    if (cur !== target) requestAnimationFrame(tick); else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  // The geometry is read when something resizes, never while scrolling: a scroll only reads scrollY (no layout).
  // The stage sticks from where the film starts until its foot meets the film's; that stretch is the whole film. It is
  // measured with the stage's own height (svh, steady), not innerHeight, which on iPhone changes as Safari's bars
  // fold and unfold and would nudge the frame.
  let filmTop = 0, span = 1, stick = 0;
  function geometry() {
    const r = root.getBoundingClientRect();
    filmTop = r.top + scrollY;
    stick = parseFloat(getComputedStyle(stage).top) || 0;
    span = Math.max(1, r.height - stage.offsetHeight);
  }
  function measure() {
    const p = (scrollY + stick - filmTop) / span;
    target = Math.min(1, Math.max(0, p)) * (count - 1);
    kick();
  }

  // The canvas bitmap: as sharp as the screen (up to 2x) but never sharper than the frame itself (more pixels would
  // only stretch the same picture, and cost a bigger fill per frame), and within CANVAS_MAX.
  let bw = 0, bh = 0, settle = 0;
  function fit() {
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;
    const nat = size.w && size.h ? 1 / Math.max(cssW / size.w, cssH / size.h) : 2;
    const k = Math.min(devicePixelRatio || 1, 2, nat, Math.sqrt(CANVAS_MAX / (cssW * cssH)));
    const w = Math.max(1, Math.round(cssW * k)), h = Math.max(1, Math.round(cssH * k));
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = bw = w;                                  // (this clears the bitmap: the frame goes back on below,
    canvas.height = bh = h;                                 //  before the browser paints)
    shown = -1;
    draw();
  }
  function resize() {
    geometry();
    measure();
    // only the height moved, by a little (the bars of a phone's browser, a keyboard): the bitmap stays, stretched to
    // cover by object-fit, and is redone once it has settled - no blank canvas between two frames
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const k = bw / Math.max(1, cssW);
    clearTimeout(settle);
    if (bw && Math.abs(cssW * k - bw) < 2 && Math.abs(cssH * k - bh) < bh * 0.2) settle = setTimeout(fit, 300);
    else fit();
  }

  load(theme);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  ro.observe(root);                                         // the film's own height (the svh of a rotated phone)
  const top = $('.top');
  if (top) ro.observe(top);                                 // the header above it (where the film starts)
  addEventListener('scroll', measure, { passive: true });
  // the keyboard: a link of a text that is not on screen yet (Tab) takes the film to that text's frames, so what has
  // the focus is always in view
  root.addEventListener('focusin', (e) => {
    const b = beats.find((x) => x.el.contains(e.target));
    if (!b || b.on) return;
    const p = ((b.from + b.to) / 2 - 1) / Math.max(1, (count - 1) * step);
    scrollTo({ top: filmTop - stick + Math.min(1, Math.max(0, p)) * span, behavior: 'instant' });
  });
  // the other theme has its own film: its frames load when the theme changes, the old ones are let go (a phone
  // cannot hold both sets)
  new MutationObserver(() => {
    if (themeNow() === theme) return;
    const old = sets[theme];
    if (old) { old.dropped = true; for (const im of old) if (im && !im.ok) { im.onload = im.onerror = null; im.src = ''; } }
    delete sets[theme];
    theme = themeNow();
    showStill(size.dir);
    load(theme);
    dirty = true;
    kick();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  geometry();
  fit();
  measure();
}
