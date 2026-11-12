// Sharing a build: its link (copied at once, as before), and a picture card of it (1200 x 630, drawn in the page from
// the 3D view) to send with the system's share sheet or to save. Also the dialog both this and the kit's finish screen
// use: modal, focus kept inside, Esc or the close button, the focus back where it was.
import './css/share-finish.css';
import { t, lang } from './i18n.js';
import { BASE, SITE, $, h, S, CALM } from './state.js';
import { EXAMPLES } from './examples.js';
import { hashString, shortHash } from './hash.js';
import { calc } from './model.js';
import { kitList } from './kit.js';
import { viewer, setStatus } from './engine.js';

// ---------------------------------------------------------------- dialog
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
let open = null;
// content: nodes for the inside; returns { el, close }. Only one at a time (a new one replaces the old).
export function modal({ label, className = '', content, onClose }) {
  open?.close();
  const back = document.activeElement;
  const body = h('div', { className: 'sf-body' }, content);
  const el = h('dialog', { className: `sf-dialog ${className}`, 'aria-labelledby': label }, body);
  const root = document.documentElement.classList;
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    if (el.open) el.close();
    el.remove();
    root.remove('sf-lock');
    if (open?.el === el) open = null;
    onClose?.();
    // the focus goes back to what opened it (if it is still on the page)
    if (back?.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
  };
  el.addEventListener('close', close);
  el.addEventListener('cancel', (e) => { e.preventDefault(); close(); });         // Esc
  // a tap on the dim backdrop closes it (the body fills the dialog, so only the backdrop is the dialog itself)
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  // Tab and Shift+Tab go round inside (showModal keeps the page inert; this keeps it off the browser's bar too)
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.body.append(el);
  root.add('sf-lock');
  if (CALM.matches) el.classList.add('calm');
  if (typeof el.showModal === 'function') el.showModal(); else el.setAttribute('open', '');
  // the first thing to press (the one marked autofocus), else the dialog's heading
  const first = el.querySelector('[autofocus]') ?? el.querySelector('h2');
  if (first) {
    if (!first.matches(FOCUSABLE)) first.setAttribute('tabindex', '-1');
    first.focus({ preventScroll: true });
  }
  open = { el, close };
  return open;
}
export const closeButton = (close) => h('button', { type: 'button', className: 'icon-btn sf-close', 'aria-label': t('sf_close'), onclick: close },
  h('span', { 'aria-hidden': 'true', textContent: '×' }));

// ---------------------------------------------------------------- the link
// a ready-made build has its own page (its picture in link previews, in the page's language); anything else, the short link
export function shareUrl() {
  const ex = Object.keys(EXAMPLES).find((k) => hashString({ ...S.defaults, ...EXAMPLES[k] }) === hashString());
  return ex ? `${BASE}${lang === 'es' ? 'es/' : ''}m/${ex}/` : location.href.split('#')[0] + shortHash();
}

// ---------------------------------------------------------------- the 3D picture
// The view drawn once more, at the card's size and framed for it (the camera's direction kept), read back at once
// (the canvas keeps no copy of its frames, so it is read in the same task as the render). The outlines of the steps
// are left out. Everything is put back as it was; the next frame draws the page's view again.
function snapshot(w, hgt) {
  const v = viewer;
  if (!v?.model || !v.whole) return null;
  const r = v.renderer, cam = v.camera, ctl = v.controls;
  const pr = r.getPixelRatio();
  const saved = { pos: cam.position.clone(), target: ctl.target.clone(), near: cam.near, far: cam.far };
  const marks = [...v.marks].map((m) => [m, m.visible]);
  try {
    for (const [m] of marks) m.visible = false;
    r.setPixelRatio(1);
    v.composer.setPixelRatio?.(1);
    r.setSize(w, hgt, false);
    v.composer.setSize(w, hgt);
    cam.aspect = w / hgt;
    const box = v.focus ?? v.whole;
    const center = box.getCenter(cam.position.clone());
    const radius = box.getSize(cam.position.clone()).length() / 2;
    const vHalf = (cam.fov / 2) * Math.PI / 180;
    const half = Math.min(vHalf, Math.atan(Math.tan(vHalf) * cam.aspect));
    const dist = radius / Math.sin(half) * 0.82;
    const dir = saved.pos.clone().sub(saved.target).normalize();
    cam.position.copy(center).addScaledVector(dir, dist);
    cam.near = dist / 100;
    cam.far = dist * 30;
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    v.composer.render();
    const c = h('canvas', { width: w, height: hgt });
    c.getContext('2d').drawImage(r.domElement, 0, 0);
    return c;
  } catch (e) {
    console.warn(e);
    return null;
  } finally {
    r.setPixelRatio(pr);
    v.composer.setPixelRatio?.(pr);
    cam.position.copy(saved.pos);
    cam.near = saved.near;
    cam.far = saved.far;
    cam.lookAt(saved.target);
    for (const [m, vis] of marks) m.visible = vis;
    v.resize();                       // (the page's size and aspect again, and a new frame)
  }
}

// ---------------------------------------------------------------- the card
export function buildFacts(v = S.values) {
  const c = calc(v);
  const pieces = kitList(v, false).reduce((n, f) => n + f.qty, 0);
  const shown = $('#caseName')?.textContent.trim();
  const caseName = shown || (v.case_model && v.case_model !== 'auto' && t('case_m_' + v.case_model) !== 'case_m_' + v.case_model
    ? t('case_m_' + v.case_model) : '');
  return { bays: v.bays, units: c.units, pieces, caseName };
}

const CARD_W = 1200, CARD_H = 630, IMG_W = 700;
async function drawCard(shot, facts) {
  // the site's fonts, loaded before they are drawn (the page may not have used every weight yet)
  await Promise.race([
    Promise.all(['800 72px "Archivo Variable"', '600 26px "Archivo Variable"', '500 13px "Martian Mono Variable"']
      .map((f) => document.fonts?.load(f))),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => {});
  const css = getComputedStyle(document.documentElement);
  const col = (n, fb) => css.getPropertyValue(n).trim() || fb;
  const ground = col('--ground', '#fff'), ink = col('--ink', '#0a0a0a'), ink3 = col('--ink-3', '#6b6b6b');
  const rule = col('--rule', '#dcdcdc'), plate = col('--plate', '#f6f6f6'), signal = col('--signal', '#d81f12');
  const c = h('canvas', { width: CARD_W, height: CARD_H });
  const g = c.getContext('2d');
  const font = (spec, wide = false, spacing = '0px') => {
    g.font = spec;
    if ('fontStretch' in g) g.fontStretch = wide ? 'expanded' : 'normal';
    if ('letterSpacing' in g) g.letterSpacing = spacing;
  };
  g.fillStyle = ground;
  g.fillRect(0, 0, CARD_W, CARD_H);
  // the picture: the 3D view, cut to fill its side
  if (shot) {
    const s = Math.max(IMG_W / shot.width, CARD_H / shot.height);
    const sw = IMG_W / s, sh = CARD_H / s;
    g.imageSmoothingQuality = 'high';
    g.drawImage(shot, (shot.width - sw) / 2, (shot.height - sh) / 2, sw, sh, 0, 0, IMG_W, CARD_H);
  } else {
    g.fillStyle = plate;
    g.fillRect(0, 0, IMG_W, CARD_H);
    g.strokeStyle = rule;
    g.lineWidth = 1;
    for (let x = 50; x < IMG_W; x += 50) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, CARD_H); g.stroke(); }
    for (let y = 40; y < CARD_H; y += 50) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(IMG_W, y + 0.5); g.stroke(); }
  }
  g.fillStyle = ink;
  g.fillRect(IMG_W, 0, 1, CARD_H);
  // the column: the name, the facts, the address
  const X = IMG_W + 48, CW = CARD_W - X - 48;
  const fit = (text, max) => {
    let s = text;
    while (s.length > 1 && g.measureText(s).width > max) s = s.slice(0, -2) + '…';
    return s;
  };
  g.textBaseline = 'alphabetic';
  g.fillStyle = ink3;
  font('500 13px "Martian Mono Variable", ui-monospace, monospace', false, '1.3px');
  g.fillText(fit(t('card_kicker').toUpperCase(), CW), X, 76);
  // the wordmark, as large as fits
  g.fillStyle = ink;
  let size = 76;
  font(`800 ${size}px "Archivo Variable", "Arial Narrow", sans-serif`, true, '-1px');
  const wordW = g.measureText('BAY2RACK').width;
  if (wordW > CW) { size = Math.floor(size * CW / wordW); font(`800 ${size}px "Archivo Variable", "Arial Narrow", sans-serif`, true, '-1px'); }
  g.fillText('BAY2RACK', X - 2, 76 + 22 + size * 0.8);
  const markY = 76 + 22 + size * 0.8 + 22;
  g.fillStyle = signal;
  g.fillRect(X, markY, 56, 4);
  // three numbers
  const statY = markY + 54;
  g.fillStyle = rule;
  g.fillRect(X, statY, CW, 1);
  const stats = [
    [String(facts.bays), t('card_bays')],
    [facts.units > 0 ? `${facts.units}U` : '—', t('card_units')],
    [String(facts.pieces), t('card_pieces')],
  ];
  const colW = CW / stats.length;
  stats.forEach(([n, label], i) => {
    const x = X + i * colW;
    if (i) { g.fillStyle = rule; g.fillRect(x - 12, statY + 18, 1, 112); }
    g.fillStyle = ink;
    // as large as fits its column (a number is never cut)
    let px = 72;
    font(`800 ${px}px "Archivo Variable", "Arial Narrow", sans-serif`, true, '-1px');
    const nw = g.measureText(n).width;
    if (nw > colW - 20) { px = Math.max(28, Math.floor(px * (colW - 20) / nw)); font(`800 ${px}px "Archivo Variable", "Arial Narrow", sans-serif`, true, '-1px'); }
    g.fillText(n, x, statY + 92);
    g.fillStyle = ink3;
    font('500 11.5px "Martian Mono Variable", ui-monospace, monospace', false, '1px');
    const words = label.toUpperCase().split(' ');
    // two short lines at most
    const lines = [];
    for (const w of words) {
      const last = lines[lines.length - 1];
      if (last && g.measureText(`${last} ${w}`).width <= colW - 22) lines[lines.length - 1] = `${last} ${w}`;
      else lines.push(w);
    }
    lines.slice(0, 2).forEach((l, j) => g.fillText(fit(l, colW - 18), x, statY + 118 + j * 17));
  });
  // the case
  const caseY = statY + 172;
  g.fillStyle = rule;
  g.fillRect(X, caseY, CW, 1);
  if (facts.caseName) {
    g.fillStyle = ink3;
    font('500 11.5px "Martian Mono Variable", ui-monospace, monospace', false, '1px');
    g.fillText(t('card_case').toUpperCase(), X, caseY + 34);
    g.fillStyle = ink;
    font('650 28px "Archivo Variable", sans-serif', true, '0px');
    g.fillText(fit(facts.caseName, CW), X, caseY + 72);
  }
  // the address, at the foot
  g.fillStyle = signal;
  g.fillRect(X, CARD_H - 62, 10, 10);
  g.fillStyle = ink;
  font('500 15px "Martian Mono Variable", ui-monospace, monospace', false, '0.5px');
  g.fillText(new URL(SITE).host, X + 22, CARD_H - 52);
  return c;
}

const toBlob = (c) => new Promise((resolve) => c.toBlob(resolve, 'image/png'));

// the card for the build on screen: its PNG (null when the browser cannot make one)
export async function shareCard() {
  const scale = matchMedia('(max-width: 900px)').matches ? 1.5 : 2;    // drawn larger, then down: smooth edges
  const shot = snapshot(Math.round(IMG_W * scale), Math.round(CARD_H * scale));
  const card = await drawCard(shot, buildFacts());
  return toBlob(card);
}

// ---------------------------------------------------------------- the share button
export async function share() {
  const url = shareUrl();
  // the link goes to the clipboard at once (still inside the click: Safari asks for that)
  let copied = false;
  try { await navigator.clipboard.writeText(url); copied = true; setStatus(t('copied'), 'ok', true); } catch { /* the field below has it */ }
  openShare(url, copied);
}

function openShare(url, copied) {
  const v = S.values;
  const name = `bay2rack-${v.bays}bay.png`;
  let blobUrl = null;
  let file = null;
  const note = h('p', { className: 'sf-note', role: 'status', textContent: copied ? t('copied') : '' });
  const field = h('input', { className: 'sf-url', type: 'text', readOnly: true, value: url, id: 'sfUrl', spellcheck: false,
    onfocus: (e) => e.target.select() });
  const copy = h('button', { type: 'button', className: 'pill', textContent: t('sf_copy'),
    onclick: async () => {
      try { await navigator.clipboard.writeText(url); note.textContent = t('copied'); }
      catch { field.focus(); field.select(); note.textContent = t('sf_copyManual'); }
    } });
  const img = h('img', { className: 'sf-img', alt: '', width: CARD_W, height: CARD_H, hidden: true });
  const frame = h('div', { className: 'sf-frame', 'aria-busy': 'true' }, img,
    h('span', { className: 'sf-wait', textContent: t('sf_making') }));
  const sendBtn = h('button', { type: 'button', className: 'primary', textContent: t('sf_send'), hidden: true, disabled: true,
    onclick: async () => {
      try { await navigator.share({ files: [file], title: t('sf_shareTitle'), text: `${t('sf_shareText')} ${url}`, url }); }
      catch (e) { if (e?.name !== 'AbortError') note.textContent = t('sf_shareFailed'); }
    } });
  const save = h('a', { className: 'btn ghost sf-save', download: name, textContent: t('sf_save'), 'aria-disabled': 'true' });
  // (until the picture is ready the link goes nowhere)
  save.addEventListener('click', (e) => { if (!blobUrl) e.preventDefault(); });
  const { close } = modal({
    label: 'sfShareTitle', className: 'sf-share',
    onClose: () => { if (blobUrl) URL.revokeObjectURL(blobUrl); },
    content: [
      h('header', { className: 'sf-head' },
        h('p', { className: 'sf-kicker', textContent: t('sf_shareKicker') }),
        h('h2', { id: 'sfShareTitle', textContent: t('sf_shareHead') }),
        closeButton(() => close())),
      frame,
      h('div', { className: 'sf-link' },
        h('label', { className: 'sr-only', htmlFor: 'sfUrl', textContent: t('sf_link') }), field, copy),
      note,
      h('div', { className: 'sf-actions' }, sendBtn, save),
    ],
  });
  // the picture: made after the dialog is up (the click stays quick)
  setTimeout(async () => {
    let blob = null;
    try { blob = await shareCard(); } catch (e) { console.warn(e); }
    if (!frame.isConnected) return;
    frame.removeAttribute('aria-busy');
    frame.querySelector('.sf-wait')?.remove();
    if (!blob) { frame.append(h('span', { className: 'sf-wait', textContent: t('sf_noCard') })); save.hidden = true; return; }
    blobUrl = URL.createObjectURL(blob);
    img.src = blobUrl;
    const facts = buildFacts();
    img.alt = t('sf_cardAlt', { ...facts, units: facts.units || '—' });
    img.hidden = false;
    save.href = blobUrl;
    save.removeAttribute('aria-disabled');
    // the system's share sheet, with the picture, where the browser can share files (phones, mostly)
    try {
      file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { sendBtn.hidden = false; sendBtn.disabled = false; }
    } catch { /* no File constructor: the download is there */ }
  }, 16);
}
