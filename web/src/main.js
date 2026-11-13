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
import { BASE, filamentHexes, $, NARROW, h, svgEl, S, CALM } from './state.js';
import { calc, usedMods } from './model.js';
import { viewer, startEngine, runJob, definesFor, setStatus } from './engine.js';
import { undo, redo, refresh, loadLink } from './edit.js';
import { applyExample, loadSaved } from './steps.js';
import { buildAdvanced } from './tabs.js';
import { hashString, shortHash, readHash } from './hash.js';
import { schedule, render, showEchoes, relabel } from './render.js';
import { downloadKit } from './kit.js';
import { share } from './share.js';
import { wireGallery, renderGallery } from './gallery.js';
import { startFilm } from './film.js';
import { soundOn, setSound, sfx } from './sound.js';
import { themeSwitch, langSwap, widen } from './motion.js';

// ---------------------------------------------------------------- chrome
// moves the keyboard focus to a section (one that takes no focus of its own takes it from the script only)
function focusOn(el) {
  if (!el.matches('a, button, input, select, textarea, summary, [tabindex]')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}
// the language key names the other language, in that language (a screen reader says "Español", not "E S")
// the address says the language (/ or /es/), so a reload or a copied link keeps it (nothing on the page is
// relative to it once loaded: the files come from BASE)
function langPath() {
  const want = new URL(lang === 'es' ? 'es/' : './', BASE).pathname;
  if (location.pathname !== want && !/\/m\//.test(location.pathname)) history.replaceState(history.state, '', want + location.search + location.hash);
}
function langKey() {
  const b = $('#lang');
  const other = lang === 'es' ? 'en' : 'es';
  b.textContent = other.toUpperCase();
  b.lang = other;
  b.setAttribute('aria-label', other === 'es' ? 'Español' : 'English');
  // (its tip in the language it takes you to, as the key itself says it)
  b.dataset.tip = other === 'es' ? 'Leer en español' : 'Read in English';
}
// the theme you chose (none: the system's, followed as it changes)
const THEMES = ['light', 'dark'];
const storedTheme = () => { try { const v = localStorage.getItem('theme'); return THEMES.includes(v) ? v : null; } catch { return null; } };
const systemDark = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(th, chosen = false) {
  document.documentElement.dataset.theme = th;
  viewer?.setTheme(th);
  $('#theme').replaceChildren(svgEl(th === 'dark' ? ICONS.sun : ICONS.moon));
  $('#theme').setAttribute('aria-pressed', String(th === 'dark'));
  // the browser's own bars (Safari on iPhone) take the colour of the page
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || meta.content;
  // (only a choice is kept: a first visit does not freeze the system's theme of that day)
  if (chosen) try { localStorage.setItem('theme', th); } catch { /* private mode */ }
}

function wire() {
  initTooltips($('#tip'));
  for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] ?? '';
  applyTheme(storedTheme() ?? (systemDark.matches ? 'dark' : 'light'));
  systemDark.addEventListener('change', (e) => { if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light'); });
  // (the new theme opens in a circle from this key: motion.js)
  $('#theme').onclick = (e) => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    themeSwitch(() => applyTheme(next, true), e.currentTarget);
  };
  $('#lang').onclick = () => {
    langSwap();                                   // (the words of the other language come in: motion.js)
    setLang(lang === 'es' ? 'en' : 'es');
    langKey();
    langPath();
    relabel();
    if (adv.checked) buildAdvanced(); else $('#form').replaceChildren();
    refresh();
    renderGallery();
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
    el.scrollIntoView({ behavior: CALM.matches ? 'auto' : 'smooth' });
    if (el.tagName === 'DETAILS') el.open = true;
    // the focus goes along (the skip link, the menu): the next Tab carries on from there, not from the top
    focusOn(el);
  });
  $('#fit').onclick = () => viewer?.fit();
  // the sounds of the build (sound.js): the key says what it will do
  const snd = $('#sound');
  const showSound = () => {
    const k = soundOn() ? 'sound_mute' : 'sound_unmute';
    snd.classList.toggle('muted', !soundOn());
    snd.dataset.i18nTip = snd.dataset.i18nAria = k;
    snd.dataset.tip = t(k);
    snd.setAttribute('aria-label', t(k));
  };
  snd.onclick = () => { setSound(!soundOn()); showSound(); setTimeout(() => sfx.snap(0, 1), 60); };
  showSound();
  $('#warnBadge').onclick = () => { const c = $('#warningsCard'); c.scrollIntoView({ block: 'center' }); focusOn(c); };
  // narrow screens: the downloads go at the end of the steps, which scroll on their own under the 3D view
  const narrow = matchMedia(NARROW);
  const placeResults = () => (narrow.matches ? $('.panel').append($('.results')) : $('.workbench').after($('.results')));
  narrow.addEventListener('change', placeResults);
  placeResults();
  // narrow screens: the header hides while scrolling down and comes back scrolling up (a scroll reads scrollY and
  // nothing else)
  let lastY = scrollY, jumped = false;
  addEventListener('b2r:jump', () => { jumped = true; });   // (the film moved the page's place, not the visitor)
  const head = () => {
    const y = scrollY;
    const root = document.documentElement.classList;
    if (jumped) { jumped = false; lastY = y; return; }
    if (!narrow.matches || y < 80) { root.remove('head-off'); lastY = y; return; }
    if (y > lastY + 6) root.add('head-off');
    else if (y < lastY - 6) root.remove('head-off');
    if (Math.abs(y - lastY) > 6) lastY = y;
  };
  addEventListener('scroll', head, { passive: true });
  // in the configurator it is the steps that scroll, not the page: the header follows them, back as they go up (or
  // are at their top), away as they go on - the way out is always at hand
  const panel = $('.panel');
  let panelY = 0;
  panel?.addEventListener('scroll', () => {
    if (!narrow.matches) return;
    const y = panel.scrollTop, root = document.documentElement.classList;
    if (y < 8 || y < panelY - 6) root.remove('head-off');
    else if (y > panelY + 6) root.add('head-off');
    if (Math.abs(y - panelY) > 6 || y < 8) panelY = y;
  }, { passive: true });
  narrow.addEventListener('change', head);
  // A phone's configurator is one screen, and holds it: come to rest squarely on it and the page stops scrolling (the
  // steps scroll inside it, a finger on the 3D view turns the build). Out of it by its key at the corner of the view -
  // or a link of the page, which takes the page elsewhere. (A scroll reads nothing while it is not held.)
  const wb = $('.workbench'), doc = document.documentElement.classList;
  let holdT = 0;
  const hold = () => {
    clearTimeout(holdT);
    if (doc.contains('locked')) {
      if (!narrow.matches || Math.abs(wb.getBoundingClientRect().top) > 2) doc.remove('locked');
      return;
    }
    if (narrow.matches) holdT = setTimeout(() => { if (narrow.matches && Math.abs(wb.getBoundingClientRect().top) <= 2) doc.add('locked'); }, 250);
  };
  addEventListener('scroll', hold, { passive: true });
  narrow.addEventListener('change', hold);
  // the view on the whole screen (and the browser's own bars away, where it lets a page do that: not on an iPhone)
  const fullKey = $('#viewFull');
  const setFull = (on) => {
    if (doc.contains('view-full') === on) return;
    doc.toggle('view-full', on);
    fullKey.replaceChildren(svgEl(on ? ICONS.fullOff : ICONS.full));
    const k = on ? 'view_full_off' : 'view_full';
    fullKey.dataset.i18nTip = fullKey.dataset.i18nAria = k;
    fullKey.dataset.tip = t(k);
    fullKey.setAttribute('aria-label', t(k));
    fullKey.setAttribute('aria-pressed', String(on));
    // (the build framed again for the view's new shape, once it has it)
    requestAnimationFrame(() => requestAnimationFrame(() => viewer?.fit()));
    try {
      if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch?.(() => {});
      else if (!on && document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
    } catch { /* (not here) */ }
  };
  fullKey.onclick = () => setFull(!doc.contains('view-full'));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) setFull(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setFull(false); });
  narrow.addEventListener('change', () => { if (!narrow.matches) setFull(false); });
  // back up: the film takes the page there its own way (film.js); without it, the top of the page
  $('#viewUp').onclick = () => {
    setFull(false);
    doc.remove('locked');
    if (dispatchEvent(new CustomEvent('b2r:up', { cancelable: true }))) $('#top').scrollIntoView({ behavior: CALM.matches ? 'auto' : 'smooth' });
  };
  $('#download').onclick = () => S.result && h('a', { href: S.result.url, download: S.result.name }).click();
  $('#kit').onclick = () => downloadKit();
  $('#kitBar').onclick = () => downloadKit();
  $('#withTests')?.addEventListener('change', () => refresh());
  $('#kitTests').onclick = () => downloadKit(true);
  // the link (copied at once) and a picture card of the build, in a dialog (share.js)
  $('#share').onclick = () => share();
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
    loadLink(location.hash);
  });
}


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
  langKey();
  langPath();
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
  // the ready-made builds are in the gallery right above the configurator: here they wait folded, one line; open
  // when there are builds of your own to go back to
  if (loadSaved().length) $('#examples').open = true;
  wire();
  refresh();
  renderGallery();
  wireGallery();
  startFilm();
  // the titles (and the name in the foot) come up as they scroll into view, their headings opening wide (motion.js)
  if (!CALM.matches && 'IntersectionObserver' in window) {
    const waiting = new WeakSet();
    const seen = new IntersectionObserver((es) => es.forEach((e) => {
      const el = e.target;
      // the first look: one already on screen (a link to #gallery, a reload further down) stays as it is - hiding it
      // now would make it blink; the others wait for their turn, hidden (off screen: nobody sees them go)
      if (!waiting.has(el)) {
        const r = e.boundingClientRect;                   // (the observer's own numbers: no layout read)
        if (r.top < innerHeight && r.bottom > 0) seen.unobserve(el);
        else { waiting.add(el); el.classList.add('reveal'); }
        return;
      }
      if (!e.isIntersecting) return;
      el.classList.add('in');
      seen.unobserve(el);
      widen(el.matches('.foot-mark') ? el : el.querySelector('h2'));
    }), { rootMargin: '0px 0px -8% 0px' });
    for (const el of document.querySelectorAll('.section-head, .foot-mark')) seen.observe(el);
  }
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