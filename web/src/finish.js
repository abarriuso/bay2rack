// After the kit downloads: the pieces laid out like print plates (seen from above, on the 180 x 180 mm bed of a small
// printer, as many plates as they need), what each one roughly takes in filament and time, and what to do next.
// Everything comes from the STLs the kit just made (their triangles), in the page.
import { t, lang } from './i18n.js';
import { $, h, num, S, CALM } from './state.js';
import { pieceLabel } from './tabs.js';
import { modal, closeButton } from './share.js';

// the bed and the guesses (said to be rough on the screen): PETG, ~45 % of the solid volume printed (walls + infill),
// ~12 mm³ of the piece's volume per second all told, a little more per piece and per plate (heating, the first layer)
const BED = 180, MARGIN = 4, GAP = 6;
const DENSITY = 1.27, FILL = 0.45, RATE = 12, PER_PIECE = 120, PER_PLATE = 180;

// ---------------------------------------------------------------- reading a binary STL
// its size from above, its outline (the convex hull), the faces on the bed (the first layer) and its volume
function analyse(data) {
  if (!data || data.byteLength < 84) return null;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const n = dv.getUint32(80, true);
  if (!n || 84 + n * 50 > data.byteLength) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0, o = 84 + 12; i < n; i++, o += 50) {
    for (let k = 0; k < 3; k++) {
      const x = dv.getFloat32(o + k * 12, true), y = dv.getFloat32(o + k * 12 + 4, true), z = dv.getFloat32(o + k * 12 + 8, true);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
    }
  }
  let vol = 0;
  const keys = new Set();
  const bottom = [];
  for (let i = 0, o = 84 + 12; i < n; i++, o += 50) {
    const p = [];
    let low = true;
    for (let k = 0; k < 3; k++) {
      const x = dv.getFloat32(o + k * 12, true) - minX, y = dv.getFloat32(o + k * 12 + 4, true) - minY, z = dv.getFloat32(o + k * 12 + 8, true);
      p.push(x, y, z);
      if (z > minZ + 0.3) low = false;
      keys.add(Math.round(x * 4) * 8192 + Math.round(y * 4));      // (to a quarter mm: the hull needs no more)
    }
    // signed volume of the tetrahedron to the origin (z from the bed: the same sum)
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p;
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    if (low) bottom.push(ax, ay, bx, by, cx, cy);
  }
  return { w: maxX - minX, d: maxY - minY, vol: Math.abs(vol), hull: hull([...keys].map((k) => [Math.floor(k / 8192) / 4, (k % 8192) / 4])),
    bottom: new Float32Array(bottom) };
}
// Andrew's monotone chain
function hull(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// ---------------------------------------------------------------- the plates
// shelves, tallest first; each piece lies with its long side across (turned a quarter if that is how it fits).
// A piece longer than the bed gets a plate of its own, marked.
function pack(items) {
  const room = BED - 2 * MARGIN;
  const plates = [];
  const sorted = [...items].sort((a, b) => Math.min(b.w, b.d) - Math.min(a.w, a.d) || Math.max(b.w, b.d) - Math.max(a.w, a.d));
  for (const it of sorted) {
    const rot = it.d > it.w;
    const w = Math.max(it.w, it.d), d = Math.min(it.w, it.d);
    if (w > room + 0.01) { plates.push({ big: true, spots: [{ it, x: MARGIN, y: MARGIN, rot, w, d }], shelves: [] }); continue; }
    let spot = null;
    for (const p of plates) {
      if (p.big) continue;
      const s = p.shelves.find((sh) => sh.h >= d && sh.x + w <= room + 0.01);
      if (s) { spot = { p, s }; break; }
      const top = p.shelves.reduce((y, sh) => Math.max(y, sh.y + sh.h + GAP), 0);
      if (top + d <= room + 0.01) { const s2 = { y: top, h: d, x: 0 }; p.shelves.push(s2); spot = { p, s: s2 }; break; }
    }
    if (!spot) { const p = { shelves: [{ y: 0, h: d, x: 0 }], spots: [] }; plates.push(p); spot = { p, s: p.shelves[0] }; }
    spot.p.spots.push({ it, x: MARGIN + spot.s.x, y: MARGIN + spot.s.y, rot, w, d });
    spot.s.x += w + GAP;
  }
  // the big ones last (a small bed needs them elsewhere)
  return [...plates.filter((p) => !p.big), ...plates.filter((p) => p.big)];
}

const grams = (vol) => vol / 1000 * DENSITY * FILL;
const seconds = (vol) => vol / RATE + PER_PIECE;
const fmtG = (g) => `${num(g < 10 ? Math.round(g * 10) / 10 : Math.round(g), 1)} g`;
function fmtT(s) {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

// ---------------------------------------------------------------- drawing a plate (from above, X right, Y up)
function drawPlate(canvas, plate) {
  const css = getComputedStyle(document.documentElement);
  const col = (n, fb) => css.getPropertyValue(n).trim() || fb;
  const ink = col('--ink', '#0a0a0a'), rule = col('--rule', '#dcdcdc'), edge = col('--edge', '#8a8a8a');
  const bedFill = col('--plate', '#f6f6f6'), ground = col('--ground', '#fff'), signal = col('--signal', '#d81f12');
  const cssW = Math.max(1, canvas.getBoundingClientRect().width);
  const px = Math.round(cssW * Math.min(devicePixelRatio || 1, 2));
  if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
  const g = canvas.getContext('2d');
  // what the drawing spans (mm): the bed, or more for a piece that is longer
  const span = Math.max(BED, ...plate.spots.map((s) => Math.max(s.x + s.w + MARGIN, s.y + s.d + MARGIN)));
  const sc = px / span;
  const oy = (span - BED) * sc;                       // (the bed sits at the bottom left of a bigger drawing)
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = ground;
  g.fillRect(0, 0, px, px);
  g.fillStyle = bedFill;
  g.fillRect(0, oy, BED * sc, BED * sc);
  // a 10 mm grid, a hair
  g.strokeStyle = rule;
  g.lineWidth = 1;
  g.beginPath();
  for (let mm = 10; mm < BED; mm += 10) {
    const a = Math.round(mm * sc) + 0.5;
    g.moveTo(a, oy); g.lineTo(a, oy + BED * sc);
    g.moveTo(0, oy + a); g.lineTo(BED * sc, oy + a);
  }
  g.stroke();
  g.strokeStyle = edge;
  g.strokeRect(0.5, oy + 0.5, BED * sc - 1, BED * sc - 1);
  const bottom = (span - 0) * sc;                    // canvas y of the bed's Y = 0 … from the top of the drawing
  for (const s of plate.spots) {
    const { it } = s;
    const e = s.x * sc + (s.rot ? s.w * sc : 0);
    const f = bottom - s.y * sc;
    // piece mm -> canvas: Y up; turned a quarter: (x, y) -> (d - y, x)
    if (s.rot) g.setTransform(0, -sc, -sc, 0, e, f); else g.setTransform(sc, 0, 0, -sc, e, f);
    if (!it.path) {
      it.path = new Path2D();
      it.hullPath = new Path2D();
      const b = it.bottom;
      for (let i = 0; i < b.length; i += 6) { it.path.moveTo(b[i], b[i + 1]); it.path.lineTo(b[i + 2], b[i + 3]); it.path.lineTo(b[i + 4], b[i + 5]); it.path.closePath(); }
      it.hull.forEach(([x, y], i) => (i ? it.hullPath.lineTo(x, y) : it.hullPath.moveTo(x, y)));
      it.hullPath.closePath();
    }
    g.globalAlpha = 0.14;
    g.fillStyle = ink;
    g.fill(it.hullPath);
    g.globalAlpha = 1;
    g.fill(it.path);
    g.strokeStyle = ink;
    g.lineWidth = 1.2 / sc;
    g.stroke(it.hullPath);
    // its number, on a red tag in the middle
    g.setTransform(1, 0, 0, 1, 0, 0);
    const cx = (s.x + s.w / 2) * sc, cy = bottom - (s.y + s.d / 2) * sc;
    const size = Math.round(Math.min(22, Math.max(16, cssW / 18)) * (px / cssW));
    g.font = `600 ${Math.round(size * 0.62)}px "Martian Mono Variable", ui-monospace, monospace`;
    const label = String(it.n);
    const tw = Math.max(size, g.measureText(label).width + size * 0.5);
    g.fillStyle = signal;
    g.fillRect(cx - tw / 2, cy - size / 2, tw, size);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, cx, cy + size * 0.04);
  }
}

// ---------------------------------------------------------------- the screen
// pieces: [{ name, qty, part, data }] as zipped; blob: the zip (to save it again); testsOnly: only the test pieces
export function showFinish({ pieces, blob, zipName, testsOnly = false }) {
  const v = { ...S.values };
  const body = h('div', { className: 'sf-fin-body', 'aria-busy': 'true' }, h('p', { className: 'sf-wait', textContent: t('fin_working') }));
  // the zip again, from a real tap (where a browser held back the first download)
  const zipUrl = blob ? URL.createObjectURL(blob) : null;
  const saveZip = zipUrl ? h('a', { className: 'btn ghost', download: zipName, href: zipUrl, textContent: t('fin_saveAgain') }) : null;
  const observers = [];
  const { close } = modal({
    label: 'sfFinTitle', className: 'sf-finish',
    onClose: () => { for (const r of observers) r.disconnect(); if (zipUrl) setTimeout(() => URL.revokeObjectURL(zipUrl), 1000); },
    content: [
      h('header', { className: 'sf-head' },
        h('p', { className: 'sf-kicker', textContent: `${t('fin_kicker')} · ${zipName}` }),
        h('h2', { id: 'sfFinTitle', textContent: t(testsOnly ? 'fin_titleTests' : 'fin_title') }),
        closeButton(() => close())),
      body,
      h('div', { className: 'sf-actions' }, saveZip,
        h('button', { type: 'button', className: 'primary', textContent: t('fin_done'), autofocus: true, onclick: () => close() })),
    ],
  });
  // the layout after the dialog is up (reading the STLs takes a moment on a phone)
  setTimeout(() => {
    if (!body.isConnected) return;
    body.replaceChildren(...layout(pieces, v, testsOnly, close, observers).filter(Boolean));
    body.removeAttribute('aria-busy');
  }, 30);
}

function layout(pieces, v, testsOnly, close, observers) {
  const kinds = pieces.map((f) => {
    const a = analyse(f.data);
    return a && { ...a, f, test: f.name.startsWith('tests/'), label: pieceLabel({ ...f, qty: 1 }, v) };
  }).filter(Boolean);
  const copies = (list) => list.flatMap((k) => Array.from({ length: k.f.qty }, () => k));
  const tests = kinds.filter((k) => k.test), rest = kinds.filter((k) => !k.test);
  // numbered in the order they print: the tests first
  [...tests, ...rest].forEach((k, i) => { k.n = i + 1; });
  const plates = [...pack(copies(tests)).map((p) => ({ ...p, tests: true })), ...pack(copies(rest))];
  const all = copies(kinds);
  const totalG = all.reduce((s, k) => s + grams(k.vol), 0);
  const totalT = all.reduce((s, k) => s + seconds(k.vol), 0) + plates.length * PER_PLATE;
  const big = plates.filter((p) => p.big).length;

  const stat = (value, label) => h('div', { className: 'sf-stat' }, h('b', { textContent: value }), h('span', { textContent: label }));
  const stats = h('div', { className: 'sf-stats' },
    stat(String(all.length), t('fin_pieces')),
    stat(String(plates.length), t('fin_plates')),
    stat(`≈ ${fmtG(totalG)}`, t('fin_filament')),
    stat(`≈ ${fmtT(totalT)}`, t('fin_time')));
  const approx = h('p', { className: 'hint sf-approx', textContent: t('fin_approx') });

  const figures = plates.map((p, i) => {
    const canvas = h('canvas', { className: 'sf-plate-canvas', width: 360, height: 360, role: 'img' });
    const here = [...new Map(p.spots.map((s) => [s.it.n, s.it])).values()].sort((a, b) => a.n - b.n);
    const count = (k) => p.spots.filter((s) => s.it === k).length;
    const g = p.spots.reduce((s, x) => s + grams(x.it.vol), 0);
    const time = p.spots.reduce((s, x) => s + seconds(x.it.vol), 0) + PER_PLATE;
    canvas.setAttribute('aria-label', `${t('fin_plate', { i: i + 1 })}: ${here.map((k) => `${count(k)} × ${k.label}`).join(', ')}`);
    const cap = h('figcaption', {},
      h('span', { className: 'sf-plate-name' },
        h('b', { textContent: t('fin_plate', { i: i + 1 }) }),
        p.tests ? h('span', { className: 'tape', textContent: t('fin_testsTag') }) : null),
      h('span', { className: 'sf-plate-est', textContent: `≈ ${fmtG(g)} · ≈ ${fmtT(time)}` }),
      p.big ? h('span', { className: 'sf-big', textContent: t('fin_tooBig', { w: num(p.spots[0].w, 0), d: num(p.spots[0].d, 0) }) }) : null);
    const list = h('ol', { className: 'sf-pieces' }, here.map((k) => h('li', {},
      h('span', { className: 'sf-num', textContent: k.n, 'aria-hidden': 'true' }),
      h('span', { className: 'sf-piece' },
        h('span', { textContent: `${count(k) > 1 ? `${count(k)} × ` : ''}${k.label}` }),
        h('small', { textContent: `${k.f.name} · ${num(k.w, 0)} × ${num(k.d, 0)} mm · ≈ ${fmtG(grams(k.vol) * count(k))}` })))));
    let queued = false;
    const ro = new ResizeObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; if (canvas.isConnected) drawPlate(canvas, p); });
    });
    ro.observe(canvas);
    observers.push(ro);
    return h('figure', { className: 'sf-plate' + (p.big ? ' big' : '') }, canvas, cap, list);
  });

  const bomLink = h('button', { type: 'button', className: 'link sf-inline', textContent: t('fin_bomLink'),
    onclick: () => {
      close();
      const card = $('#bom')?.closest('.card');
      if (!card) return;
      card.scrollIntoView({ block: 'start', behavior: CALM.matches ? 'auto' : 'smooth' });
      card.setAttribute('tabindex', '-1');
      card.focus({ preventScroll: true });
    } });
  const guide = h('a', { href: `https://github.com/abarriuso/bay2rack/blob/main/docs/BUILD${lang === 'es' ? '.es' : ''}.md`,
    target: '_blank', rel: 'noopener', textContent: t('how_guide') });
  const steps = h('ol', { className: 'sf-steps' },
    tests.length ? h('li', {}, t(testsOnly ? 'fin_stepTestsOnly' : 'fin_stepTests')) : null,
    h('li', {}, t(testsOnly ? 'fin_stepThenKit' : 'fin_stepAdjust')),
    h('li', {}, t('fin_stepBuy'), ' ', bomLink),
    h('li', {}, t('fin_stepGuide'), ' ', guide));
  return [
    stats, approx,
    big ? h('p', { className: 'hint warn', textContent: t('fin_bigNote') }) : null,
    h('div', { className: 'sf-plates' }, figures),
    h('section', { className: 'sf-next', 'aria-labelledby': 'sfNextTitle' },
      h('h3', { id: 'sfNextTitle', textContent: t('fin_next') }), steps),
  ];
}
