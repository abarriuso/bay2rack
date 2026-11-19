// The configurator: the model's parameters, the steps, the renders, the downloads, the gallery. A chunk of its own
// (main.js imports it as the page starts): the film and the page above it need none of it, and start without it.
import { parseCustomizer } from './customizer.js';
import { t, lang, setLang } from './i18n.js';
import { EXAMPLES } from './examples.js';
import { renderLegend } from './legend.js';
import { $, h, S, CALM, filamentHexes } from './state.js';
import { calc, usedMods } from './model.js';
import { viewer, startEngine, runJob, definesFor, setStatus, sumOf, onRender } from './engine.js';
import { undo, redo, refresh, loadLink } from './edit.js';
import { applyExample, loadSaved } from './steps.js';
import { buildAdvanced } from './tabs.js';
import { hashString, readHash } from './hash.js';
import { render, showEchoes, relabel } from './render.js';
import { downloadKit } from './kit.js';
import { share } from './share.js';
import { wireGallery, renderGallery } from './gallery.js';
import { langSwap, widen } from './motion.js';

onRender(render);                                        // (the engine's first build, once ready: engine.js)

// the keys and fields that act on the build (langKey, langPath: the language key and the address, main.js)
function wire({ langKey, langPath }) {
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

// files: the model, its presets and the catalog of ready-made STLs (asked for by main.js as the page starts);
// pageIsReady: the page is all there (what the film restores of a reload waits for it)
export async function startConfigurator({ files, pageIsReady, langKey, langPath }) {
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
  let src, presets, catalog;
  try {
    [src, presets, catalog] = await files;
  } catch (e) {
    // (no model, no configurator: the rest of the page still works, and says so where the build would be)
    console.warn(e);
    setStatus(t('modelError', { e: e.message }), 'error');
    pageIsReady();
    return;
  }
  S.scadSum = sumOf(src);                                // (the build made ahead is only for this model: engine.js)
  S.sections = parseCustomizer(src);
  for (const s of S.sections) for (const p of s.params) { S.params[p.name] = p; S.defaults[p.name] = p.value; }
  S.presets = presets.parameterSets;
  S.catalog = catalog;
  S.values = { ...S.defaults };
  readHash();
  // the ready-made builds are in the gallery right above the configurator: here they wait folded, one line; open
  // when there are builds of your own to go back to
  if (loadSaved().length) $('#examples').open = true;
  wire({ langKey, langPath });
  refresh();
  renderGallery();
  wireGallery();
  pageIsReady();
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
  S.wantRender = true;
  // (the film may have started the 3D view before the model was here: its first build now)
  if (viewer) render();
  // the engine and the 3D view: with settings in the link at once, otherwise when the configurator is near
  if (/=/.test(location.hash)) startEngine();
  else {
    // (not while the film plays above it: it starts them itself, after its pictures - film.js)
    const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && !S.filmLoads) { near.disconnect(); startEngine(); } },
      { rootMargin: '1200px 0px' });
    near.observe($('#build'));
  }
}
