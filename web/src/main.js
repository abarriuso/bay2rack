import './style.css';
import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { Viewer } from './viewer.js';
import { parseCustomizer, scadLiteral, fromPreset } from './customizer.js';
import { t, lang, setLang, applyI18n } from './i18n.js';
import { stepHelp, optionHelp, paramLabel, paramHelp, bomText, warnText } from './help.js';
import { initTooltips } from './tooltip.js';
import { ICONS } from './icons.js';

const BASE = new URL('./', document.baseURI).href;
const VIEW_ONLY = new Set(['part', 'print_orientation', 'explode', 'case_view', 'case_model', 'case_window', 'show_devices',
  'demo_devices', 'show_hardware', 'section', 'scene', 'module_type', 'cover_type']);
const FILLS = ['keystone', 'buttons', 'vent', 'cable', 'led', 'label', 'blank'];
const MODULES = ['ms105g', 'shelf', 'patch', 'buttons', 'vent', 'blank', 'cable', 'led', 'label'];
const PORTS = ['rj45m', 'rj45', 'hdmi', 'usb', 'cover', 'pass', 'none'];
const SCREWS = ['M3', 'M4', 'M5', 'M6', '10-32', '12-24'];
const FIXINGS = ['heatset', 'tap', 'nut_trap', 'square_nut', 'channel'];
const TESTS = ['test_bay', 'test_rack', 'test_keystone'];

const $ = (s) => document.querySelector(s);
const h = (tag, { dataset, ...props } = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  if (dataset) for (const [k, x] of Object.entries(dataset)) if (x != null) e.dataset[k] = x;
  e.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return e;
};
const svgEl = (markup) => { const s = h('span', { className: 'ico' }); s.innerHTML = markup; return s; };
const num = (x, d = 1) => Number(x).toLocaleString(lang, { maximumFractionDigits: d });

const S = {
  sections: [], params: {}, defaults: {}, values: {}, presets: {}, catalog: null,
  engine: 'loading', busy: false, dirty: false, wantRender: false, kitBusy: false,
  result: null, lastKey: '', tests: 'test_bay',
};

// ---------------------------------------------------------------- derived (mirrors config.scad)
function calc(v) {
  const U = v.rack_u_h, pitch = 43.18, bayH = 41.53;
  const bezel = v.front_style === 'bezel';
  const stack = (v.bays - 1) * pitch + bayH - v.height_clearance;
  const base = bezel ? (v.bays - 1) * pitch + v.bezel_h1 - v.bezel_clearance : stack;
  const flushUnits = Math.floor((base + 0.001) / U);
  const units = v.units_override > 0 ? v.units_override : v.fit === 'overhang' ? v.bays : flushUnits;
  const frameH = !bezel && v.fit === 'overhang' ? Math.max(units * U, base) : base;
  const spare = frameH - units * U;
  const hasSpare = spare >= v.min_spare;
  const zones = !hasSpare ? [] : v.spare_pos === 'split' ? [v.spare_fill, v.spare_fill_2] : [v.spare_fill];
  return { units, spare, hasSpare, zones, flushUnits, flushSpare: base - flushUnits * U, over: v.bays * U - base };
}
const splitList = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
const ksTypes = (v) => (String(v.ks_ports_list).trim() ? splitList(v.ks_ports_list)
  : Array(Math.max(v.ks_ports, 1)).fill(v.ks_style === 'metal' ? 'rj45m' : 'rj45'));
const usedMods = (v, units) => { const m = splitList(v.rack_modules); return Array.from({ length: units }, (_, k) => m[k] ?? 'blank'); };

// ---------------------------------------------------------------- engine
const viewer = new Viewer($('#view'));
const worker = new Worker(new URL('./openscad-worker.js', import.meta.url), { type: 'module' });
const jobs = new Map();
let nextJob = 1;
worker.onmessage = ({ data: m }) => {
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
};
worker.postMessage({ type: 'init', base: BASE });
const runJob = (defines, out) => new Promise((resolve) => {
  const id = nextJob++;
  jobs.set(id, resolve);
  worker.postMessage({ type: 'run', id, defines, out });
});
const definesFor = (v) => Object.entries(v)
  .filter(([k, x]) => S.params[k] && (x !== S.defaults[k] || k === 'part'))
  .map(([k, x]) => `${k}=${scadLiteral(S.params[k], x)}`);

function setStatus(text, kind = '') {
  const s = $('#status');
  s.textContent = text;
  s.className = 'status ' + kind;
}

// ---------------------------------------------------------------- state changes
function update(patch) {
  Object.assign(S.values, patch);
  refresh();
  schedule();
}
function refresh() {
  renderSteps();
  renderTabs();
  syncAdvanced();
  showPrebuilt();
  writeHash();
}

// ---------------------------------------------------------------- small widgets
const tipOf = (key) => optionHelp(key) || undefined;

function choice(param, value, content, { cls = 'chip', tip, extra } = {}) {
  const active = S.values[param] === value;
  return h('button', {
    type: 'button', className: `${cls}${active ? ' active' : ''}`,
    onclick: () => update({ [param]: value, ...(extra ? extra(value) : {}) }),
    dataset: { tip },
  }, content);
}
const chips = (param, values, label, tipPrefix) =>
  h('div', { className: 'chips' }, values.map((v) => choice(param, v, label(v), { tip: tipPrefix ? tipOf(tipPrefix + v) : undefined })));
const segmented = (param, values, label, tip) =>
  h('div', { className: 'seg', dataset: { tip } }, values.map((v) => choice(param, v, label(v), { cls: 'seg-btn' })));

function cards(param, options, extra) {
  return h('div', { className: 'cards' }, options.map((o) => choice(param, o.value,
    [o.icon ? svgEl(o.icon) : null, h('strong', { textContent: o.label }), o.sub ? h('small', { textContent: o.sub }) : null],
    { cls: 'card-btn', extra, tip: o.tip })));
}

// options: [[value, label]]; onPick(value) or update({param: value})
function select(param, options, current, onPick) {
  const sel = h('select', { className: 'select', onchange: () => (onPick ? onPick(sel.value) : update({ [param]: sel.value })) },
    options.map(([v, l]) => h('option', { value: v, textContent: l })));
  sel.value = current ?? S.values[param];
  return sel;
}

function toggle(label, on, set) {
  return h('label', { className: 'toggle' },
    h('input', { type: 'checkbox', checked: on, onchange: (e) => set(e.target.checked) }), h('span', { className: 'track' }),
    h('span', { textContent: label }));
}

function step(n, key, ...body) {
  const help = stepHelp(key);
  return h('section', { className: 'step' },
    h('header', { dataset: { tip: help || undefined, tipTitle: t('step_' + key) } },
      h('span', { className: 'num', textContent: n }), h('h3', { textContent: t('step_' + key) }),
      help ? h('button', { type: 'button', className: 'info', 'aria-label': 'info', textContent: 'i' }) : null),
    h('div', { className: 'body' }, body));
}

// ---------------------------------------------------------------- simple mode
function renderSteps() {
  const v = S.values;
  const c = calc(v);
  const list = [];
  let n = 0;
  const add = (key, ...body) => list.push(step(++n, key, ...body));
  const mods = usedMods(v, c.units);
  const panel = v.part === 'rack_panel';

  if (v.part.startsWith('test_')) add('test', segmented('part', TESTS, (x) => t(x)));
  if (panel) {
    add('panel', segmented('panel_u', [1, 2, 3, 4], (x) => `${x}U`), chips('panel_fill', FILLS, (x) => t('fill_' + x)));
  } else {
    add('bays', segmented('bays', [1, 2, 3, 4, 5, 6], String));
    add('front', cards('front_style', [
      { value: 'plate', icon: ICONS.plate, label: t('opt_plate'), sub: t('opt_plate_sub') },
      { value: 'bezel', icon: ICONS.bezel, label: t('opt_bezel'), sub: t('opt_bezel_sub') },
    ], (x) => ({ filler_mode: x === 'bezel' ? 'integral' : 'separate' })));
    add('fit', cards('fit', [
      { value: 'flush', icon: ICONS.flush, label: t('opt_flush'), sub: `${c.flushUnits}U + ${num(c.flushSpare)} mm ${t('free')}` },
      { value: 'overhang', icon: ICONS.overhang, label: t('opt_overhang'), sub: `${v.bays}U · ${t('sticksOut')} ${num(c.over)} mm` },
    ]));
    if (c.units > 0) add('contents', contentsEditor(mods));
    if (c.hasSpare) add('fill', chips('spare_fill', FILLS, (x) => t('fill_' + x)));
  }
  const fills = panel ? [v.panel_fill] : c.zones;
  const usesPatch = fills.includes('keystone') || (!panel && mods.includes('patch'));
  const usesButtons = fills.includes('buttons') || (!panel && mods.includes('buttons'));
  if (usesPatch) add('ports', portsEditor(panel && v.panel_u > 1 ? 12 : 6));
  if (usesButtons) add('buttons', buttonsEditor());
  add('screw', chips('rack_screw', SCREWS, String),
    h('div', { className: 'chips small' }, FIXINGS.map((f) => choice('rack_fixing', f, t('fix_' + f), { tip: tipOf('fixing:' + f) }))));
  if (v.part === 'assembly') add('preview', previewEditor());
  $('#steps').replaceChildren(...list);
}

function contentsEditor(mods) {
  const set = (k, val) => { const m = [...mods]; m[k] = val; update({ rack_modules: m.join(',') }); };
  return h('div', { className: 'rows' }, mods.map((m, k) => h('label', { className: 'row', dataset: { tip: tipOf('mod:' + m) } },
    h('span', { className: 'u', textContent: k === 0 ? `U${k + 1} · ${t('top')}` : `U${k + 1}` }),
    select(null, MODULES.map((x) => [x, t('mod_' + x)]), m, (val) => set(k, val)))));
}

function portsEditor(max) {
  const v = S.values;
  const types = ksTypes(v);
  const setTypes = (list) => update({ ks_ports_list: list.join(','), ks_ports: list.length });
  const cycle = (i, dir) => {
    const list = [...types];
    list[i] = PORTS[(PORTS.indexOf(list[i]) + dir + PORTS.length) % PORTS.length];
    setTypes(list);
  };
  return [
    h('div', { className: 'ports' },
      types.map((tp, i) => h('button', {
        type: 'button', className: `port port-${tp}`, onclick: () => cycle(i, 1),
        oncontextmenu: (e) => { e.preventDefault(); cycle(i, -1); },
        dataset: { tip: tipOf('port:' + tp), tipTitle: `${i + 1} · ${t('port_' + tp)}` },
      }, h('b', { textContent: i + 1 }), h('span', { textContent: t('port_' + tp) }))),
      h('span', { className: 'port-ctl' },
        h('button', { type: 'button', className: 'mini', textContent: '+', disabled: types.length >= max,
          dataset: { tip: t('portAdd') }, onclick: () => setTypes([...types, v.ks_style === 'metal' ? 'rj45m' : 'rj45']) }),
        h('button', { type: 'button', className: 'mini', textContent: '−', disabled: types.length <= 1,
          dataset: { tip: t('portRemove') }, onclick: () => setTypes(types.slice(0, -1)) }))),
    h('small', { className: 'hint', textContent: t('portHint') }),
    segmented('ks_style', ['metal', 'standard'], (x) => t('ks_' + x)),
  ];
}

function buttonsEditor() {
  return [
    segmented('btn_count', [1, 2], (x) => t('btn_' + x)),
    cards('led_style', ['ring', 'halo', 'glow'].map((s) => ({ value: s, label: t('led_' + s), sub: t('led_' + s + '_sub'), tip: tipOf('led:' + s) }))),
    segmented('led_d', [3, 5], (x) => t('led_' + x)),
  ];
}

function previewEditor() {
  const v = S.values;
  const caseOpts = [...S.params.case_model.options.map((o) => [o.value, o.label.replace(/ - (\d+) bays$/, ' · $1 × 5,25"')]), ['none', t('case_none')]];
  return [
    segmented('scene', ['homelab', 'single'], (x) => t('scene_' + x), stepHelp('scene')),
    select(null, caseOpts, v.case_view === 'none' ? 'none' : v.case_model,
      (val) => update(val === 'none' ? { case_view: 'none' } : { case_view: 'tower', case_model: val })),
    h('div', { className: 'toggles' },
      toggle(t('devices'), v.demo_devices === 'homelab', (on) => update({ demo_devices: on ? 'homelab' : 'generic' })),
      toggle(t('hardware'), v.show_hardware, (on) => update({ show_hardware: on })),
      toggle(t('explode'), v.explode > 0, (on) => update({ explode: on ? 25 : 0 }))),
  ];
}

// ---------------------------------------------------------------- tabs (what to view / download)
function renderTabs() {
  const v = S.values;
  const c = calc(v);
  const mods = [...new Set(usedMods(v, c.units))];
  const covers = ksTypes(v).filter((x) => x === 'cover' || x === 'pass');
  const tab = (id, label, enabled, onclick, active) => h('button', {
    type: 'button', className: `tab${active ? ' active' : ''}`, disabled: !enabled, onclick,
    dataset: { tip: tipOf('part:' + id) },
  }, t(label));
  const tabs = [
    tab('assembly', 'tabAssembly', true, () => update({ part: 'assembly' }), v.part === 'assembly'),
    tab('adapter', 'tabAdapter', true, () => update({ part: 'adapter' }), v.part === 'adapter'),
    tab('filler', 'tabFiller', v.filler_mode === 'separate' && c.hasSpare, () => update({ part: 'filler' }), v.part === 'filler'),
    tab('rack_module', 'tabModules', mods.length > 0,
      () => update({ part: 'rack_module', module_type: mods.includes(v.module_type) ? v.module_type : mods[0] }), v.part === 'rack_module'),
    tab('keystone_cover', 'tabCovers', covers.length > 0,
      () => update({ part: 'keystone_cover', cover_type: covers.includes('cover') ? 'blank' : 'pass' }), v.part === 'keystone_cover'),
    tab('rack_panel', 'tabPanel', true, () => update({ part: 'rack_panel' }), v.part === 'rack_panel'),
    tab('tests', 'tabTests', true, () => update({ part: S.tests }), v.part.startsWith('test_')),
  ];
  let sub = null;
  if (v.part === 'rack_module') sub = select('module_type', mods.map((m) => [m, t('mod_' + m)]));
  if (v.part === 'keystone_cover') sub = select('cover_type', ['blank', 'pass'].map((x) => [x, t('cover_' + x)]));
  if (v.part.startsWith('test_')) { S.tests = v.part; sub = select('part', TESTS.map((x) => [x, t(x)])); }
  $('#tabs').replaceChildren(...tabs, ...(sub ? [h('span', { className: 'tab-sub' }, sub)] : []));
  $('#download').textContent = `${t('downloadPart')} (.${v.part === 'assembly' ? '3mf' : 'stl'})`;
}

// ---------------------------------------------------------------- advanced mode (every parameter)
function control(p) {
  const set = (val) => update({ [p.name]: val });
  let input;
  if (p.widget === 'select') {
    input = h('select', { className: 'select' }, p.options.map((o) => h('option', { value: o.value, textContent: o.label })));
    input.onchange = () => set(p.type === 'number' ? Number(input.value) : input.value);
  } else if (p.widget === 'check') {
    input = h('input', { type: 'checkbox', onchange: () => set(input.checked) });
  } else if (p.widget === 'slider') {
    const range = h('input', { type: 'range', min: p.min, max: p.max, step: p.step ?? 1 });
    const box = h('input', { type: 'number', min: p.min, max: p.max, step: p.step ?? 1, className: 'num' });
    range.oninput = () => { box.value = range.value; };
    range.onchange = () => set(Number(range.value));
    box.onchange = () => set(Number(box.value));
    input = h('span', { className: 'slider' }, range, box);
    input.setValue = (x) => { range.value = x; box.value = x; };
  } else if (p.widget === 'number') {
    input = h('input', { type: 'number', step: 'any', className: 'num' });
    input.onchange = () => set(Number(input.value));
  } else {
    input = h('input', { type: 'text', className: 'text' });
    input.onchange = () => set(input.value);
  }
  input.setValue ??= (x) => { if (p.widget === 'check') input.checked = x; else input.value = x; };
  p.input = input;
  return h('label', { className: 'param', dataset: { tip: paramHelp(p) || undefined, tipTitle: `${paramLabel(p)}  ·  ${p.name}` } },
    h('span', { className: 'name', textContent: paramLabel(p) }), input);
}

function buildAdvanced() {
  $('#form').replaceChildren(...S.sections.map((s) => h('details', { className: 'sec' },
    h('summary', { textContent: t('sec:' + s.name) }), s.params.map(control))));
  syncAdvanced();
}
function syncAdvanced() {
  for (const p of Object.values(S.params)) {
    p.input?.setValue(S.values[p.name]);
    p.input?.closest('.param')?.classList.toggle('modified', S.values[p.name] !== S.defaults[p.name]);
  }
}

// ---------------------------------------------------------------- pre-built files
function matchingVariant() {
  const v = S.values;
  return S.catalog?.variants.find((x) => {
    const want = { ...S.defaults };
    for (const [k, s] of Object.entries(S.presets[x.path] ?? {})) if (S.params[k]) want[k] = fromPreset(S.params[k], s);
    if (x.params.part && x.params.part !== v.part) return false;
    if (x.params.module_type && x.params.module_type !== v.module_type) return false;
    if (x.params.cover_type && x.params.cover_type !== v.cover_type) return false;
    return Object.keys(want).every((k) => VIEW_ONLY.has(k) || want[k] === v[k]);
  });
}
function showPrebuilt() {
  const v = matchingVariant();
  const box = $('#prebuilt');
  box.replaceChildren();
  if (!v?.files.length) return;
  box.append(h('div', { className: 'label', textContent: t('prebuilt') }),
    h('div', { className: 'chips' }, v.files.map((f) => h('a', { className: 'file', href: BASE + 'stl/' + f,
      download: 'bay2rack-' + f.replace(/\//g, '-'), textContent: f.split('/').pop() }))));
}

// ---------------------------------------------------------------- URL hash (shareable settings)
function writeHash() {
  const q = new URLSearchParams();
  for (const [k, x] of Object.entries(S.values)) if (x !== S.defaults[k]) q.set(k, String(x));
  history.replaceState(null, '', '#' + q.toString().replace(/%2C/g, ','));
}
function readHash() {
  for (const [k, s] of new URLSearchParams(location.hash.slice(1))) if (S.params[k]) S.values[k] = fromPreset(S.params[k], s);
}

// ---------------------------------------------------------------- render
let timer = null;
function schedule(ms = 450) {
  clearTimeout(timer);
  timer = setTimeout(render, ms);
}

async function render() {
  if (S.engine !== 'ready' || S.kitBusy) { S.wantRender = true; return; }
  if (S.busy) { S.dirty = true; return; }
  S.busy = true; S.dirty = false; S.wantRender = false;
  const values = { ...S.values };
  const ext = values.part === 'assembly' ? '3mf' : 'stl';
  setStatus(t('rendering'), 'busy');
  const res = await runJob(definesFor(values), 'out.' + ext);
  S.busy = false;
  showResult(res, ext, values);
  if (S.dirty || S.wantRender) render();
}

function showResult(res, ext, values) {
  const echoes = res.logs.map((l) => l.match(/^ECHO: "(.*)"$/)?.[1]).filter(Boolean);
  const errors = res.logs.filter((l) => /^(ERROR|WARNING):/.test(l));
  $('#log').textContent = res.logs.join('\n');
  showEchoes(echoes, errors);
  if (!res.ok) { setStatus(t('failed'), 'error'); return; }
  const key = [values.part, values.bays, values.scene, values.case_view, values.module_type].join('|');
  const homelab = values.part === 'assembly' && values.case_view === 'tower' && values.scene === 'homelab';
  const top = values.bays * 43.18 + 25;
  const focus = values.part === 'assembly' && !homelab ? { min: [-95, -40, -25], max: [95, 40, top] } : null;
  viewer.load(res.data.buffer, ext, { keepView: key === S.lastKey, focus });
  S.lastKey = key;
  if (S.result) URL.revokeObjectURL(S.result.url);
  S.result = { url: URL.createObjectURL(new Blob([res.data])), name: `bay2rack-${values.part}.${ext}` };
  $('#download').disabled = false;
  setStatus(t('rendered', { s: num(res.ms / 1000) }), 'ok');
}

function showEchoes(echoes, errors) {
  const bom = echoes.filter((e) => e.startsWith('BOM | ')).map((e) => e.slice(6));
  const warn = [...echoes.filter((e) => /^(WARNING|NOTE)/.test(e)), ...errors];
  $('#bom').replaceChildren(...(bom.length ? bom : [t('nothing')]).map((b) => {
    const [what, ...rest] = bomText(b).split(': ');
    return h('li', {}, rest.length ? [h('b', { textContent: what }), ' ' + rest.join(': ')] : what);
  }));
  $('#warnings').replaceChildren(...(warn.length ? warn : [t('allGood')]).map((w) =>
    h('li', { className: /^(WARNING|ERROR)/.test(w) ? 'warn' : /^NOTE/.test(w) ? 'note' : 'good',
              textContent: warnText(w.replace(/^(WARNING|NOTE): ?/, '')) })));
}

// ---------------------------------------------------------------- kit download
function kitList(v) {
  const c = calc(v);
  const files = [{ name: 'adapter.stl', qty: 1, part: { part: 'adapter' } }];
  if (v.filler_mode === 'separate' && c.zones.length) {
    files.push({ name: 'filler.stl', qty: 1, part: { part: 'filler' } });
    if (c.zones.length > 1) files.push({ name: 'filler-2.stl', qty: 1, part: { part: 'filler_2' } });
  }
  const mods = usedMods(v, c.units);
  for (const m of new Set(mods))
    files.push({ name: `module-${m}.stl`, qty: mods.filter((x) => x === m).length, part: { part: 'rack_module', module_type: m } });
  const sets = c.zones.filter((z) => z === 'keystone').length + mods.filter((m) => m === 'patch').length;
  const types = ksTypes(v);
  for (const [kind, file] of [['cover', 'blank'], ['pass', 'pass']]) {
    const q = sets * types.filter((x) => x === kind).length;
    if (q) files.push({ name: `keystone-${file}.stl`, qty: q, part: { part: 'keystone_cover', cover_type: file } });
  }
  if ($('#withTests').checked) for (const x of TESTS) files.push({ name: `tests/${x}.stl`, qty: 1, part: { part: x } });
  return files;
}

async function downloadKit() {
  if (S.engine !== 'ready' || S.kitBusy) return;
  S.kitBusy = true;
  $('#kit').disabled = true;
  const v = { ...S.values };
  const files = kitList(v);
  const zip = {};
  try {
    for (const [i, f] of files.entries()) {
      setStatus(t('kitStep', { i: i + 1, n: files.length, name: f.name }), 'busy');
      const res = await runJob(definesFor({ ...v, ...f.part }), 'out.stl');
      if (!res.ok) { $('#log').textContent = res.logs.join('\n'); setStatus(t('kitFailed', { name: f.name }), 'error'); return; }
      zip['bay2rack/' + f.name] = res.data;
    }
    const bomRes = await runJob(definesFor({ ...v, part: 'assembly' }), 'out.echo');
    const echoText = [...bomRes.logs, ...(bomRes.data ? new TextDecoder().decode(bomRes.data).split(/\r?\n/) : [])];
    const bom = [...new Set(echoText.map((l) => l.match(/^ECHO: "BOM \| (.*)"$/)?.[1]).filter(Boolean))].map(bomText);
    const lines = [
      `${t('readme_title')} - ${new Date().toISOString().slice(0, 10)}`, '',
      t('readme_print'), ...files.map((f) => `  ${f.qty} x ${f.name}`), '',
      t('readme_need'), ...bom.map((b) => `  - ${b}`), '',
      t('readme_notes'), '', t('readme_settings'), `  ${location.href}`, '',
      'https://github.com/abarriuso/bay2rack · CC BY-NC-SA 4.0', '',
    ];
    zip['bay2rack/README.txt'] = strToU8(lines.join('\n'));
    zip['bay2rack/settings.json'] = strToU8(JSON.stringify(Object.fromEntries(
      Object.entries(v).filter(([k, x]) => x !== S.defaults[k])), null, 2));
    const blob = new Blob([zipSync(zip, { level: 6 })], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    h('a', { href: url, download: `bay2rack-kit-${v.bays}bay.zip` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus(t('kitDone', { n: files.length }), 'ok');
  } finally {
    S.kitBusy = false;
    $('#kit').disabled = false;
    if (S.wantRender) render();
  }
}

// ---------------------------------------------------------------- chrome
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  $('#theme').replaceChildren(svgEl(th === 'dark' ? ICONS.sun : ICONS.moon));
  try { localStorage.setItem('theme', th); } catch { /* private mode */ }
}

function wire() {
  initTooltips($('#tip'));
  $('#logo').replaceChildren(svgEl(ICONS.logo));
  let th = 'light';
  try { th = localStorage.getItem('theme') || 'light'; } catch { /* private mode */ }
  applyTheme(th);
  $('#theme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#lang').onclick = () => {
    setLang(lang === 'es' ? 'en' : 'es');
    $('#lang').textContent = lang === 'es' ? 'EN' : 'ES';
    buildAdvanced();
    refresh();
    if (S.result) render();
  };
  const adv = $('#advanced');
  try { adv.checked = localStorage.getItem('advanced') === '1'; } catch { /* private mode */ }
  const showAdv = () => {
    $('#form').hidden = !adv.checked;
    try { localStorage.setItem('advanced', adv.checked ? '1' : '0'); } catch { /* private mode */ }
  };
  adv.onchange = showAdv;
  showAdv();
  $('#fit').onclick = () => viewer.fit();
  $('#download').onclick = () => S.result && h('a', { href: S.result.url, download: S.result.name }).click();
  $('#kit').onclick = downloadKit;
  $('#share').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); setStatus(t('copied'), 'ok'); } catch { prompt('URL', location.href); }
  };
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') render(); });
}

async function boot() {
  document.documentElement.lang = lang;
  $('#lang').textContent = lang === 'es' ? 'EN' : 'ES';
  applyI18n();
  setStatus(t('loading'), 'busy');
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
  wire();
  buildAdvanced();
  refresh();
  S.wantRender = true;
  if (S.engine === 'ready') render();
}

boot();
