// The scroll film: the frames of scripts/blender/scroll.py, one drawn per step of the scroll (forwards and
// backwards), and the texts of the page coming in at their frames. Without it (reduced motion, data saving, no
// frames) the section is a plain page: a still and the same texts, one after another.
import { $, BASE, CALM } from './state.js';

const pad = (n) => String(n).padStart(3, '0');
const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export async function startFilm() {
  const root = $('#film');
  if (!root) return;
  const plain = () => root.classList.add('plain');
  if (CALM.matches || navigator.connection?.saveData) { plain(); return; }
  const meta = await fetch(BASE + 'scroll/film.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const canvas = $('#filmCanvas');
  const ctx = canvas?.getContext('2d');
  if (!meta || !ctx) { plain(); return; }

  // the frames: the big set on wide screens, every second frame at 960 px on phones
  const size = innerWidth * Math.min(devicePixelRatio, 2) > 1100 ? meta.sizes[0] : meta.sizes.at(-1);
  const count = Math.floor((meta.frames - 1) / size.step) + 1;
  // coarse first (every 16th, 8th...), so the whole film can be scrubbed after the first pass and sharpens after
  const order = [];
  for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < count; i += step) if (!order.includes(i)) order.push(i);
  const sets = {};
  let theme = themeNow();
  let shown = -1, cur = 0, target = 0, dirty = true, running = false;
  const beats = [...root.querySelectorAll('.beat')].map((el) => ({ el, from: Number(el.dataset.from), to: Number(el.dataset.to) }));
  const bar = $('#filmBar');

  function load(th) {
    if (sets[th]) return sets[th];
    const imgs = new Array(count);
    let next = 0;
    const pump = () => {
      if (next >= order.length) return;
      const i = order[next++];
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { im.ok = true; if (th === theme && Math.abs(i - Math.round(cur)) <= 16) { dirty = true; kick(); } pump(); };
      im.onerror = pump;
      im.src = `${BASE}scroll/${th}/${size.dir}/${pad(i + 1)}.webp`;
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
    root.classList.add('live');
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, hh = im.naturalHeight * s;
    // a screen less wide than the picture crops its sides. Tall (the text is at the foot, see the styles): the
    // subject goes to the middle. Wide: it stays as far across as the shot put it, so the text keeps its side.
    const fx = subjectAt(1 + i * size.step);
    const x = Math.min(0, Math.max(cw - w, cw * (cw / ch < 4 / 3 ? 0.5 : fx) - w * fx));
    ctx.drawImage(im, x, (ch - hh) / 2, w, hh);
    shown = i;
  }

  function tick() {
    cur += (target - cur) * 0.2;                           // the picture follows the scroll with a little weight
    if (Math.abs(target - cur) < 0.02) cur = target;
    if (Math.round(cur) !== shown || dirty) { dirty = false; draw(); }
    const frame = 1 + cur * size.step;
    for (const b of beats) b.el.classList.toggle('on', frame >= b.from && frame <= b.to + 0.999);
    if (bar) bar.style.transform = `scaleX(${(cur / (count - 1)).toFixed(4)})`;
    if (cur !== target) requestAnimationFrame(tick); else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  function measure() {
    const r = root.getBoundingClientRect();
    const span = r.height - innerHeight;
    target = (span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0) * (count - 1);
    kick();
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    dirty = true;
    measure();
  }

  load(theme);
  new ResizeObserver(resize).observe(canvas);
  addEventListener('scroll', measure, { passive: true });
  // the other theme has its own film: its frames load when the theme changes
  new MutationObserver(() => {
    if (themeNow() === theme) return;
    theme = themeNow();
    load(theme);
    dirty = true;
    kick();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  resize();
}
