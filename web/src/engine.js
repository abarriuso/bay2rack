// The OpenSCAD engine (a worker, more for the kit), the render cache and the 3D view, started on demand.
import { scadLiteral, same } from './customizer.js';
import { t } from './i18n.js';
import { BASE, UI, saveUI, filamentHexes, $, NARROW, h, S, atRest, afterFrame } from './state.js';
import { render } from './render.js';
import { meshesOf } from './mesh.js';
import { madeAhead } from './gl-ahead.js';

// ---------------------------------------------------------------- engine
// The 3D view (three.js) and the OpenSCAD engine (11 MB of WebAssembly) start when the configurator comes near the
// screen, so the page itself opens fast; a link with settings in it starts them at once.
export let viewer = null;
export let worker = null;
export let engineStarted = null;
export function startEngine() {
  if (worker) return engineStarted;
  setStatus(t('loading'), 'busy');
  worker = new Worker(new URL('./openscad-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = onEngine;
  worker.postMessage({ type: 'init', base: BASE });
  return startViewer();
}
// The 3D view, which the film can start well before the engine (its first model is made ahead). Its start is one step
// that cannot be cut - three.js asking the GPU what it can do, a wait on each answer, long while the GPU draws the
// film: it waits for a pause in the scroll (atRest). Its WebGL context, the longest wait, the film makes as the page
// comes in (gl-ahead.js). The rest goes a few ms at a time after the frames (the studio's light compiles its shaders
// alongside the page).
export function startViewer() {
  engineStarted ??= import('./viewer.js').then(async ({ Viewer }) => {
    await atRest(150, madeAhead() ? 500 : 900);           // (its context made ahead: the rest is short - gl-ahead.js)
    viewer = new Viewer($('#view'));
    viewer.setTheme(document.documentElement.dataset.theme);
    viewer.setFilament(filamentHexes());
    viewer.show.cables = UI.cables;
    viewer.show.side = UI.side;
    // (the film lays its first model on its table: it is told before any comes - film.js)
    dispatchEvent(new Event('b2r:viewer'));
    await afterFrame();
    await viewer.light();
    // the first look's build may be on screen before the engine is ready: it is made ahead (readyMade)
    if (S.wantRender) render();
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
    setStatus(t('ready'), 'ok', true);
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
// The first look's build, made ahead (scripts/first-render.mjs, into docs/scroll/): the film builds it in the 3D view
// before the engine - 11 MB of WebAssembly, then the render - could have it. Only for the model it was made from (a
// sum of its source) and the very settings it was made with; anything else is rendered as always.
export const sumOf = (raw) => {
  const text = raw.replace(/\r\n/g, '\n');           // (the same sum for a file checked out with Windows' line ends)
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
};
// It is fetched - and read, off the page's thread (mesh.js) - as soon as the film's pictures are in (fetchFirst), while
// the 3D view starts; which settings and which model it is for is checked when it is used.
let first = null;
export function fetchFirst() {
  if (first) return first;
  const meta = fetch(BASE + 'scad/first.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const data = meta.then((j) => (j ? fetch(BASE + 'scad/' + j.file).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : null));
  const meshes = data.then((b) => (b ? meshesOf(new Uint8Array(b)) : null));
  first = { meta, data, meshes };
  return first;
}
export function readyMade(defines, out) {
  const key = out + '\n' + defines.join('\n');
  if (done.has(key)) return Promise.resolve(done.get(key));
  const { meta, data, meshes } = fetchFirst();
  return Promise.all([meta, data]).then(([j, b]) => {
    if (!j || j.scad !== S.scadSum || j.key !== key || !b) return null;
    const res = { ok: true, code: 0, logs: j.logs, ms: j.ms, data: new Uint8Array(b), read: meshes };
    done.set(key, res);
    return res;
  });
}
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

// the status line is not read out at every render ("Rendering...", "Rendered in 1.3 s" on every click): only what
// matters (errors, the engine ready, a link copied, the kit done) goes to the screen reader, through #announce
export function setStatus(text, kind = '', say = kind === 'error') {
  const s = $('#status');
  s.textContent = text;
  if (say) announce(text);
  s.className = 'status ' + kind;
  $('.viewer')?.classList.toggle('busy', kind === 'busy');      // a line runs along the view while it works
}

// the colour of the printed parts in the view: a preset, or your own
export function setColour(name, hex) {
  UI.filament = name;
  if (hex) UI.custom = hex;
  saveUI();
  viewer?.setFilament(filamentHexes());
}

// a polite message for screen readers (the same text twice in a row is said again)
export function announce(text) {
  const a = $('#announce');
  if (!a) return;
  a.textContent = '';
  requestAnimationFrame(() => { a.textContent = text; });
}
