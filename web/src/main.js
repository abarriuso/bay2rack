import './style.css';
import { Viewer } from './viewer.js';
import { parseCustomizer, scadLiteral, fromPreset, humanize } from './customizer.js';
import { t, lang, setLang, applyI18n } from './i18n.js';

const BASE = new URL('./', document.baseURI).href;
const DEFAULT_VARIANT = 'plate-flush/3bay-2U';
const OPEN_SECTIONS = new Set(['Part to render', 'Drive bays', 'Front style', 'Fit mode', 'Spare-zone filler']);

const $ = (s) => document.querySelector(s);
const h = (tag, { dataset, ...props } = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  Object.assign(e.dataset, dataset);
  e.append(...kids.filter((k) => k != null));
  return e;
};

const S = {
  sections: [], params: {}, defaults: {}, values: {}, presets: {}, catalog: null,
  variant: null, engine: 'loading', busy: false, dirty: false, wantRender: false,
  result: null, lastPart: null,
};

// ---------------------------------------------------------------- engine
const viewer = new Viewer($('#view'));
const worker = new Worker(new URL('./openscad-worker.js', import.meta.url), { type: 'module' });
const jobs = new Map();
let nextJob = 1;

worker.onmessage = ({ data: m }) => {
  if (m.type === 'ready') {
    S.engine = 'ready';
    setStatus(t('ready'));
    $('#generate').disabled = false;
    if (S.wantRender) render();
  } else if (m.type === 'error') {
    S.engine = 'error';
    setStatus(t('engineError', { e: m.message }), 'error');
  } else if (m.type === 'result') {
    jobs.get(m.id)?.(m);
    jobs.delete(m.id);
  }
};

worker.postMessage({ type: 'init', base: BASE });

const runJob = (defines, out) => new Promise((resolve) => {
  const id = nextJob++;
  jobs.set(id, resolve);
  worker.postMessage({ type: 'run', id, defines, out });
});

function setStatus(text, kind = '') {
  const s = $('#status');
  s.textContent = text;
  s.className = 'status ' + kind;
}

// ---------------------------------------------------------------- variants
function variantValues(path) {
  const v = { ...S.defaults };
  for (const [k, s] of Object.entries(S.presets[path] ?? {})) if (S.params[k]) v[k] = fromPreset(S.params[k], s);
  return v;
}

function buildVariantSelect() {
  const sel = $('#variant');
  sel.replaceChildren();
  const groups = {};
  for (const v of S.catalog?.variants ?? Object.keys(S.presets).map((p) => ({ path: p, family: p.split('/')[0], title: '' }))) {
    groups[v.family] ??= h('optgroup', { label: t('fam:' + v.family) });
    groups[v.family].append(h('option', { value: v.path, textContent: `${v.path.split('/')[1]}  ·  ${v.title}` }));
  }
  sel.append(...Object.values(groups), h('option', { value: '', textContent: '— ' + t('custom') + ' —', disabled: true }));
  sel.value = S.variant ?? '';
}

function isCustom() {
  if (!S.variant) return true;
  const v = variantValues(S.variant);
  return Object.keys(v).some((k) => v[k] !== S.values[k] && k !== 'part');
}

function selectVariant(path, { autoRender = true } = {}) {
  S.variant = path;
  S.values = variantValues(path);
  syncForm();
  showPrebuilt();
  writeHash();
  if (autoRender && $('#auto').checked) schedule(0);
}

async function showPrebuilt() {
  const box = $('#prebuilt');
  box.replaceChildren();
  const v = S.catalog?.variants.find((x) => x.path === S.variant);
  if (!v || !v.files.length) return;
  box.append(h('div', { className: 'label', textContent: t('prebuilt') }),
    ...v.files.map((f) => h('a', { href: BASE + 'stl/' + f, download: `bay2rack-${f.replace(/\//g, '-')}`,
                                    textContent: f.split('/').pop() })));
  if (S.result) return;                 // a render is already on screen
  const r = await fetch(BASE + 'stl/' + v.files[0]);
  if (!r.ok || S.result) return;
  viewer.load(await r.arrayBuffer(), 'stl');
  showEchoes(v.bom.map((b) => 'BOM | ' + b), []);
  setStatus(S.engine === 'ready' ? t('prebuiltShown') : t('loading'), S.engine === 'ready' ? '' : 'busy');
}

// ---------------------------------------------------------------- form
function control(p) {
  const set = (val) => {
    S.values[p.name] = val;
    $('#variant').value = isCustom() ? '' : S.variant;
    markModified();
    writeHash();
    if ($('#auto').checked) schedule();
  };
  let input;
  if (p.widget === 'select') {
    input = h('select', {}, ...p.options.map((o) => h('option', { value: o.value, textContent: o.label })));
    input.onchange = () => set(p.type === 'number' ? Number(input.value) : input.value);
  } else if (p.widget === 'check') {
    input = h('input', { type: 'checkbox' });
    input.onchange = () => set(input.checked);
  } else if (p.widget === 'slider') {
    const range = h('input', { type: 'range', min: p.min, max: p.max, step: p.step ?? 1 });
    const num = h('input', { type: 'number', min: p.min, max: p.max, step: p.step ?? 1, className: 'num' });
    range.oninput = () => { num.value = range.value; set(Number(range.value)); };
    num.onchange = () => { range.value = num.value; set(Number(num.value)); };
    input = h('span', { className: 'slider' }, range, num);
    input.setValue = (v) => { range.value = v; num.value = v; };
  } else if (p.widget === 'number') {
    input = h('input', { type: 'number', step: 'any', className: 'num' });
    input.onchange = () => set(Number(input.value));
  } else {
    input = h('input', { type: 'text' });
    input.onchange = () => set(input.value);
  }
  input.setValue ??= (v) => { if (p.widget === 'check') input.checked = v; else input.value = v; };
  p.input = input;
  return h('label', { className: 'param', title: p.name },
    h('span', { className: 'name', textContent: humanize(p.name) }), input,
    p.desc ? h('small', { textContent: p.desc }) : null);
}

function buildForm() {
  const form = $('#form');
  const open = new Set([...form.querySelectorAll('details[open]')].map((d) => d.dataset.name));
  form.replaceChildren(...S.sections.map((s) => h('details',
    { open: open.size ? open.has(s.name) : OPEN_SECTIONS.has(s.name), dataset: { name: s.name } },
    h('summary', { textContent: t('sec:' + s.name) }), ...s.params.map(control))));
  syncForm();
}

function syncForm() {
  for (const p of Object.values(S.params)) p.input?.setValue(S.values[p.name]);
  $('#variant').value = isCustom() ? '' : S.variant;
  markModified();
}

function markModified() {
  const base = S.variant ? variantValues(S.variant) : S.defaults;
  for (const p of Object.values(S.params)) p.input?.closest('.param')?.classList.toggle('modified', S.values[p.name] !== base[p.name]);
}

// ---------------------------------------------------------------- URL hash (shareable)
function writeHash() {
  const q = new URLSearchParams();
  if (S.variant) q.set('v', S.variant);
  const base = S.variant ? variantValues(S.variant) : S.defaults;
  for (const [k, v] of Object.entries(S.values)) if (v !== base[k]) q.set(k, String(v));
  history.replaceState(null, '', '#' + q.toString().replace(/%2F/g, '/'));
}

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (![...q.keys()].length) return false;
  const v = q.get('v');
  S.variant = v && S.presets[v] ? v : null;
  S.values = S.variant ? variantValues(S.variant) : { ...S.defaults };
  for (const [k, s] of q) if (S.params[k]) S.values[k] = fromPreset(S.params[k], s);
  return true;
}

// ---------------------------------------------------------------- render
let timer = null;
function schedule(ms = 700) {
  clearTimeout(timer);
  timer = setTimeout(render, ms);
}

async function render() {
  if (S.engine !== 'ready') { S.wantRender = true; return; }
  if (S.busy) { S.dirty = true; return; }
  S.busy = true;
  S.dirty = false;
  S.wantRender = false;
  const values = { ...S.values };
  const ext = values.part === 'assembly' ? '3mf' : 'stl';
  const defines = Object.entries(values)
    .filter(([k, v]) => v !== S.defaults[k] || k === 'part')
    .map(([k, v]) => `${k}=${scadLiteral(S.params[k], v)}`);
  setStatus(t('rendering'), 'busy');
  $('#generate').disabled = true;
  const res = await runJob(defines, 'out.' + ext);
  S.busy = false;
  $('#generate').disabled = false;
  showResult(res, ext, values);
  if (S.dirty) render();
}

function showResult(res, ext, values) {
  const echoes = res.logs.map((l) => l.match(/^ECHO: "(.*)"$/)?.[1]).filter(Boolean);
  const errors = res.logs.filter((l) => /^(ERROR|WARNING|TRACE):/.test(l));
  $('#log').textContent = res.logs.join('\n');
  if (!res.ok) {
    setStatus(t('failed'), 'error');
    showEchoes(echoes, errors);
    return;
  }
  const keepView = S.lastPart === values.part && S.lastBays === values.bays;
  // in the assembly, frame the bays rather than the whole PC tower
  const top = values.bays * 43.18 + 25;
  const focus = values.part === 'assembly' ? { min: [-95, -40, -25], max: [95, 40, top] } : null;
  viewer.load(res.data.buffer, ext, { keepView, focus });
  S.lastPart = values.part;
  S.lastBays = values.bays;
  const name = `bay2rack-${(S.variant && !isCustom() ? S.variant : 'custom').replace(/\//g, '-')}-${values.part}.${ext}`;
  if (S.result) URL.revokeObjectURL(S.result.url);
  S.result = { url: URL.createObjectURL(new Blob([res.data])), name };
  $('#download').disabled = false;
  $('#download').textContent = `${t('download')} .${ext}`;
  showEchoes(echoes, errors);
  setStatus(t('rendered', { s: (res.ms / 1000).toFixed(1) }), 'ok');
}

function showEchoes(echoes, errors) {
  const summary = echoes.find((e) => e.startsWith('bay2rack |'));
  $('#summary').textContent = summary ? summary.replace(/^bay2rack \| /, '').split(' | ').join('  ·  ') : '';
  const bom = echoes.filter((e) => e.startsWith('BOM | ')).map((e) => e.slice(6));
  const warn = [...echoes.filter((e) => /^(WARNING|NOTE)/.test(e)), ...errors];
  $('#bom').replaceChildren(...(bom.length ? bom : [t('nothing')]).map((b) => h('li', { textContent: b.replace(/  \+  /g, '  +  ') })));
  $('#warnings').replaceChildren(...warn.map((w) => h('li', { textContent: w, className: /^(WARNING|ERROR)/.test(w) ? 'warn' : 'note' })));
}

// ---------------------------------------------------------------- chrome
function wire() {
  $('#variant').onchange = (e) => e.target.value && selectVariant(e.target.value);
  $('#generate').onclick = () => render();
  $('#fit').onclick = () => viewer.fit();
  $('#download').onclick = () => {
    if (!S.result) return;
    h('a', { href: S.result.url, download: S.result.name }).click();
  };
  $('#share').onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus(t('copied'), 'ok');
    } catch { prompt('URL', location.href); }
  };
  $('#lang').onclick = () => {
    setLang(lang === 'es' ? 'en' : 'es');
    $('#lang').textContent = lang === 'es' ? 'EN' : 'ES';
    buildVariantSelect();
    buildForm();
    showPrebuilt();
  };
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') render();
  });
}

async function boot() {
  document.documentElement.lang = lang;
  $('#lang').textContent = lang === 'es' ? 'EN' : 'ES';
  applyI18n();
  setStatus(t('loading'), 'busy');
  $('#generate').disabled = true;
  const [src, presets, catalog] = await Promise.all([
    fetch(BASE + 'scad/bay2rack.scad').then((r) => r.text()),
    fetch(BASE + 'scad/bay2rack.json').then((r) => r.json()),
    fetch(BASE + 'stl/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  S.sections = parseCustomizer(src);
  for (const s of S.sections) for (const p of s.params) { S.params[p.name] = p; S.defaults[p.name] = p.value; }
  S.presets = presets.parameterSets;
  S.catalog = catalog;
  wire();
  if (!readHash()) {
    S.variant = DEFAULT_VARIANT;
    S.values = variantValues(DEFAULT_VARIANT);
  }
  buildVariantSelect();
  buildForm();
  showPrebuilt();
  writeHash();
  S.wantRender = true;            // render the assembly as soon as OpenSCAD is ready
  if (S.engine === 'ready') render();
}

boot();
