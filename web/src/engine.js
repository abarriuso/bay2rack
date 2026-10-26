// The OpenSCAD engine (a worker, more for the kit), the render cache and the 3D view, started on demand.
import { scadLiteral, same } from './customizer.js';
import { t } from './i18n.js';
import { BASE, UI, saveUI, filamentHexes, $, NARROW, h, S } from './state.js';
import { render } from './render.js';

// ---------------------------------------------------------------- engine
// The 3D view (three.js) and the OpenSCAD engine (11 MB of WebAssembly) start when the configurator comes near the
// screen, so the page itself opens fast; a link with settings in it starts them at once.
export let viewer = null;
export let worker = null;
export let engineStarted = null;
export function startEngine() {
  if (engineStarted) return engineStarted;
  setStatus(t('loading'), 'busy');
  worker = new Worker(new URL('./openscad-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = onEngine;
  worker.postMessage({ type: 'init', base: BASE });
  engineStarted = import('./viewer.js').then(({ Viewer }) => {
    viewer = new Viewer($('#view'));
    viewer.setTheme(document.documentElement.dataset.theme);
    viewer.setFilament(filamentHexes());
    viewer.show.cables = UI.cables;
    viewer.show.side = UI.side;
  }).catch((e) => {
    console.warn(e);
    viewer = null;
    $('#view').replaceChildren(h('p', { className: 'no-view', textContent: t('noView') }));
  });
  return engineStarted;
}
export const jobs = new Map();
export let nextJob = 1;
export function onEngine({ data: m }) {
  if (m.type === 'ready') {
    S.engine = 'ready';
    setStatus(t('ready'), 'ok');
    if (S.wantRender) render();
  } else if (m.type === 'error') {
    S.engine = 'error';
    setStatus(t('engineError', { e: m.message }), 'error');
  } else if (m.type === 'result') {
    jobs.get(m.id)?.(m);
    jobs.delete(m.id);
  }
}
export const runJob = (defines, out) => new Promise((resolve) => {
  const id = nextJob++;
  jobs.set(id, resolve);
  worker.postMessage({ type: 'run', id, defines, out });
});
// the last renders, by their settings: going back to a piece or a view you had is instant
export const done = new Map();
export async function cachedJob(run, defines, out) {
  const key = out + '\n' + defines.join('\n');
  if (done.has(key)) { const r = done.get(key); done.delete(key); done.set(key, r); return { ...r, cached: true }; }
  const res = await run(defines, out);
  if (res.ok) {
    done.set(key, res);
    if (done.size > 40) done.delete(done.keys().next().value);
  }
  return res;
}
// The kit renders its pieces on a few more engines at once (each piece is its own OpenSCAD run): one per spare core,
// up to 3 more, none on a phone or a device with little memory (every engine holds the model and its geometry).
export let pool = null;
export function kitEngines() {
  const spare = Math.min(3, (navigator.hardwareConcurrency || 2) - 2);
  if (spare < 1 || (navigator.deviceMemory ?? 8) < 4 || matchMedia(NARROW).matches) return Promise.resolve([]);
  pool ??= Array.from({ length: spare }, () => {
    const w = new Worker(new URL('./openscad-worker.js', import.meta.url), { type: 'module' });
    const pending = new Map();
    let next = 1;
    const ready = new Promise((resolve) => {
      w.onmessage = ({ data: m }) => {
        if (m.type === 'ready') resolve(true);
        else if (m.type === 'error') resolve(false);
        else if (m.type === 'result') { pending.get(m.id)?.(m); pending.delete(m.id); }
      };
    });
    w.postMessage({ type: 'init', base: BASE });
    const run = (defines, out) => new Promise((resolve) => {
      const id = next++;
      pending.set(id, resolve);
      w.postMessage({ type: 'run', id, defines, out });
    });
    return ready.then((ok) => (ok ? run : null));
  });
  return Promise.all(pool).then((runs) => runs.filter(Boolean));
}
export const definesFor = (v) => Object.entries(v)
  .filter(([k, x]) => S.params[k] && (!same(x, S.defaults[k]) || k === 'part'))
  .map(([k, x]) => `${k}=${scadLiteral(S.params[k], x)}`);

export function setStatus(text, kind = '') {
  const s = $('#status');
  s.textContent = text;
  s.className = 'status ' + kind;
}

// the colour of the printed parts in the view: a preset, or your own
export function setColour(name, hex) {
  UI.filament = name;
  if (hex) UI.custom = hex;
  saveUI();
  viewer?.setFilament(filamentHexes());
}