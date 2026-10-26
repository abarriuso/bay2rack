// The landing page: the hero film, the ready-made builds and the bay table.
import { EXAMPLES } from './examples.js';
import { t, lang } from './i18n.js';
import { BASE, GALLERY, USES, $, h, S } from './state.js';
import { calc, usedMods } from './model.js';
import { applyExample } from './steps.js';

// ---------------------------------------------------------------- hero + gallery
// the hero film: its still is what you see first; the film loads after the page (960 px on phones, 1.1 MB instead
// of 3.4), plays while on screen, and stays a still for reduced motion or data saving
export function wireHeroVideo() {
  const video = $('#heroVideo');
  const label = () => video.setAttribute('aria-label', t('hero_video_label'));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;
  const start = () => {
    if (matchMedia('(max-width: 900px)').matches)
      for (const s of video.querySelectorAll('source')) s.src = s.src.replace(/hero\.(webm|mp4)$/, 'hero-960.$1');
    video.preload = 'auto';
    video.autoplay = true;                              // (a play() right after load() can be dropped)
    video.load();
    new IntersectionObserver(([e]) => { if (e.isIntersecting) video.play().catch(() => {}); else video.pause(); })
      .observe(video);
  };
  if (!still) {
    if (document.readyState === 'complete') setTimeout(start, 300);
    else addEventListener('load', () => setTimeout(start, 300), { once: true });
  }
  label();
  return label;
}

// one line of facts for a build: bays, rack units and what fills the strip
export function buildSpec(k) {
  const v = { ...S.defaults, ...EXAMPLES[k] };
  const c = calc(v);
  const mods = usedMods(v, c.units).filter((m) => m !== 'blank');
  return [
    t('spec_bays', { n: v.bays }),
    c.units > 0 ? t('spec_units', { n: c.units }) : t('opt_panel'),
    ...c.zones.map((z) => t('fill_' + z)),
    mods.length ? t('spec_mods', { n: mods.length }) : null,
  ].filter(Boolean).join(' · ');
}

// the gallery is one row that scrolls sideways: the arrows move it by a card
export const galleryStep = (dir) => {
  const g = $('#galleryGrid');
  g.scrollBy({ left: dir * (g.firstElementChild?.offsetWidth ?? 300), behavior: 'smooth' });
};
// the arrows move the row by a card; the mouse drags it like a swipe (touch already swipes): it follows the pointer,
// then settles on a card, and a drag is not a click on the card under it
export function wireGallery() {
  $('#galPrev').onclick = () => galleryStep(-1);
  $('#galNext').onclick = () => galleryStep(1);
  const row = $('#galleryGrid');
  let drag = null;
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: row.scrollLeft, moved: false };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; row.classList.add('dragging'); }
    row.scrollLeft = drag.left - dx;
  });
  addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    row.classList.remove('dragging');
    // settle on the nearest card (the snapping was off while dragging)
    const w = row.querySelector('.shot')?.getBoundingClientRect().width ?? 1;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    row.scrollTo({ left: Math.round(row.scrollLeft / (w + gap)) * (w + gap), behavior: 'smooth' });
    row.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, once: true });
  });
}

export function renderGallery() {
  $('#galleryGrid').replaceChildren(...GALLERY.map((k) => {
    const v = { ...S.defaults, ...EXAMPLES[k] };
    const units = calc(v).units;
    return h('figure', { className: 'shot' },
      h('span', { className: 'shot-img' },
        // (a 640 px copy for the card size; the big one for sharp screens)
        h('img', { src: `${BASE}img/gallery/${k}.webp`, srcset: `${BASE}img/gallery/${k}-640.webp 640w, ${BASE}img/gallery/${k}.webp 1200w`,
          sizes: '(max-width: 600px) 82vw, 420px', alt: t('ex_' + k), loading: 'lazy', decoding: 'async', width: 1200, height: 900,
          onerror: (e) => { e.target.style.visibility = 'hidden'; } }),
        h('span', { className: 'tape', textContent: units > 0 ? `${units}U` : t('opt_panel') })),
      h('figcaption', {},
        h('span', { className: 'spec', textContent: buildSpec(k) }),
        h('h3', { textContent: USES[k] ? t(`use_${USES[k]}_t`) : t('ex_' + k) }),
        h('p', { textContent: USES[k] ? t('use_' + USES[k]) : t('ex_' + k + '_tip') }),
        USES[k] ? h('p', { className: 'needs', textContent: t(`use_${USES[k]}_needs`) }) : null,
        h('button', { type: 'button', className: 'load', 'aria-label': `${t('gallery_load')}: ${t('ex_' + k)}`,
          onclick: () => { applyExample(k); $('#build').scrollIntoView(); } },
          t('gallery_load'), h('span', { 'aria-hidden': 'true', textContent: '→' }))));
  }));
}

// bays -> rack units, computed with the same rules as the configurator (and config.scad). The bar is to scale:
// one blue block per rack unit, grey for the strip left over, against the tallest stack (6 bays).
export function renderBayTable() {
  const mm = (x) => Number(x).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });   // columns line up
  const U = S.defaults.rack_u_h;
  const stack = (c) => c.flushUnits * U + c.flushSpare;
  const tallest = stack(calc({ ...S.defaults, bays: 6 }));
  const rows = [1, 2, 3, 4, 5, 6].map((n) => {
    const c = calc({ ...S.defaults, bays: n });
    const h0 = stack(c);
    const bar = h('span', { className: 'u-scale', style: `width:${(100 * h0 / tallest).toFixed(1)}%`, 'aria-hidden': 'true' },
      Array.from({ length: c.flushUnits }, () => h('i', { style: `flex-grow:${U}` })),
      h('i', { className: 'spare', style: `flex-grow:${c.flushSpare.toFixed(2)}` }));
    return h('tr', {},
      h('td', { textContent: String(n) }),
      h('td', { textContent: `${mm(h0)} mm` }),
      h('td', { className: 'scale' }, bar),
      h('td', { textContent: t('inside_v', { u: c.flushUnits, s: mm(c.flushSpare) }) }),
      h('td', { textContent: t('out_v', { n, s: mm(c.over) }) }));
  });
  $('#bayTable').replaceChildren(
    h('thead', {}, h('tr', {}, ['th_bays', 'th_height', 'th_scale', 'th_inside', 'th_out'].map((k) => h('th', { scope: 'col', textContent: t(k) })))),
    h('tbody', {}, rows));
}