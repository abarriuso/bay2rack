// bay2rack web generator: wiring the page and starting it.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/martian-mono/standard.css';
import './style.css';
import { parseCustomizer } from './customizer.js';
import { t, lang, setLang, applyI18n } from './i18n.js';
import { initTooltips } from './tooltip.js';
import { ICONS } from './icons.js';
import { EXAMPLES } from './examples.js';
import { renderLegend } from './legend.js';
import { BASE, filamentHexes, $, NARROW, h, svgEl, S } from './state.js';
import { calc, usedMods } from './model.js';
import { viewer, startEngine, runJob, definesFor, setStatus } from './engine.js';
import { past, snapshot, undo, redo, refresh } from './edit.js';
import { applyExample } from './steps.js';
import { buildAdvanced } from './tabs.js';
import { hashString, shortHash, readHash } from './hash.js';
import { schedule, render, showEchoes } from './render.js';
import { downloadKit } from './kit.js';
import { wireHeroVideo, wireGallery, renderGallery, renderBayTable } from './gallery.js';

// ---------------------------------------------------------------- chrome
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  viewer?.setTheme(th);
  $('#theme').replaceChildren(svgEl(th === 'dark' ? ICONS.sun : ICONS.moon));
  // the browser's own bars (Safari on iPhone) take the colour of the page
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || meta.content;
  try { localStorage.setItem('theme', th); } catch { /* private mode */ }
}

function wire() {
  initTooltips($('#tip'));
  for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] ?? '';
  let th = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try { th = localStorage.getItem('theme') || th; } catch { /* private mode */ }
  applyTheme(th);
  $('#theme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#lang').onclick = () => {
    setLang(lang === 'es' ? 'en' : 'es');
    $('#lang').textContent = lang === 'es' ? 'EN' : 'ES';
    if (adv.checked) buildAdvanced(); else $('#form').replaceChildren();
    refresh();
    renderGallery();
    renderBayTable();
    heroRelabel?.();
    if (S.lastEcho) showEchoes(...S.lastEcho);
    renderLegend($('#legend'), S.lastScene ?? null);
  };
  const adv = $('#advanced');
  try { adv.checked = localStorage.getItem('advanced') === '1'; } catch { /* private mode */ }
  const showAdv = () => {
    if (adv.checked && !$('#form').childElementCount) buildAdvanced();
    $('#form').hidden = !adv.checked;
    try { localStorage.setItem('advanced', adv.checked ? '1' : '0'); } catch { /* private mode */ }
  };
  adv.onchange = showAdv;
  showAdv();
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    const id = a?.getAttribute('href').slice(1);
    if (!id || /=/.test(id) || !document.getElementById(id)) return;
    e.preventDefault();
    const el = document.getElementById(id);
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (el.tagName === 'DETAILS') el.open = true;
  });
  $('#fit').onclick = () => viewer?.fit();
  $('#warnBadge').onclick = () => $('#warningsCard').scrollIntoView({ block: 'center' });
  // narrow screens: the downloads go at the end of the steps, which scroll on their own under the 3D view
  const narrow = matchMedia(NARROW);
  const placeResults = () => (narrow.matches ? $('.panel').append($('.results')) : $('.workbench').after($('.results')));
  narrow.addEventListener('change', placeResults);
  placeResults();
  // narrow screens: the header hides while scrolling down and over the full-screen configurator
  let lastY = scrollY;
  const head = () => {
    const y = scrollY;
    const r = $('.workbench').getBoundingClientRect();
    const inApp = r.top <= 1 && r.bottom >= innerHeight - 1;
    const root = document.documentElement.classList;
    if (!narrow.matches || y < 80) root.remove('head-off');
    else if (inApp || y > lastY + 6) root.add('head-off');
    else if (y < lastY - 6) root.remove('head-off');
    if (Math.abs(y - lastY) > 6) lastY = y;
  };
  addEventListener('scroll', head, { passive: true });
  narrow.addEventListener('change', head);
  $('#download').onclick = () => S.result && h('a', { href: S.result.url, download: S.result.name }).click();
  $('#kit').onclick = () => downloadKit();
  $('#kitBar').onclick = () => downloadKit();
  $('#kitTests').onclick = () => downloadKit(true);
  $('#share').onclick = async () => {
    const ex = Object.keys(EXAMPLES).find((k) => hashString({ ...S.defaults, ...EXAMPLES[k] }) === hashString());
    const url = ex ? `${BASE}m/${ex}/` : location.href.split('#')[0] + shortHash();
    try { await navigator.clipboard.writeText(url); setStatus(t('copied'), 'ok'); } catch { prompt('URL', url); }
  };
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'Enter') render();
    // undo / redo, except while typing in a field (the field's own undo)
    else if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName) && document.activeElement.type !== 'checkbox') return;
    else if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  });
  $('#undo').onclick = undo;
  $('#redo').onclick = redo;
  // a shared link opened in the same tab only changes the hash: load its settings
  addEventListener('hashchange', () => {
    if (location.hash === hashString()) return;
    if (!/=/.test(location.hash)) return;                       // plain section anchors (#build, #gallery…)
    past.push(snapshot());
    startEngine();
    S.values = { ...S.defaults };
    readHash();
    refresh();
    schedule(0);
  });
}

let heroRelabel = null;

async function boot() {
  // dev only: the state for the console, and saving a build as GLB for the Blender video (docs/blender/)
  if (import.meta.env.DEV) {
    window.__b2r = {
      S, EXAMPLES, applyExample, get viewer() { return viewer; },
      exportBuild: async (name, patch, opts = {}) => {
        const { exportBuild } = await import('./export-glb.js');
        const values = { ...S.defaults, ...patch };
        return exportBuild({ name, values, mods: usedMods(values, calc(values).units), runJob, definesFor,
          filament: filamentHexes(), ...opts });
      },
    };
  }
  document.documentElement.lang = lang;
  $('#lang').textContent = lang === 'es' ? 'EN' : 'ES';
  applyI18n();
  const [src, presets, catalog] = await Promise.all([
    fetch(BASE + 'scad/bay2rack.scad').then((r) => r.text()),
    fetch(BASE + 'scad/bay2rack.json').then((r) => r.json()),
    fetch(BASE + 'stl/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  S.sections = parseCustomizer(src);
  for (const s of S.sections) for (const p of s.params) { S.params[p.name] = p; S.defaults[p.name] = p.value; }
  S.presets = presets.parameterSets;
  S.catalog = catalog;
  S.values = { ...S.defaults };
  readHash();
  if (!/=/.test(location.hash)) $('#examples').open = true;
  wire();
  refresh();
  renderGallery();
  wireGallery();
  renderBayTable();
  heroRelabel = wireHeroVideo();
  // installable, and offline after the first visit (the service worker is only in the built site)
  if ('serviceWorker' in navigator && !import.meta.env.DEV)
    addEventListener('load', () => navigator.serviceWorker.register(BASE + 'sw.js').catch(() => {}), { once: true });
  S.wantRender = true;
  // the engine and the 3D view: with settings in the link at once, otherwise when the configurator is near
  if (/=/.test(location.hash)) startEngine();
  else {
    const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { near.disconnect(); startEngine(); } },
      { rootMargin: '1200px 0px' });
    near.observe($('#build'));
  }
}

boot();