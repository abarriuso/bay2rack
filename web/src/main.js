import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/martian-mono/standard.css';
import './style.css';
import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { Viewer } from './viewer.js';
import { parseCustomizer, scadLiteral, fromPreset, same } from './customizer.js';
import { t, lang, setLang, applyI18n } from './i18n.js';
import { stepHelp, optionHelp, paramLabel, paramHelp, bomText, warnText } from './help.js';
import { initTooltips } from './tooltip.js';
import { ICONS } from './icons.js';
import { renderLegend } from './legend.js';

const BASE = new URL('./', document.baseURI).href;
const VIEW_ONLY = new Set(['part', 'print_orientation', 'explode', 'case_view', 'case_model', 'case_window', 'show_devices',
  'demo_devices', 'show_hardware', 'section', 'scene', 'module_type', 'cover_type']);
const FILLS = ['keystone', 'buttons', 'fan80', 'fan40', 'vent', 'cable', 'led', 'label', 'blank'];
const MODULES = ['ms105g', 'uswflex', 'ux', 'kvm', 'pi', 'piblade', 'dev1', 'dev2', 'shelf', 'patch', 'fan40', 'buttons',
  'vent', 'blank', 'cable', 'led', 'label'];
// trays that hold a list of boxes, written "kvm:jet+nano": choices, how many, default
const TRAYS = {
  kvm: { items: ['jet', 'nano', 'custom'], max: 3, def: 'jet+nano' },
  pi: { items: ['pi5', 'pi4', 'pi3', 'zero'], max: 2, def: 'pi5' },
  piblade: { items: ['pi5', 'pi4', 'pi3'], max: 4, def: 'pi5+pi5+pi5' },
};
const KVM_DIMS = { jet: 'jetkvm_dims', nano: 'nanokvm_dims', custom: 'kvm_custom' };
// device modules -> the parameters holding their size (W, H, D)
const DEVICE_DIMS = {
  ms105g: ['ms_w', 'ms_h', 'ms_d'], uswflex: ['usw_dims'], ux: ['ux_dims'],
  dev1: ['dev1_dims'], dev2: ['dev2_dims'], shelf: ['shelf_depth'], piblade: ['pi_blade_pitch'],
};
// ready-made builds: the examples step and the gallery (applied on top of the defaults)
const EXAMPLES = {
  router: { bays: 4, fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'uswflex,ms105g,kvm:jet+nano',
            spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,cover,pass,pass' },
  homelab: { bays: 3, fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'ms105g,kvm:jet+nano',
             spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,cover,cover,pass' },
  network: { bays: 5, fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'uswflex,ms105g,ux,patch',
             spare_pos: 'top', spare_fill: 'vent', ks_ports_list: 'rj45m,rj45m,rj45m,rj45m,cover,pass' },
  pi: { bays: 4, fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'uswflex,piblade:pi5+pi5+pi5+pi5',
        spare_pos: 'top', spare_fill: 'vent' },
  kvm: { bays: 3, fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'kvm:jet+jet,kvm:nano+nano',
         spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,rj45m,hdmi,usb' },
  audio: { bays: 3, fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'pi:pi4,fan40',
           spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rca,rca,jack,toslink,rj45m,pass' },
  unifi: { bays: 3, fit: 'flush', front_style: 'plate', filler_mode: 'separate', rack_modules: 'uswflex,ux',
           spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,rj45m,cover,pass' },
  client: { bays: 3, fit: 'panel', front_style: 'plate', filler_mode: 'integral', spare_pos: 'split', spare_split: 0.67,
            spare_fill: 'fan80', spare_fill_2: 'buttons' },
  bezel: { bays: 3, fit: 'flush', front_style: 'bezel', filler_mode: 'integral', rack_modules: 'ms105g,kvm:jet+nano',
           spare_pos: 'top', spare_fill: 'keystone', ks_ports_list: 'rj45m,rj45m,rj45m,cover,cover,pass' },
};
const EXAMPLE_KEYS = [...new Set(Object.values(EXAMPLES).flatMap(Object.keys))];
const GALLERY = ['router', 'network', 'pi', 'kvm', 'audio', 'client', 'unifi', 'bezel'];
const PORTS = ['rj45m', 'rj45', 'hdmi', 'usb', 'rca', 'jack', 'toslink', 'cover', 'pass', 'none'];
const SCREWS = ['M3', 'M4', 'M5', 'M6', '10-32', '12-24'];
const FIXINGS = ['heatset', 'tap', 'nut_trap', 'square_nut', 'channel'];
const TESTS = ['test_bay', 'test_rack', 'test_keystone'];
// filament colours: [adapter, fillers, modules] - slightly different so the parts read apart
const FILAMENTS = {
  black: [0x26282c, 0x2e3035, 0x36383d], gray: [0x8a9098, 0x979da5, 0xa4aab2], white: [0xe6e6e1, 0xdcdcd6, 0xefefea],
  blue: [0x2d58a6, 0x3564b5, 0x3f70c2], red: [0xa83029, 0xb63c35, 0xc24841], green: [0x2d7a4c, 0x378858, 0x429564],
};
const UI_DEFAULT = { filament: 'black', cables: true, side: true, sleeper: false };
const UI = (() => { try { return { ...UI_DEFAULT, ...JSON.parse(localStorage.getItem('ui') || '{}') }; } catch { return { ...UI_DEFAULT }; } })();
const saveUI = () => { try { localStorage.setItem('ui', JSON.stringify(UI)); } catch { /* private mode */ } };

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
  const units = v.fit === 'panel' ? 0 : v.units_override > 0 ? v.units_override : v.fit === 'overhang' ? v.bays : flushUnits;
  const frameH = !bezel && v.fit === 'overhang' ? Math.max(units * U, base) : base;
  const spare = frameH - units * U;
  const hasSpare = spare >= v.min_spare;
  const zones = !hasSpare ? [] : v.spare_pos === 'split' ? [v.spare_fill, v.spare_fill_2] : [v.spare_fill];
  return { units, spare, hasSpare, zones, flushUnits, flushSpare: base - flushUnits * U, over: v.bays * U - base };
}
const splitList = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
const ksTypes = (v) => (String(v.ks_ports_list).trim() ? splitList(v.ks_ports_list)
  : Array(Math.max(v.ks_ports, 1)).fill(v.ks_style === 'metal' ? 'rj45m' : 'rj45'));
// rack modules: "kvm:jet+nano" = kind kvm with two boxes; a bare kvm / pi takes kvm_boxes / pi_boards
const modKind = (m) => { const k = String(m).split(':')[0]; return k === 'kvm2' ? 'kvm' : k; };
function modItems(m, v = S.values) {
  const [k, spec] = String(m).split(':');
  if (spec) return spec.split('+').filter(Boolean);
  if (k === 'kvm2') return ['jet', 'nano'];
  if (k === 'kvm') return String(v.kvm_boxes).split('+').filter(Boolean);
  if (k === 'pi' || k === 'piblade') return String(v.pi_boards).split('+').filter(Boolean);
  return [];
}
const modU = (m) => (modKind(m) === 'piblade' ? 2 : 1);
const modLabel = (m) => {
  const items = TRAYS[modKind(m)] ? modItems(m) : [];
  return t('mod_' + modKind(m)) + (items.length ? ` · ${items.map((x) => t('box_' + x)).join(' + ')}` : '');
};
const modFile = (m) => String(m).replace(/[:+]/g, '-');
// modules from the top like config.scad: one that no longer fits becomes a blank
function placeMods(v, units) {
  const list = splitList(v.rack_modules);
  const out = [];
  for (let top = 0, i = 0; top < units; i++) {
    const m = list[i] ?? 'blank';
    const u = top + modU(m) <= units ? modU(m) : 1;
    out.push({ m: u === modU(m) ? m : 'blank', top, u });
    top += u;
  }
  return out;
}
const usedMods = (v, units) => placeMods(v, units).map((p) => p.m);
// will these boxes fit side by side in one tray? (default M6 posts: 122 mm between them; OpenSCAD has the last word)
const OPENING = 122.1;
function trayFits(kind, items, v) {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  if (kind === 'kvm') return sum(items.map((b) => v[KVM_DIMS[b]][0] + v.mount_clear)) + (items.length + 1) * v.mount_wall <= OPENING - 1
    && Math.max(...items.map((b) => v[KVM_DIMS[b]][1] + v.mount_clear)) + 2 * v.mount_wall <= v.rack_u_h - 0.79;
  if (kind === 'pi') return sum(items.map((b) => (b === 'zero' ? 65 : 56))) + (items.length - 1) * 3 <= OPENING - 6;
  if (kind === 'piblade') return (items.length - 1) * v.pi_blade_pitch + 2 + v.pi_standoff + 18.4 <= OPENING - 6;
  return true;
}

// ---------------------------------------------------------------- engine
const viewer = new Viewer($('#view'));
if (import.meta.env.DEV) window.__b2r = { viewer, S, EXAMPLES, applyExample: (k) => applyExample(k) };
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
  .filter(([k, x]) => S.params[k] && (!same(x, S.defaults[k]) || k === 'part'))
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

function choice(param, value, content, { cls = 'chip', tip, extra, disabled = false, flag = '' } = {}) {
  const active = S.values[param] === value;
  return h('button', {
    type: 'button', className: `${cls}${active ? ' active' : ''}${flag ? ' ' + flag : ''}`, disabled,
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

// options: [[value, label, disabled?]]; onPick(value) or update({param: value})
function select(param, options, current, onPick) {
  const sel = h('select', { className: 'select', onchange: () => (onPick ? onPick(sel.value) : update({ [param]: sel.value })) },
    options.map(([v, l, off]) => h('option', { value: v, textContent: l, disabled: !!off })));
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
      h('span', { className: 'step-num', textContent: n }), h('h3', { textContent: t('step_' + key) }),
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
  const placed = placeMods(v, c.units);
  const mods = placed.map((p) => p.m);
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
      { value: 'panel', icon: ICONS.panel, label: t('opt_panel'), sub: t('opt_panel_sub') },
    ]));
    if (c.units > 0) add('contents', contentsEditor(placed));
    const devs = deviceEntries(mods);
    if (devs.length) add('devices', devicesEditor(devs));
    if (c.hasSpare) add('fill', fillEditor());
  }
  const fills = panel ? [v.panel_fill] : c.zones;
  const usesPatch = fills.includes('keystone') || (!panel && mods.includes('patch'));
  const usesButtons = fills.includes('buttons') || (!panel && mods.includes('buttons'));
  const usesFans = fills.includes('fan40') || (!panel && mods.includes('fan40'));
  if (usesFans) add('fans', segmented('fan40_count', [1, 2, 3], (x) => `${x} × 40 mm`), segmented('fan40_t', [10, 20], (x) => `${x} mm`));
  if (usesPatch) add('ports', portsEditor(panel && v.panel_u > 1 ? 12 : 6));
  if (usesButtons) add('buttons', buttonsEditor());
  add('screw', chips('rack_screw', SCREWS, String),
    h('div', { className: 'chips small' }, FIXINGS.map((f) => choice('rack_fixing', f, t('fix_' + f), { tip: tipOf('fixing:' + f) }))));
  if (v.part === 'assembly') add('preview', previewEditor());
  $('#steps').replaceChildren(...list);
  $('#examplesList').replaceChildren(examplesEditor());
}

function contentsEditor(placed) {
  const mods = placed.map((p) => p.m);
  const units = placed.reduce((n, p) => n + p.u, 0);
  const set = (k, val) => { const m = [...mods]; m[k] = val; update({ rack_modules: m.join(',') }); };
  return h('div', { className: 'rows' }, placed.map((p, k) => {
    const kind = modKind(p.m);
    const u = p.u > 1 ? `U${p.top + 1}–${p.top + p.u}` : `U${p.top + 1}`;
    const row = h('label', { className: 'row', dataset: { tip: tipOf('mod:' + kind) } },
      h('span', { className: 'u', textContent: p.top === 0 ? `${u} · ${t('top')}` : u }),
      // a 2U module is only offered where two units are left
      select(null, MODULES.map((x) => [x, t('mod_' + x), modU(x) > units - p.top]), kind, (val) => set(k, TRAYS[val] ? `${val}:${TRAYS[val].def}` : val)));
    return TRAYS[kind] ? [row, trayEditor(kind, modItems(p.m), (items) => set(k, `${kind}:${items.join('+')}`))] : row;
  }));
}

// the boxes of a KVM / Raspberry Pi tray, left to right, plus one empty slot to add another
function trayEditor(kind, items, onChange) {
  const T = TRAYS[kind];
  const slots = [];
  for (let i = 0; i < T.max && i <= items.length; i++) {
    // the empty slot reads "+ add"; in a filled one the same entry removes the box
    const opts = [...(i > 0 ? [['', t(items[i] ? 'box_remove' : 'box_none')]] : []), ...T.items.map((x) => [x, t('box_' + x)])];
    slots.push(select(null, opts, items[i] ?? '', (val) => {
      const next = [...items];
      if (val) next[i] = val; else next.splice(i);
      onChange(next.filter(Boolean));
    }));
  }
  const fits = trayFits(kind, items, S.values);
  return h('div', { className: 'tray' }, h('div', { className: 'tray-slots' }, slots),
    h('small', { className: `hint${fits ? '' : ' warn'}`, textContent: t(fits ? 'tray_' + kind : 'trayNoFit') }));
}

// smallest zone height (mm) each fill needs; the model warns too, the editor just won't offer what can't fit
const FILL_MIN = { fan80: 82, fan40: 41, keystone: 30, buttons: 22 };
const fillMin = (f) => FILL_MIN[f] ?? 6;

// The spare zone(s): where they go, how the height is shared, and what fills each one. A fill that does
// not fit at the current share but would fit at another one moves the share for you.
function fillEditor() {
  const v = S.values;
  const c = calc(v);
  const split = v.spare_pos === 'split';
  const zone = (param, other, height, label, setShare) => h('div', { className: 'zone' },
    h('div', { className: 'zone-head' }, h('b', { textContent: label }), h('span', { className: 'zone-size', dataset: { zone: param }, textContent: `${num(height)} mm` })),
    h('div', { className: 'chips' }, FILLS.map((f) => {
      const need = fillMin(f);
      const share = split ? setShare(need, fillMin(v[other])) : null;
      const fits = height >= need - 0.01 || share != null;
      return choice(param, f, t('fill_' + f), {
        disabled: !fits, flag: v[param] === f && height < need - 0.01 ? 'misfit' : '',
        tip: height >= need - 0.01 ? undefined : fits ? t('fillMoves', { n: need }) : t('fillTooSmall', { n: need, h: num(height) }),
        extra: () => (height < need - 0.01 && share != null ? { spare_split: share } : {}),
      });
    })));
  // splitting the strip: the fill you had keeps the height it needs (bottom zone), the new top zone gets the rest
  const where = h('div', { className: 'seg' }, ['top', 'bottom', 'split'].map((x) => choice('spare_pos', x, t('pos_' + x), {
    cls: 'seg-btn',
    extra: (val) => {
      if (val !== 'split' || split) return {};
      const sh = Math.min(0.8, Math.max(0.5, fillMin(v.spare_fill) / c.spare + 0.004));
      return { spare_split: Math.round(sh * 100) / 100, ...(c.spare * (1 - sh) < fillMin(v.spare_fill_2) - 0.01 ? { spare_fill_2: 'vent' } : {}) };
    },
  })));
  if (!split) return [where,
    zone('spare_fill', null, c.spare, t(v.spare_pos === 'top' ? 'fillTop' : 'fillBottom'), () => null)];
  // the bottom zone gets spare * split, the top one the rest; a share that gives `need` mm to one zone while
  // the other keeps `keep` mm, or null
  const shareFor = (bottom) => (need, keep) => {
    const sh = bottom ? need / c.spare + 0.004 : 1 - need / c.spare - 0.004;
    const other = bottom ? c.spare * (1 - sh) : c.spare * sh;
    return sh >= 0.2 && sh <= 0.8 && other >= keep - 0.01 ? Math.round(sh * 100) / 100 : null;
  };
  return [
    where,
    zone('spare_fill_2', 'spare_fill', c.spare * (1 - v.spare_split), t('fillTop'), shareFor(false)),
    h('div', { className: 'split' },
      h('input', { type: 'range', min: 0.2, max: 0.8, step: 0.01, value: v.spare_split, 'aria-label': t('fillShare'),
        // the zone heights follow the slider while you drag; the model updates when you let go
        oninput: (e) => {
          const sh = Number(e.target.value);
          for (const [z, x] of [['spare_fill', sh], ['spare_fill_2', 1 - sh]])
            $(`.zone-size[data-zone="${z}"]`).textContent = `${num(c.spare * x)} mm`;
        },
        onchange: (e) => update({ spare_split: Number(e.target.value) }) }),
      h('button', { type: 'button', className: 'pill', textContent: t('fillSwap'), dataset: { tip: t('fillSwapTip') },
        onclick: () => update({ spare_fill: v.spare_fill_2, spare_fill_2: v.spare_fill, spare_split: Math.round((1 - v.spare_split) * 100) / 100 }) })),
    zone('spare_fill', 'spare_fill_2', c.spare * v.spare_split, t('fillBottom'), shareFor(true)),
  ];
}

// an example replaces every setting any example touches, the rest (view, screws...) stays
function applyExample(k) {
  const reset = Object.fromEntries(EXAMPLE_KEYS.filter((x) => x in S.defaults).map((x) => [x, S.defaults[x]]));
  update({ ...reset, ...EXAMPLES[k], part: 'assembly' });
}
const exampleActive = (k, v = S.values) => Object.entries(EXAMPLES[k]).every(([key, x]) => same(v[key], x));

function examplesEditor() {
  return h('div', { className: 'chips' }, Object.keys(EXAMPLES).map((k) => h('button', {
    type: 'button', className: `chip${exampleActive(k) ? ' active' : ''}`, dataset: { tip: t('ex_' + k + '_tip') },
    onclick: () => applyExample(k),
  }, t('ex_' + k))));
}

// the sizes you can edit for the devices in the rack: { name (null = MS105G), title, tip }
function deviceEntries(mods) {
  const out = new Map();
  for (const m of mods) {
    const k = modKind(m);
    if (k === 'ms105g') out.set('ms', { name: null, title: t('mod_ms105g'), tip: 'mod:ms105g' });
    else if (k === 'kvm') for (const b of modItems(m)) out.set(KVM_DIMS[b], { name: KVM_DIMS[b], title: t('box_' + b), tip: 'mod:kvm' });
    else if (DEVICE_DIMS[k]) out.set(k, { name: DEVICE_DIMS[k][0], title: t(k === 'piblade' ? 'dev_bladePitch' : 'mod_' + k), tip: 'mod:' + k });
  }
  return [...out.values()].filter((e) => !e.name || S.params[e.name]);
}

// W x H x D of every device in the rack, editable
function devicesEditor(entries) {
  const v = S.values;
  const field = (val, set, label) => h('label', { className: 'dim' }, h('small', { textContent: label }),
    h('input', { type: 'number', step: 'any', min: 1, className: 'num', value: val, onchange: (e) => set(Number(e.target.value)) }));
  const MS = ['ms_w', 'ms_h', 'ms_d'];
  const rows = entries.map(({ name, title, tip }) => {
    let inputs;
    if (!name) inputs = MS.map((k, i) => field(v[k], (x) => update({ [k]: x }), t('dim_' + i)));
    else if (S.params[name].type === 'vector')
      inputs = v[name].map((x, i) => field(x, (nx) => { const a = [...v[name]]; a[i] = nx; update({ [name]: a }); }, t('dim_' + i)));
    else inputs = [field(v[name], (x) => update({ [name]: x }), t(name === 'pi_blade_pitch' ? 'dim_pitch' : 'dim_2'))];
    const changed = !name ? MS.some((k) => v[k] !== S.defaults[k]) : !same(v[name], S.defaults[name]);
    return h('div', { className: 'dev-row', dataset: { tip: tipOf(tip) } },
      h('div', { className: 'dev-title' }, h('b', { textContent: title }),
        changed ? h('button', { type: 'button', className: 'link', textContent: t('resetDims'),
          onclick: () => update(!name ? Object.fromEntries(MS.map((k) => [k, S.defaults[k]])) : { [name]: S.defaults[name] }) }) : null),
      h('div', { className: 'dims' }, inputs));
  });
  return [h('div', { className: 'devs' }, rows), h('small', { className: 'hint', textContent: t('devHint') })];
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
    h('div', { className: 'swatches', dataset: { tip: t('filamentTip') } },
      h('span', { className: 'label', textContent: t('filament') }),
      Object.entries(FILAMENTS).map(([name, hex]) => h('button', {
        type: 'button', className: `swatch${UI.filament === name ? ' active' : ''}`, title: t('fil_' + name),
        style: `--c:#${hex[0].toString(16).padStart(6, '0')}`,
        onclick: () => { UI.filament = name; saveUI(); viewer.setFilament(FILAMENTS[name]); renderSteps(); },
      }))),
    h('div', { className: 'toggles' },
      toggle(t('cables'), UI.cables, (on) => {
        UI.cables = on; saveUI(); viewer.setVisible('cables', on);
        $('#legend').hidden = !on || !$('#legend').childElementCount;
      }),
      toggle(t('sidePanel'), UI.side, (on) => { UI.side = on; saveUI(); viewer.setVisible('side', on); }),
      toggle(t('devices'), v.demo_devices === 'homelab', (on) => update({ demo_devices: on ? 'homelab' : 'generic' })),
      toggle(t('hardware'), v.show_hardware, (on) => update({ show_hardware: on })),
      toggle(t('sleeper'), UI.sleeper, (on) => { UI.sleeper = on; saveUI(); render(); }),
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
  if (v.part === 'rack_module') sub = select('module_type', mods.map((m) => [m, modLabel(m)]));
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
  } else if (p.widget === 'vector') {
    const boxes = p.value.map((_, i) => h('input', { type: 'number', step: 'any', className: 'num',
      onchange: () => set(boxes.map((b) => Number(b.value))) }));
    input = h('span', { className: 'vec' }, boxes);
    input.setValue = (x) => boxes.forEach((b, i) => { b.value = x[i]; });
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
    p.input?.closest('.param')?.classList.toggle('modified', !same(S.values[p.name], S.defaults[p.name]));
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
    return Object.keys(want).every((k) => VIEW_ONLY.has(k) || same(want[k], v[k]));
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
  for (const [k, x] of Object.entries(S.values)) if (!same(x, S.defaults[k])) q.set(k, Array.isArray(x) ? x.join(',') : String(x));
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
  const defs = definesFor(values);
  if (ext === '3mf') defs.push('web_scene=true');
  const res = await runJob(defs, 'out.' + ext);
  S.busy = false;
  try {
    showResult(res, ext, values);
  } catch (e) {
    console.error(e);
    setStatus(t('failed'), 'error');
  }
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
  const scene = { cables: [] };
  for (const l of res.logs) {
    const m = l.match(/^ECHO: "SCENE (.*)"$/);
    if (!m) continue;
    try {
      const d = JSON.parse(m[1]);
      if (d.cable) scene.cables.push(d.cable); else Object.assign(scene, d);
    } catch { /* ignore a malformed line */ }
  }
  if (UI.sleeper && scene.case) scene.case.style = 'sleeper';
  viewer.load(res.data.buffer, ext, { keepView: key === S.lastKey, focus, scene: ext === '3mf' ? scene : null });
  renderLegend($('#legend'), ext === '3mf' && UI.cables ? scene : null);
  $('#caseName').textContent = ext === '3mf' && scene.case ? scene.case.name : '';
  S.lastKey = key;
  if (S.result) URL.revokeObjectURL(S.result.url);
  S.result = { url: URL.createObjectURL(new Blob([res.data])), name: `bay2rack-${values.part}.${ext}` };
  $('#download').disabled = false;
  setStatus(t('rendered', { s: num(res.ms / 1000) }), 'ok');
}

function showEchoes(echoes, errors) {
  const bom = echoes.filter((e) => e.startsWith('BOM | ')).map((e) => e.slice(6));
  const warn = [...echoes.filter((e) => /^(WARNING|NOTE)/.test(e) && !/^NOTE: preview case/.test(e)), ...errors];
  $('#bom').replaceChildren(...(bom.length ? bom : [t('nothing')]).map((b) => {
    const [what, ...rest] = bomText(b).split(': ');
    return h('li', {}, rest.length ? [h('b', { textContent: what }), ' ' + rest.join(': ')] : what);
  }));
  $('#warnings').replaceChildren(...(warn.length ? warn : [t('allGood')]).map((w) =>
    h('li', { className: /^(WARNING|ERROR)/.test(w) ? 'warn' : /^NOTE/.test(w) ? 'note' : 'good',
              textContent: warnText(w.replace(/^(WARNING|NOTE): ?/, '')) })));
  // something does not fit: say so on the viewer itself, the list is further down
  const bad = warn.filter((w) => /^(WARNING|ERROR)/.test(w));
  const badge = $('#warnBadge');
  badge.hidden = !bad.length;
  badge.textContent = `⚠ ${t(bad.length === 1 ? 'warnOne' : 'warnMany', { n: bad.length })}`;
  badge.dataset.tip = bad.map((w) => warnText(w.replace(/^(WARNING|ERROR): ?/, ''))).join('\n');
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
    files.push({ name: `module-${modFile(m)}.stl`, qty: mods.filter((x) => x === m).length, part: { part: 'rack_module', module_type: m } });
  if (v.rear_slots) for (const k of ['lan', 'power'])
    files.push({ name: `pci-bracket-${k}.stl`, qty: 1, part: { part: 'pci_bracket', pci_kind: k } });
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
      Object.entries(v).filter(([k, x]) => !same(x, S.defaults[k]))), null, 2));
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

// ---------------------------------------------------------------- hero + gallery
// the hero film: plays while on screen, paused for reduced motion; the header goes dark over it
function wireHeroVideo() {
  const video = $('#heroVideo');
  const label = () => video.setAttribute('aria-label', t('hero_video_label'));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) { video.removeAttribute('autoplay'); video.pause(); }
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !still) video.play().catch(() => {}); else video.pause(); })
    .observe(video);
  const band = $('#top');
  const top = $('.top');
  const onScroll = () => top.classList.toggle('on-film', band.getBoundingClientRect().bottom > top.offsetHeight);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  label();
  return label;
}
let heroRelabel = null;

// dev only: save a build as GLB for the Blender video (docs/blender/)
if (import.meta.env.DEV) {
  window.__b2r.exportBuild = async (name, patch, opts = {}) => {
    const { exportBuild } = await import('./export-glb.js');
    const values = { ...S.defaults, ...patch };
    return exportBuild({ name, values, mods: usedMods(values, calc(values).units), runJob, definesFor,
      filament: FILAMENTS[UI.filament] ?? FILAMENTS.black, ...opts });
  };
}

// one line of facts for a build: bays, rack units and what fills the strip
function buildSpec(k) {
  const v = { ...S.defaults, ...EXAMPLES[k] };
  const c = calc(v);
  const mods = usedMods(v, c.units).filter((m) => m !== 'blank');
  return [
    t('spec_bays', { n: v.bays }),
    c.units > 0 ? t('spec_units', { n: c.units }) : t('opt_panel'),
    ...c.zones.map((z) => t('fill_' + z)),
    t('spec_mods', { n: mods.length }),
  ].join(' · ');
}

// the gallery is one row that scrolls sideways: the arrows move it by a card
const galleryStep = (dir) => {
  const g = $('#galleryGrid');
  g.scrollBy({ left: dir * (g.firstElementChild?.offsetWidth ?? 300), behavior: 'smooth' });
};
$('#galPrev').onclick = () => galleryStep(-1);
$('#galNext').onclick = () => galleryStep(1);

function renderGallery() {
  $('#galleryGrid').replaceChildren(...GALLERY.map((k) => {
    const v = { ...S.defaults, ...EXAMPLES[k] };
    const units = calc(v).units;
    return h('figure', { className: 'shot' },
      h('span', { className: 'shot-img' },
        h('img', { src: `${BASE}img/gallery/${k}.webp`, alt: t('ex_' + k), loading: 'lazy', decoding: 'async', width: 1200, height: 900,
          onerror: (e) => { e.target.style.visibility = 'hidden'; } }),
        h('span', { className: 'tape', textContent: units > 0 ? `${units}U` : t('opt_panel') })),
      h('figcaption', {},
        h('span', { className: 'spec', textContent: buildSpec(k) }),
        h('h4', { textContent: t('ex_' + k) }),
        h('p', { textContent: t('ex_' + k + '_tip') }),
        h('button', { type: 'button', className: 'load', onclick: () => { applyExample(k); $('#build').scrollIntoView(); } },
          t('gallery_load'), h('span', { 'aria-hidden': 'true', textContent: '→' }))));
  }));
}

// bays -> rack units, computed with the same rules as the configurator (and config.scad). The bar is to scale:
// one blue block per rack unit, grey for the strip left over, against the tallest stack (6 bays).
function renderBayTable() {
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

// ---------------------------------------------------------------- chrome
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  viewer.setTheme(th);
  $('#theme').replaceChildren(svgEl(th === 'dark' ? ICONS.sun : ICONS.moon));
  try { localStorage.setItem('theme', th); } catch { /* private mode */ }
}

function wire() {
  initTooltips($('#tip'));
  for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] ?? '';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || meta.content;
  let th = 'light';
  try { th = localStorage.getItem('theme') || 'light'; } catch { /* private mode */ }
  applyTheme(th);
  $('#theme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#lang').onclick = () => {
    setLang(lang === 'es' ? 'en' : 'es');
    $('#lang').textContent = lang === 'es' ? 'EN' : 'ES';
    buildAdvanced();
    refresh();
    renderGallery();
    renderBayTable();
    heroRelabel?.();
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
  $('#warnBadge').onclick = () => $('#warningsCard').scrollIntoView({ block: 'center' });
  $('#download').onclick = () => S.result && h('a', { href: S.result.url, download: S.result.name }).click();
  $('#kit').onclick = downloadKit;
  $('#share').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); setStatus(t('copied'), 'ok'); } catch { prompt('URL', location.href); }
  };
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') render(); });
  // a shared link opened in the same tab only changes the hash: load its settings
  addEventListener('hashchange', () => {
    if (location.hash === '#' + new URLSearchParams(Object.entries(S.values)
      .filter(([k, x]) => !same(x, S.defaults[k])).map(([k, x]) => [k, Array.isArray(x) ? x.join(',') : String(x)])).toString().replace(/%2C/g, ',')) return;
    if (!/=/.test(location.hash)) return;                       // plain section anchors (#build, #gallery…)
    S.values = { ...S.defaults };
    readHash();
    refresh();
    schedule(0);
  });
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
  viewer.setFilament(FILAMENTS[UI.filament] ?? FILAMENTS.black);
  viewer.show.cables = UI.cables;
  viewer.show.side = UI.side;
  wire();
  buildAdvanced();
  refresh();
  renderGallery();
  renderBayTable();
  heroRelabel = wireHeroVideo();
  S.wantRender = true;
  if (S.engine === 'ready') render();
}

boot();
