// The landing page: the hero film, the ready-made builds and the bay table.
import { EXAMPLES } from './examples.js';
import { t } from './i18n.js';
import { BASE, GALLERY, USES, $, h, S, CALM } from './state.js';
import { calc, usedMods } from './model.js';
import { applyExample } from './steps.js';

// ---------------------------------------------------------------- gallery
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
  g.scrollBy({ left: dir * (g.firstElementChild?.offsetWidth ?? 300), behavior: CALM.matches ? 'auto' : 'smooth' });
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
    row.scrollTo({ left: Math.round(row.scrollLeft / (w + gap)) * (w + gap), behavior: CALM.matches ? 'auto' : 'smooth' });
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
          sizes: '(max-width: 600px) 82vw, 420px', alt: '', loading: 'lazy', decoding: 'async', width: 1200, height: 900,
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

