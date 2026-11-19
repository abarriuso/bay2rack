// bay2rack web generator: wiring the page and starting it - the page and its film here, the configurator in a chunk of
// its own that comes alongside (configurator.js: the film starts without waiting for it)
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/martian-mono/standard.css';
import './style.css';
import { t, lang, applyI18n } from './i18n.js';
import { initTooltips } from './tooltip.js';
import { ICONS } from './icons.js';
import { BASE, $, NARROW, svgEl, CALM } from './state.js';
import { viewer } from './engine.js';
import { startFilm } from './film.js';
import { soundOn, setSound, sfx, breeze } from './sound.js';
import { themeSwitch } from './motion.js';
import { bars } from './bars.js';

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
  // the phone's own bars take the colour of what is under them, in this theme (bars.js)
  bars();
  // (only a choice is kept: a first visit does not freeze the system's theme of that day)
  if (chosen) try { localStorage.setItem('theme', th); } catch { /* private mode */ }
}

// what needs nothing of the model: the tips, the icons and the theme key (on at once, before the configurator's files)
function chrome() {
  initTooltips($('#tip'));
  for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] ?? '';
  applyTheme(storedTheme() ?? (systemDark.matches ? 'dark' : 'light'));
  systemDark.addEventListener('change', (e) => { if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light'); });
  // (the new theme opens in a circle from this key: motion.js)
  $('#theme').onclick = (e) => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    themeSwitch(() => applyTheme(next, true), e.currentTarget);
  };
}

// the page's keys and its scrolling: nothing of the model (the configurator's own keys: configurator.js)
function wire() {
  let goT = [], goStop = () => {};
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    const id = a?.getAttribute('href').slice(1);
    if (!id || /=/.test(id) || !document.getElementById(id)) return;
    e.preventDefault();
    const el = document.getElementById(id);
    const go = () => {
      dispatchEvent(new Event('b2r:goto'));                // (the film lets this scroll through: film.js)
      el.scrollIntoView({ behavior: CALM.matches ? 'auto' : 'smooth' });
    };
    go();
    // The page above the place may change its length while the scroll is on its way (the first build's lists come in
    // under the configurator, the film's stretch goes): the scroll would end short of it. Looked at again a few times
    // after, and taken on to it - unless the visitor has scrolled meanwhile.
    for (const t of goT) clearTimeout(t);
    removeEventListener('wheel', goStop); removeEventListener('touchstart', goStop); removeEventListener('keydown', goStop);
    goStop = () => { for (const t of goT) clearTimeout(t); goT = []; };
    for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, goStop, { passive: true, once: true });
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    goT = [1100, 2200, 3400].map((ms) => setTimeout(() => {
      const off = el.getBoundingClientRect().top - pad;
      const room = document.documentElement.scrollHeight - innerHeight - scrollY;     // (the foot of the page: as far as it goes)
      if (Math.abs(off) > 6 && (off < 0 || room > 6)) go();
    }, ms));
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
  snd.dataset.quiet = '';
  snd.onclick = () => { setSound(!soundOn()); showSound(); setTimeout(() => sfx.snap(0, 1), 60); };
  showSound();
  addEventListener('b2r:sound', showSound);              // (the film's key turns them on or off too)
  // every key of the page answers with a soft click (a little lower for what turns something off); the keys that
  // make a sound of their own (data-quiet) and the film's links keep to theirs
  document.addEventListener('click', (e) => {
    const k = e.target.closest?.('button, [role="button"], [role="tab"], [role="radio"], [role="switch"], summary, input[type="checkbox"], input[type="radio"], a.btn');
    if (!k || k.disabled || k.closest('[data-quiet], .film')) return;
    const off = k.getAttribute('aria-pressed') === 'true' || k.getAttribute('aria-checked') === 'true' || k.matches('.on, .active') || (k.type === 'checkbox' && !k.checked);
    sfx.tap(!off);
  }, true);
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
  // (these read the page's place before the film writes its frame - capture comes first - or each read would lay
  // the page out again)
  addEventListener('scroll', head, { passive: true, capture: true });
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
    // the steps scrolled on: the 3D view gives them some of its height (back at their top, or at a touch on it)
    if (y > 100) low(true);
    else if (y < 8) low(false);
  }, { passive: true });
  const low = (on) => {
    const root = document.documentElement.classList;
    if (root.contains('view-low') === on) return;
    root.toggle('view-low', on);
    requestAnimationFrame(() => requestAnimationFrame(() => viewer?.fit()));     // (the build framed for its new shape)
  };
  $('#view')?.addEventListener('click', () => low(false));
  narrow.addEventListener('change', head);
  // the air of the scroll, all down the page and the steps: as fast as they move, softer than the film's at its end
  // (sound.js); a jump of the page's place (a link, the film's own) is no scroll
  const airOf = (get) => {
    let y0 = get(), t0 = performance.now(), calm = 0;
    return () => {
      const y = get(), now = performance.now(), dy = y - y0, dt = Math.max(8, now - t0);
      y0 = y; t0 = now;
      if (Math.abs(dy) > innerHeight * 1.5) return;
      breeze((Math.abs(dy) / innerHeight) * (1000 / dt), dy > 0);
      clearTimeout(calm);
      calm = setTimeout(() => breeze(0), 140);
    };
  };
  addEventListener('scroll', airOf(() => scrollY), { passive: true, capture: true });
  $('.panel')?.addEventListener('scroll', airOf(() => $('.panel').scrollTop), { passive: true });
  // A phone's configurator is one screen, and holds it: come to rest squarely on it and the page stops scrolling (the
  // steps scroll inside it, a finger on the 3D view turns the build). Out of it by its key at the corner of the view -
  // or a link of the page, which takes the page elsewhere. (A scroll reads nothing while it is not held.)
  const wb = $('.workbench'), doc = document.documentElement.classList;
  let holdT = 0;
  // (square: the page at rest on the configurator - its top at the screen's top, or under the header)
  const padTop = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  let square = false, turning = 0;
  const hold = () => {
    clearTimeout(holdT);
    const keep = performance.now() < turning;               // (being put back after a turn: see below)
    if (doc.contains('locked')) {
      // (turned on its side, being put back: not held meanwhile, but still on it - see below)
      if (!narrow.matches || Math.abs(wb.getBoundingClientRect().top) > 8) { doc.remove('locked'); if (!keep) square = false; }
      return;
    }
    // (square on it: within a few px - the film puts it where its stage lets go, film.js)
    holdT = setTimeout(() => {
      const top = wb.getBoundingClientRect().top;
      if (!keep) square = Math.abs(top) <= 8 || Math.abs(top - padTop()) <= 8;
      if (narrow.matches && Math.abs(top) <= 8 && !$('#film:not(.plain):not(.merged)')) doc.add('locked');
    }, 250);
  };
  addEventListener('scroll', hold, { passive: true, capture: true });
  narrow.addEventListener('change', hold);
  // A phone turned on its side and back: the page above the configurator is laid out anew, so the same scrollY is
  // another place - under it, among the builds. On it before, on it after: put back square on it once the new sizes
  // are known, and held again on a phone. (Under a film, the film puts it back - where its stage lets go: film.js.)
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return;                       // (a phone's bars folding: only the height)
    lastW = innerWidth;
    if (!square && !doc.contains('locked') && performance.now() >= turning) return;
    square = true;
    // (the page above settles over a few frames - the film's stage, the view's size: put back again as it does)
    turning = performance.now() + 1200;
    const put = () => {
      const top = wb.getBoundingClientRect().top - (narrow.matches ? 0 : padTop());
      if (Math.abs(top) > 1 && !$('#film.live:not(.plain)')) scrollTo({ top: scrollY + top, behavior: 'instant' });
      hold();
    };
    requestAnimationFrame(() => requestAnimationFrame(put));
    for (const ms of [300, 700, 1150]) setTimeout(() => { if (performance.now() < turning + 50) put(); }, ms);
  });
  // (a scroll of the visitor's own while it is put back: theirs wins)
  for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, () => { turning = 0; }, { passive: true });
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
}

function boot() {
  document.documentElement.lang = lang;
  langKey();
  langPath();
  applyI18n();
  // The configurator's files, at a low priority: the page above it - the film and its pictures - needs none of them,
  // and starts at once (it lays out what it restores of a reload once the page is all there: pageReady).
  const get = (path, as) => fetch(BASE + path, { priority: 'low' }).then((r) => {
    if (!r.ok) throw new Error(`${path}: ${r.status}`);    // (a missing file is the host's 404 page, not the model)
    return r[as]();
  });
  const files = Promise.all([
    get('scad/bay2rack.scad', 'text'),
    get('scad/bay2rack.json', 'json'),
    get('stl/index.json', 'json').catch(() => null),
  ]);
  files.catch(() => {});                                 // (said where the build would be: configurator.js)
  let pageIsReady = null;
  const pageReady = new Promise((ok) => { pageIsReady = ok; });
  chrome();
  wire();
  startFilm(pageReady);
  import('./configurator.js')
    .then(({ startConfigurator }) => startConfigurator({ files, pageIsReady, langKey, langPath }))
    .catch((e) => { console.error(e); pageIsReady(); });
  // installable, and offline after the first visit (the service worker is only in the built site)
  if ('serviceWorker' in navigator && !import.meta.env.DEV)
    addEventListener('load', () => navigator.serviceWorker.register(BASE + 'sw.js').catch(() => {}), { once: true });
}

boot();
