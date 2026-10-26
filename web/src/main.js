import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/martian-mono/standard.css';
import './style.css';
import { zipSync, strToU8, strFromU8, deflateSync, inflateSync } from 'three/addons/libs/fflate.module.js';
import { parseCustomizer, scadLiteral, fromPreset, same, clampValue } from './customizer.js';
import { t, lang, setLang, applyI18n } from './i18n.js';
import { stepHelp, optionHelp, paramLabel, paramHelp, bomText, warnText, optionLabel } from './help.js';
import { initTooltips } from './tooltip.js';
import { ICONS } from './icons.js';
import { EXAMPLES } from './examples.js';
import { renderLegend } from './legend.js';

// the site root (the scripts sit in assets/ next to it; in dev, in src/): the same bundle serves / and /es/
const BASE = new URL('../', import.meta.url).href;
const SITE = 'https://bay2rack.pages.dev/';                      // the links in the kit README
const VIEW_ONLY = new Set(['part', 'print_orientation', 'explode', 'case_view', 'case_model', 'case_window', 'show_devices',
  'demo_devices', 'show_hardware', 'section', 'scene', 'module_type', 'cover_type']);
const FILLS = ['keystone', 'buttons', 'fan80', 'fan40', 'vent', 'cable', 'label', 'blank'];
const MODULES = ['ms105g', 'uswflex', 'ux', 'kvm', 'nkvm', 'pi', 'piblade', 'dev1', 'dev2', 'shelf', 'patch', 'fan40', 'buttons',
  'vent', 'blank', 'cable', 'label'];
// trays that hold a list of boxes, written "kvm:jet+nano": choices, how many, default
const TRAYS = {
  kvm: { items: ['jet', 'nano', 'custom'], max: 3, def: 'jet+nano' },
  pi: { items: ['pi5', 'pi4', 'pi3', 'zero'], max: 2, def: 'pi5' },
  piblade: { items: ['pi5', 'pi4', 'pi3'], max: 4, def: 'pi5+pi5+pi5' },
  nkvm: { items: ['side', 'front', 'ks'], max: 1, def: 'side' },        // NanoKVM bay: which way the ports go
};
const KVM_DIMS = { jet: 'jetkvm_dims', nano: 'nanokvm_dims', custom: 'kvm_custom' };
// device modules -> the parameters holding their size (W, H, D)
const DEVICE_DIMS = {
  ms105g: ['ms_w', 'ms_h', 'ms_d'], uswflex: ['usw_dims'], ux: ['ux_dims'],
  dev1: ['dev1_dims'], dev2: ['dev2_dims'], shelf: ['shelf_depth'], piblade: ['pi_blade_pitch'], nkvm: ['nkvm_dims', 'nkvm_headroom'],
};
// an example also clears what you set inside the build (port names, buttons, label, NanoKVM bay…); your case,
// screws, fits, device sizes and the view stay
const CONTENT_KEYS = ['ks_ports', 'ks_names', 'ks_style', 'ks_labels', 'ks_label_start', 'label_text', 'label_size', 'label_align',
  'label_dx', 'label_dz', 'label_relief', 'label_depth', 'label_bold', 'vent_style', 'vent_margin', 'btn_type', 'btn_count',
  'btn_metal_d', 'btn_turbo', 'led_style', 'led_d', 'fan40_count', 'fan40_t', 'fan_guard', 'nkvm_keystones', 'nkvm_raised',
  'nkvm_cover', 'nkvm_split', 'kvm_boxes', 'pi_boards', 'units_override', 'bezel_depth', 'labels_multicolour'];
const EXAMPLE_KEYS = [...new Set([...Object.values(EXAMPLES).flatMap(Object.keys), ...CONTENT_KEYS])];
const GALLERY = ['router', 'kvm', 'pi', 'audio', 'client', 'network', 'unifi', 'bezel'];
// the builds that show a use of the project: its title, what it is for and what to buy
const USES = { router: 'router', kvm: 'kvm', pi: 'pi', audio: 'audio', client: 'clients' };
const PORTS = ['rj45m', 'rj45', 'hdmi', 'usb', 'rca', 'jack', 'toslink', 'cover', 'pass', 'none'];
const SCREWS = ['M3', 'M4', 'M5', 'M6', '10-32', '12-24'];
const FIXINGS = ['heatset', 'tap', 'nut_trap', 'square_nut', 'channel'];
const BAY_FIXINGS = ['heatset', 'tap', 'nut', 'clearance'];
const TESTS = ['test_bay', 'test_rack', 'test_keystone'];
// filament colours: [adapter, fillers, modules] - slightly different so the parts read apart
const FILAMENTS = {
  black: [0x26282c, 0x2e3035, 0x36383d], gray: [0x8a9098, 0x979da5, 0xa4aab2], white: [0xe6e6e1, 0xdcdcd6, 0xefefea],
  blue: [0x2d58a6, 0x3564b5, 0x3f70c2], red: [0xa83029, 0xb63c35, 0xc24841], green: [0x2d7a4c, 0x378858, 0x429564],
};
const UI_DEFAULT = { filament: 'black', custom: '#e07a2f', labelColour: '#f2f3ef', cables: true, side: true, sleeper: false };
const UI = (() => { try { return { ...UI_DEFAULT, ...JSON.parse(localStorage.getItem('ui') || '{}') }; } catch { return { ...UI_DEFAULT }; } })();
const saveUI = () => { try { localStorage.setItem('ui', JSON.stringify(UI)); } catch { /* private mode */ } };
// the colour of the printed parts: a preset, or your own (three close shades so the parts still read apart)
function filamentHexes() {
  const lab = parseInt(String(UI.labelColour).replace('#', ''), 16) || 0xf2f3ef;    // slot 3: multicolour letters
  if (UI.filament !== 'custom') return [...(FILAMENTS[UI.filament] ?? FILAMENTS.black), lab];
  const c = parseInt(String(UI.custom).replace('#', ''), 16) || 0x808080;
  const shade = (k) => [16, 8, 0].reduce((acc, sh) => acc | (Math.min(255, Math.round(((c >> sh) & 255) + (255 - ((c >> sh) & 255)) * k)) << sh), 0);
  return [shade(0), shade(0.06), shade(0.12), lab];
}
function setColour(name, hex) {
  UI.filament = name;
  if (hex) UI.custom = hex;
  saveUI();
  viewer?.setFilament(filamentHexes());
}

const $ = (s) => document.querySelector(s);
// phones and narrow windows: the one-screen configurator (the same query as in style.css)
const NARROW = '(max-width: 900px) and (max-aspect-ratio: 5/4)';
const h = (tag, { dataset, ...props } = {}, ...kids) => {
  // aria-* are attributes, not properties
  const aria = Object.entries(props).filter(([k]) => k.startsWith('aria-'));
  for (const [k] of aria) delete props[k];
  const e = Object.assign(document.createElement(tag), props);
  for (const [k, x] of aria) e.setAttribute(k, x);
  if (props.type === 'number') e.inputMode = 'decimal';          // the number keyboard on a phone
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
  opening: 122.1,           // the rack opening (mm), as the last render reported it
  notes: { insert: '' },    // notes shown in their step instead of the list
  leftOut: '',              // modules that do not fit in the rack (a note in the list too)
  lastEcho: null,           // the last render's messages, shown again in the other language
};

// ---------------------------------------------------------------- derived (mirrors config.scad)
function calc(v) {
  const U = v.rack_u_h, custom = v.bay_std === 'custom';
  const pitch = custom ? v.custom_bay_pitch : 43.18, bayH = custom ? v.custom_bay_h : 41.53;
  const bezel = v.front_style === 'bezel';
  const stack = (v.bays - 1) * pitch + bayH - v.height_clearance;
  const base = bezel ? (v.bays - 1) * pitch + v.bezel_h1 - v.bezel_clearance : stack;
  const flushUnits = Math.floor((base + 0.001) / U);
  const units = v.fit === 'panel' ? 0 : v.units_override > 0 ? v.units_override : v.fit === 'overhang' ? v.bays : flushUnits;
  const frameH = !bezel && v.fit === 'overhang' ? Math.max(units * U, base) : base;
  const spare = frameH - units * U;
  const hasSpare = spare >= v.min_spare;
  const zones = !hasSpare ? [] : v.spare_pos === 'split' ? [v.spare_fill, v.spare_fill_2] : [v.spare_fill];
  return { units, spare, hasSpare, zones, frameH, flushUnits, flushSpare: base - flushUnits * U, over: v.bays * U - base };
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
const DEVICE_MODS = ['ms105g', 'uswflex', 'ux', 'dev1', 'dev2'];
const modU = (m) => (modKind(m) === 'piblade' ? 2 : 1);
const modLabel = (m) => {
  const items = TRAYS[modKind(m)] ? modItems(m) : [];
  if (!MODULES.includes(modKind(m))) return String(m);
  if (modKind(m) === 'patch' && m.includes(':')) return `${t('mod_patch')} · ${t('nPorts', { n: patchOf(m).types.length })}`;
  if (modKind(m) === 'label' && m.includes(':')) return `${t('mod_label')} · «${labelOf(m)}»`;
  return t('mod_' + modKind(m)) + (items.length ? ` · ${items.map((x) => (TRAYS[modKind(m)].items.includes(x) ? t('box_' + x) : x)).join(' + ')}` : '');
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
// will these boxes fit side by side in one tray? (default M5 posts: 123.7 mm between them; OpenSCAD has the last word)
const OPENING = 123.7;
function trayFits(kind, items, v) {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  if (items.some((b) => !TRAYS[kind]?.items.includes(b))) return true;     // a box it does not know: the model says so
  if (kind === 'kvm') return sum(items.map((b) => v[KVM_DIMS[b]][0] + v.mount_clear)) + (items.length + 1) * v.mount_wall <= OPENING - 1
    && Math.max(...items.map((b) => v[KVM_DIMS[b]][1] + v.mount_clear)) + 2 * v.mount_wall <= v.rack_u_h - 0.79;
  if (kind === 'pi') return sum(items.map((b) => (b === 'zero' ? 65 : 56))) + (items.length - 1) * 3 <= OPENING - 6;
  if (kind === 'piblade') return (items.length - 1) * v.pi_blade_pitch + 2 + v.pi_standoff + 18.4 <= OPENING - 6;
  return true;
}

// plastic left between a rack fixing and the bay's steel side (rack_side_wall in config.scad): a nut as wide as an
// M6 one breaks through it, so those choices are off
const NUT_AF = { M3: 5.5, M4: 7, M5: 8, M6: 10, '6-32': 7.94, '10-32': 9.53, '12-24': 11.1 };
const TAP_D = { M3: 2.6, M4: 3.5, M5: 4.4, M6: 5.2, '6-32': 2.9, '10-32': 4.2, '12-24': 4.7 };
function sideWall(v, fixing = v.rack_fixing, screw = v.rack_screw) {
  const af = NUT_AF[screw] ?? 10;
  const feat = fixing === 'heatset' ? (v.rack_insert_d || INSERT_D[screw]) : fixing === 'tap' ? TAP_D[screw]
    : fixing === 'nut_trap' ? af / Math.cos(Math.PI / 6) + 0.3 : fixing === 'square_nut' ? af + 0.5 : af + 0.6;
  const slot = fixing === 'heatset' || fixing === 'tap' ? 0 : v.rack_hole_slot;
  return (146.05 - v.sleeve_clearance) / 2 - (134.925 / 2 + feat / 2 + slot / 2);
}
const fixingFits = (v, f, screw) => sideWall(v, f, screw) >= 1;
// the zones of the strip: [fill, height], bottom first (as config.scad)
function zoneList(v, c = calc(v)) {
  if (!c.hasSpare) return [];
  return v.spare_pos === 'split' ? [[v.spare_fill, c.spare * v.spare_split], [v.spare_fill_2, c.spare * (1 - v.spare_split)]]
    : [[v.spare_fill, c.spare]];
}
// the room a fill gets: a separate filler panel (or a 1U module) between the rack holes, a fill cut into the
// frame between the posts (the opening the model reports, which depends on the screws and their fixing)
const HW_CLEAR = { M3: 3.4, M4: 4.5, M5: 5.5, M6: 6.6, '6-32': 3.7, '10-32': 5.1, '12-24': 5.8 };
const panelW = (v) => 134.925 - (HW_CLEAR[v.rack_screw] ?? 6.6) - 6;
const zoneBox = (v, height) => (v.filler_mode === 'separate' ? [panelW(v), height - 0.8] : [S.opening - 2, height]);
const moduleBox = (v) => [panelW(v), v.rack_u_h - 0.79];
// how many keystones fit in w x h (ks_layout in fills.scad)
const isMetalPort = (x, v) => x === 'rj45m' || ((x === 'cover' || x === 'pass') && v.ks_style === 'metal');
function ksCapacity([w, h], v = S.values, types = ksTypes(v)) {
  const metal = types.some((x) => isMetalPort(x, v));
  const cw = metal ? v.ksm_w + 2 * v.ks_fit + 2 * v.ksm_wall : v.ks_w + 2 * v.ks_fit + 3;
  const px = metal ? v.ksm_pitch : v.ks_pitch;
  const cell = (metal ? v.ksm_cav_h + 2 * v.ks_fit + 2 * v.ksm_wall : v.ks_h + 2 * v.ks_fit + 7) + 1;
  return cw > w ? 0 : (Math.floor((w - cw) / px) + 1) * Math.max(0, Math.floor((h - 1) / cell));
}
// every place with the strip's patch panel ports (ks_ports_list), as [w, h]: keystone zones and bare patch modules
function ksPlaces(v, c = calc(v)) {
  return [...zoneList(v, c).filter(([f]) => f === 'keystone').map(([, hh]) => zoneBox(v, hh)),
    ...usedMods(v, c.units).filter((m) => m === 'patch').map(() => moduleBox(v))];
}
// every patch panel of the build with its own ports: [box, types, names]
function patchSets(v, c = calc(v)) {
  const names = String(v.ks_names ?? '').split(',').map((x) => x.trim());
  return [...ksPlaces(v, c).map((box) => [box, ksTypes(v), names]),
    ...usedMods(v, c.units).filter((m) => modKind(m) === 'patch' && m !== 'patch').map((m) => [moduleBox(v), patchOf(m).types, patchOf(m).names])];
}
// how many 40 mm fans fit side by side in w x h (fan40_pitch in fills.scad)
function fanMax([w, h]) {
  if (h < 41) return 0;
  const room = Math.min(w, S.opening - 1) - 40;
  return [3, 2, 1].find((n) => n === 1 || room / (n - 1) >= 40.3);
}
// what is written over each port (ks_label in fills.scad): its name, else HDMI / USB…, else the number of its place
const TYPE_NAMES = { hdmi: 'HDMI', usb: 'USB', rca: 'RCA', jack: 'AUDIO', toslink: 'OPTICAL' };
const isJack = (tp) => tp !== 'cover' && tp !== 'pass' && tp !== 'none';
function portLabels(v, types = ksTypes(v), names = String(v.ks_names ?? '').split(',').map((x) => x.trim())) {
  const start = Number(v.ks_label_start ?? 1);
  return types.map((tp, i) => names[i] || TYPE_NAMES[tp] || (isJack(tp) ? String(start + types.slice(0, i).filter(isJack).length) : ''));
}
// a patch module with its own ports, "patch:rj45m=NAS+hdmi+cover" (_ = a space in a name), and a label module with
// its own text, "label:MY_LAB"; a bare patch / label takes the strip's ks_ports_list / ks_names / label_text
// (patch_types / patch_names / label_of in config.scad)
const specText = (s) => String(s).replace(/[,:+="\\]/g, ' ').trim().replace(/\s+/g, '_');
const unscore = (s) => String(s).replace(/_/g, ' ').trim();
function patchOf(m, v = S.values) {
  const spec = String(m).split(':')[1];
  if (!spec) return { types: ksTypes(v), names: String(v.ks_names ?? '').split(',').map((x) => x.trim()) };
  const items = spec.split('+').filter(Boolean).map((x) => x.split('='));
  return { types: items.map(([tp]) => tp), names: items.map(([, n]) => unscore(n ?? '')) };
}
const patchSpec = (types, names) => 'patch:' + types.map((tp, i) => (specText(names[i] ?? '') ? `${tp}=${specText(names[i])}` : tp)).join('+');
const labelOf = (m, v = S.values) => (String(m).includes(':') ? unscore(String(m).slice(String(m).indexOf(':') + 1)) : String(v.label_text));
const labelSpec = (text) => 'label:' + (specText(text) || '_');

// ---------------------------------------------------------------- engine
// The 3D view (three.js) and the OpenSCAD engine (11 MB of WebAssembly) start when the configurator comes near the
// screen, so the page itself opens fast; a link with settings in it starts them at once.
let viewer = null;
let worker = null;
let engineStarted = null;
if (import.meta.env.DEV) window.__b2r = { S, EXAMPLES, applyExample: (k) => applyExample(k) };
function startEngine() {
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
    if (import.meta.env.DEV) window.__b2r.viewer = viewer;
  }).catch((e) => {
    console.warn(e);
    viewer = null;
    $('#view').replaceChildren(h('p', { className: 'no-view', textContent: t('noView') }));
  });
  return engineStarted;
}
const jobs = new Map();
let nextJob = 1;
function onEngine({ data: m }) {
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
const runJob = (defines, out) => new Promise((resolve) => {
  const id = nextJob++;
  jobs.set(id, resolve);
  worker.postMessage({ type: 'run', id, defines, out });
});
// the last renders, by their settings: going back to a piece or a view you had is instant
const done = new Map();
async function cachedJob(run, defines, out) {
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
let pool = null;
function kitEngines() {
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
const definesFor = (v) => Object.entries(v)
  .filter(([k, x]) => S.params[k] && (!same(x, S.defaults[k]) || k === 'part'))
  .map(([k, x]) => `${k}=${scadLiteral(S.params[k], x)}`);

function setStatus(text, kind = '') {
  const s = $('#status');
  s.textContent = text;
  s.className = 'status ' + kind;
}

// ---------------------------------------------------------------- state changes
// every value that comes in (steps, advanced form, link) stays inside its parameter's range
const clamped = (patch) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, S.params[k] ? clampValue(S.params[k], v) : v]));
// undo / redo: every change keeps the settings it came from (the last 60)
const past = [];
const future = [];
const snapshot = () => ({ ...S.values });
function restore(v) {
  S.values = { ...v };
  refresh();
  schedule(0);
}
function undo() { if (past.length) { future.push(snapshot()); restore(past.pop()); } }
function redo() { if (future.length) { past.push(snapshot()); restore(future.pop()); } }
function update(patch) {
  startEngine();
  past.push(snapshot());
  if (past.length > 60) past.shift();
  future.length = 0;
  Object.assign(S.values, clamped(patch));
  normalize(S.values);
  refresh();
  schedule();
}
// a choice another one made impossible moves to one that works
function normalize(v) {
  if (!fixingFits(v, v.rack_fixing, v.rack_screw)) v.rack_fixing = ['square_nut', 'heatset'].find((f) => fixingFits(v, f, v.rack_screw)) ?? 'heatset';
  const c = calc(v);
  const fanPlaces = [...zoneList(v, c).filter(([f]) => f === 'fan40').map(([, hh]) => fanMax(zoneBox(v, hh))),
    ...(usedMods(v, c.units).includes('fan40') ? [fanMax(moduleBox(v))] : [])];
  if (fanPlaces.length) v.fan40_count = Math.max(1, Math.min(v.fan40_count, ...fanPlaces.map((n) => Math.max(1, n))));
}
function refresh() {
  const focus = focusPath();
  // one part failing (a hand-written link with something odd in it) must not leave the rest out of date
  for (const f of [renderSteps, renderTabs, syncAdvanced, showPrebuilt, writeHash]) {
    try { f(); } catch (e) { console.error(e); }
  }
  restoreFocus(focus);
}
// where the focus is inside the steps or the tabs, as child indexes, to put it back after they are drawn again
function focusPath() {
  const el = document.activeElement;
  const box = el?.closest?.('#steps, #tabs');
  if (!box || el === box) return null;
  const path = [];
  for (let n = el; n !== box; n = n.parentElement) path.unshift([...n.parentElement.children].indexOf(n));
  return { box: '#' + box.id, path, tag: el.tagName, type: el.type };
}
function restoreFocus(f) {
  if (!f) return;
  let n = $(f.box);
  for (const i of f.path) n = n?.children[i];
  if (n && n.tagName === f.tag && n.type === f.type) n.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- small widgets
const tipOf = (key) => optionHelp(key) || undefined;

// a choice that is off stays tappable: the tap shows why (tooltip.js), it changes nothing
function choice(param, value, content, { cls = 'chip', tip, extra, disabled = false, flag = '' } = {}) {
  const active = S.values[param] === value;
  const b = h('button', {
    type: 'button', className: `${cls}${active ? ' active' : ''}${flag ? ' ' + flag : ''}${disabled ? ' off' : ''}`,
    onclick: () => { if (!disabled) update({ [param]: value, ...(extra ? extra(value) : {}) }); },
    dataset: { tip }, 'aria-pressed': String(active),
  }, content, disabled && tip ? h('span', { className: 'sr-only', textContent: `: ${tip}` }) : null);
  if (disabled) b.setAttribute('aria-disabled', 'true');
  return b;
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
      help ? h('button', { type: 'button', className: 'info', 'aria-label': `${t('aria_info')}: ${t('step_' + key)}`, textContent: 'i' }) : null),
    h('div', { className: 'body' }, body));
}

// a step most people can leave as it is: closed, what it is set to on its title line, open when you want it
// (and it stays open across the re-renders, and the next visit)
const openSteps = new Set(Array.isArray(UI.open) ? UI.open : []);
function foldStep(n, key, summary, ...body) {
  const help = stepHelp(key);
  const d = h('details', { className: 'step fold', open: openSteps.has(key) },
    h('summary', { dataset: { tip: help || undefined, tipTitle: t('step_' + key) } },
      h('span', { className: 'step-num', textContent: n }), h('h3', { textContent: t('step_' + key) }),
      h('span', { className: 'fold-sum', textContent: summary })),
    h('div', { className: 'body' }, body));
  d.addEventListener('toggle', () => {
    if (d.open) openSteps.add(key); else openSteps.delete(key);
    UI.open = [...openSteps];
    saveUI();
  });
  return d;
}
// the fits you tune after the test prints (tolerancesEditor): how many are not as they come
const TOL_KEYS = ['sleeve_clearance', 'height_clearance', 'bezel_clearance', 'ks_fit', 'cover_clear', 'mount_clear', 'rack_insert_d',
  'bay_insert_d', 'nkvm_insert_d', 'mx_cut'];

// ---------------------------------------------------------------- simple mode
function renderSteps() {
  S.leftOut = '';
  const v = S.values;
  const c = calc(v);
  const list = [];
  let n = 0;
  const add = (key, ...body) => list.push(step(++n, key, ...body));
  const fold = (key, summary, ...body) => list.push(foldStep(++n, key, summary, ...body));
  const group = (key) => list.push(h('h4', { className: 'step-group', textContent: t('grp_' + key) }));
  const placed = placeMods(v, c.units);
  const mods = placed.map((p) => p.m);

  // 0. what you want in the bays: a front with a fan or buttons, sockets, or a rack for devices
  group('start');
  add('intent', intentEditor(c));
  // 1. the case: how many bays, which front, how the rack units sit
  group('case');
  add('bays', segmented('bays', [1, 2, 3, 4, 5, 6], String), h('small', { className: 'hint', textContent: t('bays_hint') }));
  add('front', cards('front_style', [
    { value: 'plate', icon: ICONS.plate, label: t('opt_plate'), sub: t('opt_plate_sub') },
    { value: 'bezel', icon: ICONS.bezel, label: t('opt_bezel'), sub: t('opt_bezel_sub') },
  ], (x) => ({ filler_mode: x === 'bezel' ? 'integral' : 'separate' })),
    v.front_style === 'bezel' ? sliderRow('bezel_depth', t('bezel_depth_l')) : h('small', { className: 'hint', textContent: t('front_hint') }));
  add('fit', cards('fit', [
    { value: 'flush', icon: ICONS.flush, label: t('opt_flush'), sub: t(c.flushUnits ? 'inside_v' : 'inside_v0', { u: c.flushUnits, s: num(c.flushSpare) }) },
    { value: 'overhang', icon: ICONS.overhang, label: t('opt_overhang'), sub: `${v.bays}U · ${t('sticksOut')} ${num(c.over)}\u00a0mm` },
    { value: 'panel', icon: ICONS.panel, label: t('opt_panel'), sub: t('opt_panel_sub') },
  ], (x) => (x === 'panel' ? { rear_slots: false, ...(v.spare_fill === 'keystone' ? { spare_fill: 'vent' } : {}) } : {})));
  // 2. what goes in it: the rack units, the devices, the leftover strip and what fills it
  group('contents');
  // the PCI brackets go in the kit whatever is in front: the switch sits in the first step of this group
  const rear = toggle(t('rearSlots'), v.rear_slots, (on) => update({ rear_slots: on }));
  if (c.units > 0) add('contents', contentsEditor(placed), h('small', { className: 'hint', textContent: t('contents_hint') }), rear);
  const devs = deviceEntries(mods);
  if (devs.length) fold('devices', devs.map((e) => e.title).join(', '), devicesEditor(devs));
  if (c.hasSpare) add(c.units > 0 ? 'fill' : 'fill_panel', fillEditor(), c.units > 0 ? null : rear);
  const fills = c.zones;
  if (fills.includes('fan40') || mods.includes('fan40')) {
    // as many fans as the narrowest place with fans takes
    const max = Math.max(1, Math.min(...[...zoneList(v, c).filter(([f]) => f === 'fan40').map(([, hh]) => fanMax(zoneBox(v, hh))),
      ...(mods.includes('fan40') ? [fanMax(moduleBox(v))] : [])]));
    add('fans', rowTitle('fans_count'), h('div', { className: 'seg' }, [1, 2, 3].map((x) => choice('fan40_count', x, `${x} × 40\u00a0mm`,
      { cls: 'seg-btn', disabled: x > max, tip: x > max ? t('fansMax', { n: max }) : undefined }))),
      rowTitle('fans_thick'), segmented('fan40_t', [10, 20], (x) => `${x}\u00a0mm`));
  }
  // the strip's patch panel (and a bare patch module); a patch module with its own ports edits them in its row
  if (fills.includes('keystone') || mods.includes('patch')) add('ports', portsEditor(6));
  if (fills.includes('buttons') || mods.includes('buttons')) add('buttons', buttonsEditor());
  if (fills.includes('label') || mods.some((m) => modKind(m) === 'label')) add('label', labelEditor(fills.includes('label') || mods.includes('label')));
  if (fills.includes('vent') || mods.includes('vent'))
    add('vent', segmented('vent_style', ['slots', 'louvres', 'hex', 'dots'], (x) => t('vent_' + x)), sliderRow('vent_margin', t('vent_margin')));
  // 3. making it: screws, and the fits to tune after printing the test pieces
  group('make');
  // (a panel-only front cut into the frame has no rack screws)
  const rackScrews = c.units > 0 || (v.filler_mode === 'separate' && c.zones.length > 0);
  const noIron = v.rack_fixing !== 'heatset' && v.bay_fixing !== 'heatset';
  fold('screw', rackScrews ? `${v.rack_screw} · ${t('fix_' + v.rack_fixing)}` : `${v.bay_screw} · ${t('fixb_' + v.bay_fixing)}`,
    toggle(t('noIron'), noIron, (on) => update(on
      ? { rack_screw: fixingFits(v, 'square_nut', v.rack_screw) ? v.rack_screw : 'M5', rack_fixing: 'square_nut', bay_fixing: 'nut' }
      : { rack_screw: S.defaults.rack_screw, rack_fixing: 'heatset', bay_fixing: 'heatset' })),
    h('small', { className: 'hint', textContent: t(noIron ? 'noIronOn' : 'screwEasy') }),
    rackScrews ? [h('b', { className: 'row-head', textContent: t('screwRack') }),
      rowTitle('screwSize'), chips('rack_screw', SCREWS, String),
      rowTitle('screwFix'),
      h('div', { className: 'chips small' }, FIXINGS.map((f) => {
        const fits = fixingFits(v, f, v.rack_screw);
        return choice('rack_fixing', f, t('fix_' + f), { disabled: !fits,
          tip: fits ? tipOf('fixing:' + f) : t('fixNoWall', { s: v.rack_screw, w: num(Math.max(0, sideWall(v, f))),
            x: ['M5', 'M4', 'M3'].filter((sz) => fixingFits(v, f, sz)).slice(0, 2).join(lang === 'es' ? ' o ' : ' or ') }) });
      })),
      S.notes.insert && v.rack_fixing === 'heatset' ? h('small', { className: 'hint note' }, S.notes.insert + ' ',
        v.rack_screw === 'M6' ? h('button', { type: 'button', className: 'link', textContent: t('useM5'), onclick: () => update({ rack_screw: 'M5' }) }) : null) : null] : null,
    h('b', { className: 'row-head', textContent: t('screwBay') }),
    rowTitle('screwSize'), chips('bay_screw', ['M3', '6-32'], String),
    rowTitle('screwFix'),
    h('div', { className: 'chips small' }, BAY_FIXINGS.map((f) => choice('bay_fixing', f, t('fixb_' + f), { tip: tipOf('fixb:' + f) }))),
    h('small', { className: 'hint', textContent: t('screwBuy') }));
  const tolChanged = TOL_KEYS.filter((k) => k in S.defaults && !same(v[k], S.defaults[k])).length;
  fold('tol', tolChanged ? t('sum_changed', { n: tolChanged }) : t('sum_default'), tolerancesEditor(mods, fills));
  fold('multi', t(v.labels_multicolour ? 'sum_on' : 'sum_off'), multicolourEditor());
  group('view');
  fold('colour', t('fil_' + UI.filament), colourEditor());
  if (v.part === 'assembly') fold('preview', t('scene_' + v.scene), previewEditor());
  $('#steps').replaceChildren(...list);
  // the kit can be downloaded from the first step on: the bar at the foot of the steps says so
  const pieces = kitList(v).reduce((a, f) => a + f.qty, 0);
  $('#kitBar').textContent = t('kitBar', { n: pieces });
  $('#examplesList').replaceChildren(...examplesEditor());
}

const rowTitle = (key) => h('small', { className: 'row-title', textContent: t(key) });

// a slider + number box for one parameter, with its range from the .scad
function sliderRow(name, label) {
  const p = S.params[name];
  const v = S.values[name];
  const box = h('input', { type: 'number', className: 'num', min: p.min, max: p.max, step: p.step ?? 1, value: v,
    onchange: () => update({ [name]: Number(box.value) }) });
  const range = h('input', { type: 'range', min: p.min, max: p.max, step: p.step ?? 1, value: v,
    oninput: () => { box.value = range.value; },
    onchange: () => update({ [name]: Number(range.value) }) });
  return h('label', { className: 'param', dataset: { tip: paramHelp(p) || undefined } },
    h('span', { className: 'name', textContent: label }), h('span', { className: 'slider' }, range, box));
}

// the engraved label: what it says, how big, where, and whether it goes into or out of the panel
// (the text here is the strip's; a label module says its own, written in its row)
function labelEditor(withText = true) {
  const v = S.values;
  const text = h('input', { type: 'text', className: 'text label-text', value: v.label_text, maxLength: 40,
    placeholder: 'HOMELAB', onchange: () => update({ label_text: text.value }) });
  return [
    withText ? h('label', { className: 'param' }, h('span', { className: 'name', textContent: t('lab_text') }), text) : null,
    segmented('label_relief', ['engraved', 'raised'], (x) => t('relief_' + x)),
    segmented('label_align', ['left', 'center', 'right'], (x) => t('align_' + x)),
    sliderRow('label_size', t('lab_size')),
    sliderRow('label_dx', t('lab_dx')),
    sliderRow('label_dz', t('lab_dz')),
    sliderRow('label_depth', t('lab_depth')),
    toggle(t('lab_bold'), v.label_bold, (on) => update({ label_bold: on })),
  ];
}

// the colour of your filament: the presets and a picker for any other one
function colourEditor() {
  const picker = h('input', { type: 'color', value: UI.custom, 'aria-label': t('fil_custom'),
    oninput: () => { setColour('custom', picker.value); label.classList.add('active'); },
    onchange: () => renderSteps() });
  const label = h('label', { className: `swatch custom${UI.filament === 'custom' ? ' active' : ''}`, title: t('fil_custom'),
    style: `--c:${UI.custom}` }, picker);
  const swatches = h('div', { className: 'swatches', dataset: { tip: t('filamentTip') } },
    Object.entries(FILAMENTS).map(([name, hex]) => h('button', {
      type: 'button', className: `swatch${UI.filament === name ? ' active' : ''}`, title: t('fil_' + name),
      style: `--c:#${hex[0].toString(16).padStart(6, '0')}`,
      onclick: () => { setColour(name); renderSteps(); },
    })), label);
  return swatches;
}

// multicolour: the letters print in a second filament, from their own STL files in the kit
function multicolourEditor() {
  const multi = S.values.labels_multicolour;
  const lc = h('input', { type: 'color', value: UI.labelColour, 'aria-label': t('labelColour'),
    oninput: () => { UI.labelColour = lc.value; saveUI(); viewer?.setFilament(filamentHexes()); lcs.style.setProperty('--c', lc.value); } });
  const lcs = h('span', { className: 'swatch custom active', style: `--c:${UI.labelColour}` }, lc);
  return [toggle(t('multicolour'), multi, (on) => update({ labels_multicolour: on })),
    multi ? h('label', { className: 'param' }, h('span', { className: 'name', textContent: t('labelColour') }), lcs) : null,
    h('small', { className: 'hint', textContent: t(multi ? 'multicolourHint' : 'multicolourOff') })];
}

// heat-set insert holes of the hardware table (standards.scad), shown when the parameter is 0
const INSERT_D = { M3: 4.2, M4: 5.6, M5: 6.4, M6: 8, '6-32': 4.4, '10-32': 6.4, '12-24': 7.1 };
// the fits that depend on your printer: print the test pieces first, then move these
function tolerancesEditor(mods, fills) {
  const v = S.values;
  const keystones = fills.includes('keystone') || mods.some((m) => modKind(m) === 'patch' || modKind(m) === 'nkvm');
  const devices = mods.some((m) => m !== 'blank' && !FILLS.includes(modKind(m)) && modKind(m) !== 'patch');
  const covers = patchSets(v).some(([, types]) => types.some((x) => x === 'cover' || x === 'pass'));
  // [parameter, label, step, the test piece that checks it]
  const rows = [
    ['sleeve_clearance', 'tol_sleeve', 0.05, 'test_bay'],
    ['height_clearance', 'tol_height', 0.05, 'test_bay'],
    ...(v.front_style === 'bezel' ? [['bezel_clearance', 'tol_bezel', 0.05, 'test_bay']] : []),
    ...(keystones ? [['ks_fit', 'tol_ks', 0.05, 'test_keystone']] : []),
    ...(covers ? [['cover_clear', 'tol_cover', 0.05, 'test_keystone']] : []),
    ...(devices ? [['mount_clear', 'tol_mount', 0.1, null]] : []),
    ...(v.rack_fixing === 'heatset' ? [['rack_insert_d', 'tol_insert', 0.05, 'test_rack']] : []),
    ...(v.bay_fixing === 'heatset' ? [['bay_insert_d', 'tol_bay_insert', 0.05, 'test_bay']] : []),
    ...(mods.some((m) => modKind(m) === 'nkvm') ? [['nkvm_insert_d', 'tol_nkvm_insert', 0.05, 'first']] : []),
    ...((fills.includes('buttons') || mods.includes('buttons')) && v.btn_type === 'mx' ? [['mx_cut', 'tol_mx', 0.05, 'test_button']] : []),
  ];
  return h('div', { className: 'tol' },
    h('small', { className: 'hint', textContent: t('tol_hint') }),
    rows.map(([name, label, stepv, test]) => {
      const p = S.params[name];
      // an insert hole at 0 means "the table value": show that value, so lowering it works
      const shown = name.endsWith('_insert_d') && !v[name] ? INSERT_D[name === 'rack_insert_d' ? v.rack_screw : name === 'bay_insert_d' ? v.bay_screw : 'M3'] : v[name];
      const box = h('input', { type: 'number', className: 'num', step: stepv, min: p?.min, max: p?.max, value: shown,
        onchange: (e) => update({ [name]: Number(e.target.value) }) });
      return h('label', { className: 'param', dataset: { tip: paramHelp(p) || undefined } },
        h('span', { className: 'name' }, t(label), h('small', { className: 'tol-test',
          textContent: test === 'first' ? t('tol_first') : test ? t('tol_test', { x: t(test).toLowerCase() }) : t('tol_device') })), box);
    }));
}

const openPorts = new Set();          // the rack units whose patch panel ports are open
function contentsEditor(placed) {
  const mods = placed.map((p) => p.m);
  const units = placed.reduce((n, p) => n + p.u, 0);
  const set = (k, val) => { const m = [...mods]; m[k] = val; update({ rack_modules: m.join(',') }); };
  // modules of the list that are not in the rack any more (fewer bays, a 2U one at the bottom)
  const list = splitList(S.values.rack_modules);
  const left = list.filter((m, i) => m !== 'blank' && placed[i]?.m !== m);
  const firstNkvm = placed.findIndex((p) => modKind(p.m) === 'nkvm');
  const rows = placed.map((p, k) => {
    const kind = modKind(p.m);
    const u = p.u > 1 ? `U${p.top + 1}–${p.top + p.u}` : `U${p.top + 1}`;
    const row = h('label', { className: 'row', dataset: { tip: tipOf('mod:' + kind) } },
      h('span', { className: 'u', textContent: p.top === 0 ? `${u}\u00a0·\u00a0${t('top')}` : u }),
      // a 2U module is only offered where two units are left
      select(null, MODULES.map((x) => [x, modU(x) > units - p.top ? `${t('mod_' + x)} ${t('needs2U')}` : t('mod_' + x), modU(x) > units - p.top]),
        kind, (val) => set(k, TRAYS[val] ? `${val}:${TRAYS[val].def}`
          // a new patch panel / label starts as a copy of the strip's, then it is its own
          : val === 'patch' ? patchSpec(ksTypes(S.values), patchOf('patch').names) : val === 'label' ? labelSpec(S.values.label_text) : val)));
    if (kind === 'patch') {
      const own = patchOf(p.m);
      const names = own.names.filter(Boolean);
      const d = h('details', { className: 'tray tray-ports', open: openPorts.has(k) },
        h('summary', { textContent: `${t('nPorts', { n: own.types.length })}${names.length ? ' · ' + names.join(', ') : ''} · ${t('portsEdit')}` }),
        portsEditor(6, { ...own, set: (types, nm) => set(k, patchSpec(types, nm)) }));
      d.addEventListener('toggle', () => { if (d.open) openPorts.add(k); else openPorts.delete(k); });
      return [row, d];
    }
    if (kind === 'label') {
      const text = h('input', { type: 'text', className: 'text label-text', value: labelOf(p.m), maxLength: 40, placeholder: 'HOMELAB',
        'aria-label': `${t('lab_text')} · ${u}`, onchange: () => set(k, labelSpec(text.value)) });
      return [row, h('div', { className: 'tray' }, h('label', { className: 'param' }, h('span', { className: 'name', textContent: t('lab_text') }), text))];
    }
    // the NanoKVM bays share their settings: the first one shows them, the others say so
    return TRAYS[kind] ? [row, trayEditor(kind, modItems(p.m), (items) => set(k, `${kind}:${items.join('+')}`), kind === 'nkvm' && k !== firstNkvm)] : row;
  });
  S.leftOut = left.length ? t('modsLeftOut', { s: left.map(modLabel).join(', '), n: S.values.bays }) : '';
  return [h('div', { className: 'rows' }, rows), S.leftOut ? h('small', { className: 'hint warn', textContent: S.leftOut }) : null];
}

const withTitle = (sel, key) => { sel.dataset.title = key; return sel; };
// the boxes of a KVM / Raspberry Pi tray, left to right, plus one empty slot to add another
function trayEditor(kind, items, onChange, shared = false) {
  const T = TRAYS[kind];
  const slots = [];
  for (let i = 0; i < T.max && i <= items.length; i++) {
    // the empty slot reads "+ add"; in a filled one the same entry removes the box
    const opts = [...(i > 0 ? [['', t(items[i] ? 'box_remove' : 'box_none')]] : []), ...T.items.map((x) => [x, t('box_' + x)])];
    const sel = select(null, opts, items[i] ?? '', (val) => {
      const next = [...items];
      if (val) next[i] = val; else next.splice(i);
      onChange(next.filter(Boolean));
    });
    sel.setAttribute('aria-label', `${t('mod_' + kind)} · ${i + 1}`);
    slots.push(sel);
  }
  // the NanoKVM bay can also take one or two keystones on its plate
  if (kind === 'nkvm' && !shared) {
    // keystones beside it (none standing in front: its plugs take the width; ks always has its own)
    if (items[0] !== 'side')
      slots.push(withTitle(select(null, (items[0] === 'ks' ? [1, 2] : [0, 1, 2]).map((n) => [n, t('nkvm_ks' + n)]),
        String(Math.max(items[0] === 'ks' ? 1 : 0, S.values.nkvm_keystones)), (val) => update({ nkvm_keystones: Number(val) })), 'nkvmKeystones'));
    // standing in front: a frame or a long lid, and the plate printed apart (three pieces)
    // three pieces (plate apart) for the standing one and the drawer
    if (items[0] === 'front') slots.push(withTitle(select(null, [['0', t('nkvm_pieces2')], ['1', t('nkvm_pieces3')]], S.values.nkvm_split ? '1' : '0',
      (val) => update({ nkvm_split: val === '1' })), 'nkvmPieces'));
    if (items[0] === 'side') {
      // out of the case in a little mountain (plug in from outside), or in a pocket of the plate
      slots.push(withTitle(select(null, [['1', t('nkvm_raised1')], ['0', t('nkvm_raised0')]], S.values.nkvm_raised ? '1' : '0',
        (val) => update({ nkvm_raised: val === '1' })), 'nkvmShape'));
      if (!S.values.nkvm_raised) slots.push(withTitle(select(null, [['1', t('nkvm_cover1')], ['0', t('nkvm_cover0')]], S.values.nkvm_cover ? '1' : '0',
        (val) => update({ nkvm_cover: val === '1' })), 'nkvmSides'));
      slots.push(withTitle(select(null, [['0', t('nkvm_pieces2')], ['1', t('nkvm_pieces3')]], S.values.nkvm_split ? '1' : '0',
        (val) => update({ nkvm_split: val === '1' })), 'nkvmPieces'));
    }
  }
  const fits = trayFits(kind, items, S.values);
  // (the NanoKVM bay's choices each get a small title over them)
  const titled = kind === 'nkvm' ? slots.map((sel, i) => h('label', { className: 'slot-titled' },
    h('small', { textContent: t(sel.dataset.title || 'nkvmMode') }), sel)) : slots;
  // the NanoKVM bay: what this version is, and in how many pieces
  const hint = !fits ? t('trayNoFit') : kind !== 'nkvm' ? t('tray_' + kind)
    : !TRAYS.nkvm.items.includes(items[0]) ? t('tray_nkvm_unknown')
    : `${t('nkvm_how_' + items[0])} ${t(items[0] === 'ks' ? 'nkvm_parts_ks' : S.values.nkvm_split ? 'nkvm_parts3' : 'nkvm_parts2')}${shared ? ' ' + t('nkvmShared') : ''}`;
  return h('div', { className: 'tray' }, h('div', { className: 'tray-slots' }, titled),
    h('small', { className: `hint${fits ? '' : ' warn'}`, textContent: hint }));
}

// smallest zone height (mm) each fill needs; the model warns too, the editor just won't offer what can't fit
// the height a fill needs, as the model checks it (a separate filler loses 0.8 mm to its clearance)
const FILL_MIN = { fan80: 82, fan40: 41 };
function fillMin(f) {
  const v = S.values;
  const sep = v.filler_mode === 'separate' ? 0.8 : 0;
  if (f === 'buttons') return sep + (v.btn_type === 'retro' ? 30 : v.btn_type === 'metal' ? Number(v.btn_metal_d) + 12 : v.mx_cut + 13);
  if (f === 'keystone') {
    const metal = ksTypes(v).some((x) => x === 'rj45m' || ((x === 'cover' || x === 'pass') && v.ks_style === 'metal'));
    return sep + 2 + (metal ? v.ksm_cav_h + 2 * v.ks_fit + 2 * v.ksm_wall : v.ks_h + 2 * v.ks_fit + 7);
  }
  return sep + (FILL_MIN[f] ?? 6);
}

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
      // the width too: not one keystone across, or not one 40 mm fan
      const box = zoneBox(v, height);
      const wide = f === 'keystone' ? ksCapacity([box[0], 1e3], v) > 0 : f === 'fan40' ? fanMax([box[0], 1e3]) > 0 : true;
      const fits = wide && (height >= need - 0.01 || share != null);
      const misfit = v[param] === f && (height < need - 0.01 || !wide);
      // picking the fans: as many as fit side by side
      const fans = f === 'fan40' ? fanMax([box[0], 1e3]) : 3;
      return choice(param, f, [misfit ? '⚠ ' : '', t('fill_' + f)], {
        disabled: !fits, flag: misfit ? 'misfit' : '',
        tip: height >= need - 0.01 && wide ? tipOf('fill:' + f) : !wide ? t('fillTooNarrow', { w: num(box[0]) })
          : fits ? t('fillMoves', { n: num(need) }) : t('fillTooSmall', { n: num(need), h: num(height) }),
        extra: () => ({ ...(height < need - 0.01 && share != null ? { spare_split: share } : {}),
          ...(f === 'fan40' && v.fan40_count > fans ? { fan40_count: Math.max(1, fans) } : {}) }),
      });
    })));
  // splitting the strip: the fill you had keeps the height it needs (bottom zone), the new top zone gets the rest
  const canSplit = split || (fillMin(v.spare_fill) <= 0.8 * c.spare + 0.01 && c.spare * 0.2 >= fillMin('vent') - 0.01);
  const where = h('div', { className: 'seg' }, ['top', 'bottom', 'split'].map((x) => choice('spare_pos', x, t('pos_' + x), {
    cls: 'seg-btn', disabled: x === 'split' && !canSplit, tip: x === 'split' && !canSplit ? t('splitNoRoom', { f: t('fill_' + v.spare_fill) }) : undefined,
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
  // on a phone the examples sit above the configurator: bring it into view
  if (matchMedia(NARROW).matches) { $('#examples').open = false; $('.workbench').scrollIntoView({ behavior: 'smooth' }); }
}
// the first question: a front with a fan or buttons (no rack), sockets on the front, or a rack for devices. It keeps
// your bays and front, and sets the fit and what goes in for that
function intentOf(v) {
  if (v.fit !== 'panel') return 'rack';
  return [v.spare_fill, ...(v.spare_pos === 'split' ? [v.spare_fill_2] : [])].includes('keystone') ? 'ports' : 'simple';
}
function intentPatch(k, v = S.values) {
  const keep = { filler_mode: v.front_style === 'bezel' ? 'integral' : 'separate' };
  if (k === 'simple') return v.bays >= 3
    ? { fit: 'panel', filler_mode: 'integral', spare_pos: 'split', spare_split: 0.67, spare_fill: 'fan80', spare_fill_2: 'buttons', rear_slots: false }
    : { fit: 'panel', filler_mode: 'integral', spare_pos: 'top', spare_fill: v.bays >= 2 ? 'fan80' : 'vent', rear_slots: false };
  if (k === 'ports') return { fit: 'panel', filler_mode: 'integral', spare_pos: 'top', spare_fill: 'keystone', rear_slots: true };
  return { ...keep, fit: 'flush', spare_pos: 'top', spare_fill: 'keystone', rack_modules: S.defaults.rack_modules, rear_slots: true };
}
function intentEditor() {
  const cur = intentOf(S.values);
  return [h('div', { className: 'cards' }, ['simple', 'ports', 'rack'].map((k) => h('button', {
    type: 'button', className: `card-btn${cur === k ? ' active' : ''}`, 'aria-pressed': String(cur === k),
    onclick: () => update(intentPatch(k)),
  }, svgEl(ICONS[k === 'simple' ? 'panel' : k === 'ports' ? 'plate' : 'flush']), h('strong', { textContent: t('intent_' + k) }),
  h('small', { textContent: t('intent_' + k + '_sub') })))),
  h('small', { className: 'hint' }, t('intent_hint') + ' ', h('a', { href: '#glossary', textContent: t('gloss_link') }))];
}
const exampleActive = (k, v = S.values) => Object.entries(EXAMPLES[k]).every(([key, x]) => same(v[key], x));

function examplesEditor() {
  return [h('div', { className: 'chips' }, Object.keys(EXAMPLES).map((k) => h('button', {
    type: 'button', className: `chip${exampleActive(k) ? ' active' : ''}`, dataset: { tip: t('ex_' + k + '_tip') },
    onclick: () => applyExample(k),
  }, t('ex_' + k)))), savedEditor()];
}

// your builds, kept in this browser: a name, the settings (as in a link) and when
const loadSaved = () => { try { return JSON.parse(localStorage.getItem('saved') || '[]'); } catch { return []; } };
const storeSaved = (list) => { try { localStorage.setItem('saved', JSON.stringify(list)); } catch { /* private mode */ } };
function savedEditor() {
  const list = loadSaved();
  const here = hashString();
  const name = h('input', { type: 'text', className: 'text saved-name', maxLength: 40, placeholder: describeView({ ...S.values, part: 'assembly' }).slice(0, 40),
    'aria-label': t('savedName') });
  const save = () => {
    const entry = { name: name.value.trim() || name.placeholder, hash: here, at: new Date().toISOString().slice(0, 10) };
    storeSaved([entry, ...list.filter((x) => x.hash !== here)].slice(0, 30));
    $('#examplesList').replaceChildren(...examplesEditor());
  };
  return h('div', { className: 'saved' },
    h('small', { className: 'row-title', textContent: t('savedTitle') }),
    list.length ? h('div', { className: 'chips' }, list.map((x) => h('span', { className: `chip saved-chip${x.hash === here ? ' active' : ''}` },
      h('button', { type: 'button', className: 'link', textContent: x.name, dataset: { tip: x.at },
        onclick: () => { location.hash = x.hash; } }),
      h('button', { type: 'button', className: 'link saved-del', textContent: '×', 'aria-label': `${t('savedDelete')}: ${x.name}`,
        onclick: () => { storeSaved(list.filter((y) => y !== x)); $('#examplesList').replaceChildren(...examplesEditor()); } }))))
      : h('small', { className: 'hint', textContent: t('savedNone') }),
    h('div', { className: 'saved-new' }, name, h('button', { type: 'button', className: 'pill', textContent: t('savedSave'), onclick: save })));
}

// the sizes you can edit for the devices in the rack: { name (null = MS105G), title, tip }
function deviceEntries(mods) {
  const out = new Map();
  for (const m of mods) {
    const k = modKind(m);
    if (k === 'ms105g') out.set('ms', { name: null, title: t('mod_ms105g'), tip: 'mod:ms105g' });
    else if (k === 'kvm') for (const b of modItems(m)) if (KVM_DIMS[b]) out.set(KVM_DIMS[b], { name: KVM_DIMS[b], title: t('box_' + b), tip: 'mod:kvm' });
    else if (DEVICE_DIMS[k]) out.set(k, { name: DEVICE_DIMS[k][0], title: t(k === 'piblade' ? 'dev_bladePitch' : 'mod_' + k), tip: 'mod:' + k });
  }
  return [...out.values()].filter((e) => !e.name || S.params[e.name]);
}

// W x H x D of every device in the rack, editable
function devicesEditor(entries) {
  const v = S.values;
  const field = (val, set, label) => h('label', { className: 'dim' }, h('small', { textContent: label }),
    h('input', { type: 'number', step: 'any', min: 1, className: 'num', value: val, onchange: (e) => set(Number(e.target.value)) }));
  // (update() keeps every size inside its parameter's range; the box then shows the kept value)
  const MS = ['ms_w', 'ms_h', 'ms_d'];
  const rows = entries.map(({ name, title, tip }) => {
    let inputs;
    if (!name) inputs = MS.map((k, i) => field(v[k], (x) => update({ [k]: x }), t('dim_' + i)));
    else if (S.params[name].type === 'vector')
      // the NanoKVM is given as length, height, width (it lies on its side)
      inputs = v[name].map((x, i) => field(x, (nx) => { const a = [...v[name]]; a[i] = nx; update({ [name]: a }); },
        t(name === 'nkvm_dims' ? ['dim_len', 'dim_1', 'dim_0'][i] : 'dim_' + i)));
    else inputs = [field(v[name], (x) => update({ [name]: x }), t(name === 'pi_blade_pitch' ? 'dim_pitch' : 'dim_2'))];
    const changed = !name ? MS.some((k) => v[k] !== S.defaults[k]) : !same(v[name], S.defaults[name]);
    return h('div', { className: 'dev-row', dataset: { tip: tipOf(tip) } },
      h('div', { className: 'dev-title' }, h('b', { textContent: title }),
        changed ? h('button', { type: 'button', className: 'link', textContent: t('resetDims'),
          onclick: () => update(!name ? Object.fromEntries(MS.map((k) => [k, S.defaults[k]])) : { [name]: S.defaults[name] }) }) : null),
      h('div', { className: 'dims' }, inputs));
  });
  return [h('div', { className: 'devs' }, rows), h('small', { className: 'hint', textContent: t('devHint', { n: num(S.values.mount_clear) }) })];
}

// own = a patch module's own ports { types, names, set(types, names) }; without it, the strip's
function portsEditor(most, own = null) {
  const v = S.values;
  const types = own ? own.types : ksTypes(v);
  // as many as the smallest patch panel takes (all of them are left out when they do not fit)
  // (none at all: the strip is too small for a patch panel, the Leftover strip step says so)
  const cap = own ? ksCapacity(moduleBox(v), v, types) : Math.min(...ksPlaces(v).map((box) => ksCapacity(box, v)));
  const max = cap < 1 ? most : Math.min(most, cap);
  const setTypes = own ? (list) => own.set(list, own.names) : (list) => update({ ks_ports_list: list.join(','), ks_ports: list.length });
  const cycle = (i, dir) => {
    const list = [...types];
    list[i] = PORTS[(PORTS.indexOf(list[i]) + dir + PORTS.length) % PORTS.length];
    setTypes(list);
  };
  return [
    h('div', { className: 'ports' },
      types.map((tp, i) => h('label', {
        className: `port port-${tp}`, dataset: { tip: tipOf('port:' + tp), tipTitle: `${i + 1} · ${t('port_' + tp)}` },
      }, h('b', { textContent: i + 1 }), h('span', { textContent: t('port_' + tp) }),
        // an invisible list over the port: tap it and pick the type
        h('select', { className: 'port-pick', 'aria-label': `${t('portType')} ${i + 1}`,
          onchange: (e) => { const list = [...types]; list[i] = e.target.value; setTypes(list); } },
          PORTS.map((x) => h('option', { value: x, textContent: t('port_' + x), selected: x === tp }))))),
      h('span', { className: 'port-ctl' },
        h('button', { type: 'button', className: `mini${types.length >= max ? ' off' : ''}`, textContent: '+', 'aria-disabled': String(types.length >= max),
          dataset: { tip: types.length >= max ? t('portMax', { n: max }) : t('portAdd') },
          onclick: () => { if (types.length < max) setTypes([...types, v.ks_style === 'metal' ? 'rj45m' : 'rj45']); } }),
        h('button', { type: 'button', className: 'mini', textContent: '−', disabled: types.length <= 1,
          dataset: { tip: t('portRemove') }, onclick: () => setTypes(types.slice(0, -1)) }))),
    cap >= 1 && types.length > cap ? h('small', { className: 'hint warn', textContent: t('portsTooMany', { n: types.length, m: cap }) })
      : h('small', { className: 'hint', textContent: t('portHint') }),
    // the RJ45 ports follow the type (metal cells or plastic cut-outs), so do the covers (one setting for all)
    own ? null : [rowTitle('ks_style_t'), h('div', { className: 'seg' }, ['metal', 'standard'].map((x) => choice('ks_style', x, t('ks_' + x), {
      cls: 'seg-btn',
      extra: () => (String(v.ks_ports_list).trim()
        ? { ks_ports_list: types.map((tp) => (tp === 'rj45m' || tp === 'rj45' ? (x === 'metal' ? 'rj45m' : 'rj45') : tp)).join(',') } : {}),
    }))),
    h('small', { className: 'hint', textContent: t('ks_hint') })],
    portNames(types, own),
  ];
}

// what is written over each port: your name, else HDMI / USB... for those jacks, else the number of its place
function portNames(types, own = null) {
  const v = S.values;
  const names = own ? own.names : String(v.ks_names ?? '').split(',').map((x) => x.trim());
  const auto = portLabels(v, types, []);
  const set = (i, val) => {
    const list = types.map((_, j) => (j === i ? val.replace(/,/g, ' ').trim() : names[j] ?? ''));
    if (own) return own.set(types, list);
    while (list.length && !list[list.length - 1]) list.pop();
    update({ ks_names: list.join(',') });
  };
  return h('div', { className: 'port-names' },
    h('small', { className: 'hint', textContent: t('portNamesHint') }),
    h('div', { className: 'port-name-grid' }, types.map((tp, i) => h('input', {
      type: 'text', className: 'text port-name', maxLength: 12, value: names[i] ?? '', placeholder: auto[i],
      'aria-label': `${t('portName')} ${i + 1}`, onchange: (e) => set(i, e.target.value) }))));
}

function buttonsEditor() {
  const v = S.values;
  return [
    cards('btn_type', ['mx', 'metal', 'retro'].map((x) => ({ value: x, label: t('btnType_' + x), sub: t('btnType_' + x + '_sub') }))),
    rowTitle('btn_count_t'), segmented('btn_count', [1, 2], (x) => t('btn_' + x)),
    v.btn_type === 'metal' ? [rowTitle('btn_metal_d_t'), segmented('btn_metal_d', [12, 16, 19, 22], (x) => `${x} mm`)] : null,
    v.btn_type === 'retro' ? [toggle(t('btnTurbo'), v.btn_turbo, (on) => update({ btn_turbo: on })),
      v.btn_turbo ? h('small', { className: 'hint', textContent: t('turboHint') }) : null] : null,
    v.btn_type === 'mx'
      ? [rowTitle('led_style_t'), cards('led_style', ['ring', 'halo', 'glow'].map((s) => ({ value: s, label: t('led_' + s), sub: t('led_' + s + '_sub'), tip: tipOf('led:' + s) })))]
      : null,
    rowTitle('led_d_t'), segmented('led_d', [3, 5], (x) => t('led_' + x)),
    h('small', { className: 'hint', textContent: t('btnWiring') }),
  ];
}

function previewEditor() {
  const v = S.values;
  const caseOpts = [...S.params.case_model.options.map((o) => [o.value,
    o.value === 'auto' ? t('case_auto') : o.label.replace(/ - (\d+) bays$/, ` · $1 × ${num(5.25, 2)}"`)]), ['none', t('case_none')]];
  return [
    segmented('scene', ['homelab', 'single'], (x) => t('scene_' + x), stepHelp('scene')),
    select(null, caseOpts, v.case_view === 'none' ? 'none' : v.case_model,
      (val) => update(val === 'none' ? { case_view: 'none' } : { case_view: 'tower', case_model: val })),
    h('div', { className: 'toggles' },
      toggle(t('cables'), UI.cables, (on) => {
        UI.cables = on; saveUI(); viewer?.setVisible('cables', on);
        $('#legend').hidden = !on || !$('#legend').childElementCount;
      }),
      toggle(t('sidePanel'), UI.side, (on) => { UI.side = on; saveUI(); viewer?.setVisible('side', on); }),
      toggle(t('devices'), v.demo_devices === 'homelab', (on) => update({ demo_devices: on ? 'homelab' : 'generic' })),
      toggle(t('hardware'), v.show_hardware, (on) => update({ show_hardware: on })),
      toggle(t('sleeper'), UI.sleeper, (on) => { UI.sleeper = on; saveUI(); render(); }),
      toggle(t('explode'), v.explode > 0, (on) => update({ explode: on ? 25 : 0 }))),
  ];
}

// ---------------------------------------------------------------- tabs (what to view / download)
// what only says which piece the piece view shows
const PIECE_KEYS = ['module_type', 'cover_type', 'btn_cap', 'pci_kind'];
// one row per piece of the kit, with a name that says what it is
function pieceLabel(f, v) {
  const p = f.part;
  const qty = f.qty > 1 ? ` × ${f.qty}` : '';
  if (p.part === 'adapter') {
    const c = calc(v);
    const w = v.front_style === 'bezel' ? 148 - v.bezel_clearance : 148;
    return `${t('piece_adapter')} · ${t('onBed', { w: num(w, 0), h: num(c.frameH, 0) })}`;
  }
  if (p.part === 'filler' || p.part === 'filler_2') {
    const z = calc(v).zones[p.part === 'filler' ? 0 : 1];
    return `${t(p.part === 'filler' ? 'piece_filler' : 'piece_filler2')} · ${t('fill_' + z)}`;
  }
  // a device's tray reads "Mount for…", so it is clear the device itself is not printed
  if (p.part === 'rack_module') return (DEVICE_MODS.includes(modKind(p.module_type)) ? t('piece_mount', { x: modLabel(p.module_type) })
    : modKind(p.module_type) === 'nkvm' && v.nkvm_split && ['side', 'front'].includes(modItems(p.module_type)[0])
      ? `${modLabel(p.module_type)} · ${t('piece_plate')}` : ownIndex(p.module_type, v)
        ? numbered(modLabel(p.module_type), ownIndex(p.module_type, v)) : modLabel(p.module_type)) + qty;
  if (p.part.endsWith('_labels')) return `${t('piece_labels')} · ${p.part === 'filler_labels' ? t('piece_filler')
    : p.part === 'filler_2_labels' ? t('piece_filler2') : ownIndex(p.module_type, v)
      ? numbered(modLabel(p.module_type), ownIndex(p.module_type, v)) : modLabel(p.module_type)}`;
  if (p.part === 'rack_module_lid') return `${modLabel(p.module_type)} · ${t('piece_lid')}${qty}`;
  if (p.part === 'rack_module_bay') return `${modLabel(p.module_type)} · ${t(modItems(p.module_type)[0] === 'front' ? 'piece_drawer'
    : v.nkvm_raised ? 'piece_mountain' : 'piece_pocket')}${qty}`;
  if (p.part === 'pci_bracket') return t('piece_pci_' + p.pci_kind);
  if (p.part === 'button_cap') return `${t('piece_button')} · ${t('cap_' + p.btn_cap)}${qty}`;
  if (p.part === 'button_carrier') return `${t('piece_carrier')}${qty}`;
  if (p.part === 'keystone_cover') return `${t('piece_cover')} · ${t('cover_' + p.cover_type)}${qty}`;
  if (p.part.startsWith('test_')) return `${t('piece_test')} · ${t(p.part)}`;
  return f.name;
}

function renderTabs() {
  const v = S.values;
  const pieces = kitList(v, true);
  const isPiece = (f) => Object.entries(f.part).every(([k, x]) => v[k] === x);
  const current = pieces.findIndex(isPiece);
  const tab = (label, active, onclick, tip) => h('button', {
    type: 'button', className: `tab${active ? ' active' : ''}`, onclick, dataset: { tip }, role: 'tab', 'aria-selected': String(active),
  }, t(label));
  const mounted = v.part === 'assembly';
  if (!mounted && current < 0 && pieces.length) {
    Object.assign(v, Object.fromEntries(PIECE_KEYS.map((k) => [k, S.defaults[k]])), pieces[0].part);
    schedule();
    return renderTabs();
  }
  const tabs = [
    tab('view_assembly', mounted, () => update({ part: 'assembly', ...Object.fromEntries(PIECE_KEYS.map((k) => [k, S.defaults[k]])) }), tipOf('part:assembly')),
    tab('view_pieces', !mounted, () => update({ ...pieces[Math.max(0, current)].part }), tipOf('part:pieces')),
  ];
  let sub = null;
  if (!mounted) {
    const sel = h('select', { className: 'select piece-select', 'aria-label': t('view_pieces'),
      onchange: () => update({ ...pieces[Number(sel.value)].part }) },
      pieces.map((f, i) => h('option', { value: i, textContent: pieceLabel(f, v) })));
    sel.value = String(Math.max(0, current));
    sub = sel;
  }
  $('#tabs').replaceChildren(...tabs, ...(sub ? [h('span', { className: 'tab-sub' }, sub)] : []));
  $('#download').textContent = mounted ? t('downloadPreview') : `${t('downloadPart')} (.stl)`;
}

// ---------------------------------------------------------------- advanced mode (every parameter)
function control(p) {
  const set = (val) => update({ [p.name]: val });
  let input;
  if (p.widget === 'select') {
    input = h('select', { className: 'select' }, p.options.map((o) => h('option', { value: o.value, textContent: optionLabel(p, o) })));
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
    const boxes = p.value.map((_, i) => h('input', { type: 'number', step: 'any', min: p.min, max: p.max, className: 'num',
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
// the settings that differ from the defaults; "," and "+" stay readable (kvm:jet+nano)
function hashString(values = S.values) {
  const q = new URLSearchParams();
  for (const [k, x] of Object.entries(values)) if (!same(x, S.defaults[k])) q.set(k, Array.isArray(x) ? x.join(',') : String(x));
  return '#' + q.toString().replace(/\+/g, '%20').replace(/%2C/g, ',').replace(/%2B/g, '+').replace(/%3A/g, ':').replace(/%3D/g, '=');
}
function writeHash() {
  history.replaceState(null, '', hashString());
}
// a short link: the same settings, deflated (#z=...) when that is shorter than the readable ones
const b64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
function shortHash(values = S.values) {
  const plain = hashString(values);
  const z = '#z=' + b64url(deflateSync(strToU8(plain.slice(1)), { level: 9 }));
  return z.length < plain.length ? z : plain;
}
function readHash() {
  let hash = location.hash.slice(1);
  if (hash.startsWith('z=')) {
    try { hash = strFromU8(inflateSync(unb64url(hash.slice(2)))); } catch { hash = ''; }
  }
  // a "+" in a link is a plus here (kvm:jet+nano), not a space
  for (const [k, s] of new URLSearchParams(hash.replace(/\+/g, '%2B')))
    if (S.params[k]) S.values[k] = clampValue(S.params[k], fromPreset(S.params[k], s));
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
  const res = await cachedJob(runJob, defs, 'out.' + ext);
  await engineStarted;                                  // (the 3D view loads alongside the engine)
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
  if (!res.ok) { setStatus(t('failed'), 'error'); $('#download').disabled = true; return; }
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
  viewer?.load(res.data.buffer, ext, { keepView: key === S.lastKey, focus, scene: ext === '3mf' ? scene : null });
  viewer?.setLabel(`${t('aria_view')} ${describeView(values)}`);
  S.lastScene = ext === '3mf' && UI.cables ? scene : null;
  renderLegend($('#legend'), S.lastScene);
  $('#caseName').textContent = ext === '3mf' && scene.case ? (UI.sleeper ? t('sleeperName') : scene.case.name) : '';
  S.lastKey = key;
  if (S.result) URL.revokeObjectURL(S.result.url);
  S.result = { url: URL.createObjectURL(new Blob([res.data])), name: `bay2rack-${values.part}.${ext}` };
  $('#download').disabled = false;
  setStatus(t('rendered', { s: num(res.ms / 1000) }), 'ok');
}

function showEchoes(echoes, errors) {
  S.lastEcho = [echoes, errors];
  const bom = echoes.filter((e) => e.startsWith('BOM | ')).map((e) => e.slice(6));
  // the rack opening (it moves with the screws and their fixing) sizes what the steps offer
  const opening = Number(echoes.find((e) => e.startsWith('bay2rack |'))?.match(/opening=([\d.]+)mm/)?.[1]);
  // the note on the thin wall of the rack inserts belongs to the Screws step, not to every build's list
  const insert = echoes.find((e) => /^NOTE: the rack inserts leave/.test(e));
  const notes = { insert: insert ? warnText(insert.slice(6)) : '' };
  if ((opening && Math.abs(opening - S.opening) > 0.01) || notes.insert !== S.notes.insert) {
    if (opening) S.opening = opening;
    S.notes = notes;
    renderSteps();
  }
  const warn = [...echoes.filter((e) => /^(WARNING|NOTE)/.test(e) && !/^NOTE: preview case/.test(e) && e !== insert), ...errors,
    ...(S.leftOut ? ['NOTE: ' + S.leftOut] : [])];
  $('#bom').replaceChildren(...bomGroups(bom));
  $('#warnings').replaceChildren(...(warn.length ? warn : [t('allGood')]).map((w) =>
    h('li', { className: /^(WARNING|ERROR)/.test(w) ? 'warn' : /^NOTE/.test(w) ? 'note' : 'good',
              textContent: warnText(w.replace(/^(WARNING|NOTE): ?/, '')) })));
  // something does not fit: say so on the viewer itself, the list is further down
  const bad = warn.filter((w) => /^(WARNING|ERROR)/.test(w));
  const badge = $('#warnBadge');
  badge.hidden = !bad.length;
  // (on a phone only the count, so the viewer's bar stays one row)
  badge.replaceChildren(`⚠ `, h('span', { className: 'badge-n', textContent: bad.length }),
    h('span', { className: 'badge-words', textContent: t(bad.length === 1 ? 'warnOne' : 'warnMany', { n: bad.length }) }));
  badge.setAttribute('aria-label', t(bad.length === 1 ? 'warnOne' : 'warnMany', { n: bad.length }));
  badge.dataset.tip = bad.map((w) => warnText(w.replace(/^(WARNING|ERROR): ?/, ''))).join('\n');
}

// the model's bill of materials sorted for a shopping trip: buy / print / tools / the devices you bring
const HEX_KEY = {
  button: { M3: 2, M4: 2.5, M5: 3, M6: 4, '6-32': '5/64"', '10-32': '1/8"', '12-24': '5/32"' },
  countersunk: { M3: 2, M4: 2.5, M5: 3, M6: 4, '6-32': '5/64"', '10-32': '1/8"', '12-24': '5/32"' },
  socket: { M3: 2.5, M4: 3, M5: 4, M6: 5, '6-32': '7/64"', '10-32': '5/32"', '12-24': '5/32"' },
};
function bomGroups(bom) {
  if (!bom.length) return [h('li', { textContent: t(S.values.part === 'assembly' ? 'nothing' : 'nothingPiece') })];
  const line = (b) => {
    const [what, ...rest] = bomText(b).split(': ');
    return h('li', {}, rest.length ? [h('b', { textContent: what }), ' ' + rest.join(': ')] : what);
  };
  const devices = bom.filter((b) => /^(devices|cables and power) /.test(b));
  const printed = bom.filter((b) => !devices.includes(b) && /^(rear slots:|keystones: \d+ x printed)/.test(b));
  const buy = bom.filter((b) => !devices.includes(b) && !printed.includes(b));
  // tools from what the screws and fixings are
  const all = buy.join('\n');
  const inserts = [...new Set([...all.matchAll(/x (M[\d.]+|#?\d+-\d+) heat-set insert/g)].map((m) => m[1]))];
  const keys = new Set();
  for (const m of all.matchAll(/x (M\d|\d+-\d+) x \S+ (button head|socket head|countersunk)/g)) {
    const k = HEX_KEY[m[2].split(' ')[0]]?.[m[1]];
    if (k) keys.add(typeof k === 'number' ? `${num(k)} mm` : k);
  }
  const tools = [
    inserts.length ? t('tool_iron', { s: inserts.join(', ') }) : null,
    keys.size ? t('tool_hex', { s: [...keys].join(', ') }) : null,
    /pan head/.test(all) ? t('tool_phillips') : null,
    /(hex|square) nut|screw \+ nut/.test(all) ? t('tool_spanner') : null,
    /cable tie/.test(all) ? t('tool_cutters') : null,
  ].filter(Boolean);
  // what the kit prints, when the whole build is on screen (it includes the printed covers and brackets of the list)
  const pieces = S.values.part === 'assembly' ? kitList(S.values, false).map((f) => pieceLabel(f, S.values)) : [];
  const group = (key, items) => (items.length ? [h('li', { className: 'bom-group', textContent: t(key) }), ...items] : []);
  return [
    ...group('bom_buy', buy.map(line)),
    ...group('bom_print', pieces.length ? pieces.map((x) => h('li', { textContent: x })) : printed.map(line)),
    ...group('bom_tools', tools.map((x) => h('li', { textContent: x }))),
    ...group('bom_devices', devices.map(line)),
  ];
}

// what the 3D view shows, in words (for screen readers): the build, or the piece
function describeView(v) {
  if (v.part !== 'assembly') {
    const f = kitList(v, true).find((x) => Object.entries(x.part).every(([k, val]) => v[k] === val));
    return f ? pieceLabel(f, v) : '';
  }
  const c = calc(v);
  const mods = usedMods(v, c.units).filter((m) => m !== 'blank').map(modLabel);
  return [t('spec_bays', { n: v.bays }), c.units ? t('spec_units', { n: c.units }) : null, ...mods,
    ...c.zones.map((z) => t('fill_' + z))].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------- kit download
// patch panels and labels with their own ports / text are numbered in the order they are in the rack (0 = not one)
// "Patch panel · 6 ports" -> "Patch panel 2 · 6 ports"; "Patch panel" -> "Patch panel 2"
const numbered = (label, n) => (label.includes(' · ') ? label.replace(' · ', ` ${n} · `) : `${label} ${n}`);
// (counting the bare patch / label too, so the names follow the rack: Patch panel 1, Patch panel 2…; 0 when it is the only one)
function ownIndex(m, v) {
  if (!['patch', 'label'].includes(modKind(m))) return 0;
  const all = [...new Set(usedMods(v, calc(v).units))].filter((x) => modKind(x) === modKind(m));
  return all.length > 1 ? all.indexOf(m) + 1 : 0;
}
function kitList(v, withTests = $('#withTests').checked) {
  const c = calc(v);
  const files = [{ name: 'adapter.stl', qty: 1, part: { part: 'adapter' } }];
  // a letters piece only where there are letters: some text, port names that fit, a button panel
  const types = ksTypes(v);
  const portsLettered = (box, ty = types, names = undefined) => v.ks_labels && portLabels(v, ty, names).some(Boolean)
    && ksCapacity(box, v, ty) >= ty.length;
  const lettered = (fill, box) => (fill === 'label' && String(v.label_text).trim() !== '') || fill === 'buttons'
    || (fill === 'keystone' && portsLettered(box));
  const zl = zoneList(v, c);
  if (v.filler_mode === 'separate' && zl.length) {
    files.push({ name: 'filler.stl', qty: 1, part: { part: 'filler' } });
    if (v.labels_multicolour && lettered(zl[0][0], zoneBox(v, zl[0][1]))) files.push({ name: 'filler-labels.stl', qty: 1, part: { part: 'filler_labels' } });
    if (zl.length > 1) {
      files.push({ name: 'filler-2.stl', qty: 1, part: { part: 'filler_2' } });
      if (v.labels_multicolour && lettered(zl[1][0], zoneBox(v, zl[1][1]))) files.push({ name: 'filler-2-labels.stl', qty: 1, part: { part: 'filler_2_labels' } });
    }
  }
  const mods = usedMods(v, c.units);
  const fileOf = (m) => (m.includes(':') && ['patch', 'label'].includes(modKind(m)) ? `${modKind(m)}-${ownIndex(m, v) || 1}` : modFile(m));
  for (const m of new Set(mods)) {
    const qty = mods.filter((x) => x === m).length;
    const modLettered = modKind(m) === 'label' ? labelOf(m, v) !== '' : modKind(m) === 'patch'
      ? portsLettered(moduleBox(v), patchOf(m, v).types, patchOf(m, v).names) : lettered(m, moduleBox(v));
    files.push({ name: `module-${fileOf(m)}.stl`, qty, part: { part: 'rack_module', module_type: m } });
    if (v.labels_multicolour && (modLettered
        || (v.ks_labels && modKind(m) === 'nkvm' && (modItems(m)[0] === 'side' ? v.nkvm_cover : modItems(m)[0] === 'ks' || v.nkvm_keystones > 0))))
      files.push({ name: `module-${fileOf(m)}-labels.stl`, qty, part: { part: 'rack_module_labels', module_type: m } });
    if (modKind(m) === 'nkvm') {
      files.push({ name: `module-${modFile(m)}-lid.stl`, qty, part: { part: 'rack_module_lid', module_type: m } });
      if (v.nkvm_split && ['side', 'front'].includes(modItems(m)[0]))
        files.push({ name: `module-${modFile(m)}-${modItems(m)[0] === 'front' ? 'drawer' : v.nkvm_raised ? 'mountain' : 'pocket'}.stl`, qty,
          part: { part: 'rack_module_bay', module_type: m } });
    }
  }
  const btnSets = c.zones.filter((z) => z === 'buttons').length + mods.filter((m) => m === 'buttons').length;
  if (btnSets && v.btn_type === 'retro') {
    for (const cap of ['power', ...(v.btn_count >= 2 ? ['reset'] : []), ...(v.btn_turbo ? ['turbo'] : [])])
      files.push({ name: `button-${cap}.stl`, qty: btnSets, part: { part: 'button_cap', btn_cap: cap } });
    files.push({ name: 'button-carrier.stl', qty: btnSets, part: { part: 'button_carrier' } });
  }
  if (v.rear_slots) for (const k of ['lan', 'power'])
    files.push({ name: `pci-bracket-${k}.stl`, qty: 1, part: { part: 'pci_bracket', pci_kind: k } });
  // covers only for the patch panels whose ports fit (the model leaves the others out), each with its own ports
  const sets = patchSets(v, c).filter(([box, ty]) => ksCapacity(box, v, ty) >= ty.length);
  for (const [kind, file] of [['cover', 'blank'], ['pass', 'pass']]) {
    const q = sets.reduce((n, [, ty]) => n + ty.filter((x) => x === kind).length, 0);
    if (q) files.push({ name: `keystone-${file}.stl`, qty: q, part: { part: 'keystone_cover', cover_type: file } });
  }
  const keystones = c.zones.includes('keystone') || mods.some((m) => modKind(m) === 'patch')
    || mods.some((m) => modKind(m) === 'nkvm' && (modItems(m)[0] === 'ks' || v.nkvm_keystones > 0));
  if (withTests) for (const x of [...TESTS.filter((x) => x !== 'test_keystone' || keystones), ...(btnSets ? ['test_button'] : [])])
    files.push({ name: `tests/${x}.stl`, qty: 1, part: { part: x } });
  return files;
}

async function downloadKit(testsOnly = false) {
  if (S.engine !== 'ready' || S.kitBusy) return;
  S.kitBusy = true;
  $('#kit').disabled = true;
  $('#kitBar').disabled = true;
  $('#kitTests').disabled = true;
  const v = { ...S.values };
  const listed = testsOnly ? kitList(v, true).filter((f) => f.name.startsWith('tests/')) : kitList(v);
  const files = [];
  const zip = {};
  try {
    // every engine takes the next piece until there are none left
    setStatus(t('kitStep', { i: 0, n: listed.length, name: listed[0]?.name ?? '' }), 'busy');
    const engines = [runJob, ...(await kitEngines())];
    const results = [];
    let next = 0;
    let finished = 0;
    await Promise.all(engines.map(async (run) => {
      while (next < listed.length) {
        const i = next++;
        results[i] = await cachedJob(run, definesFor({ ...v, ...listed[i].part }), 'out.stl');
        setStatus(t('kitStep', { i: ++finished, n: listed.length, name: listed[i].name }), 'busy');
      }
    }));
    for (const [i, f] of listed.entries()) {
      const res = results[i];
      // a letters piece with nothing in it (e.g. every port name blank) is left out, not a failure
      if (!res.ok && f.name.endsWith('-labels.stl') && res.logs.some((l) => /top level object is empty/i.test(l))) continue;
      files.push(f);
      if (!res.ok) { $('#log').textContent = res.logs.join('\n'); setStatus(t('kitFailed', { name: f.name }), 'error'); return; }
      zip['bay2rack/' + f.name] = res.data;
    }
    const bomRes = await cachedJob(runJob, definesFor({ ...v, part: 'assembly' }), 'out.echo');
    const echoText = [...bomRes.logs, ...(bomRes.data ? new TextDecoder().decode(bomRes.data).split(/\r?\n/) : [])];
    const bom = [...new Set(echoText.map((l) => l.match(/^ECHO: "BOM \| (.*)"$/)?.[1]).filter(Boolean))].map(bomText);
    const lines = [
      `${t('readme_title')} - ${new Date().toISOString().slice(0, 10)}`, '',
      t(testsOnly ? 'readme_tests' : 'readme_notes'), '',
      t('readme_printer'), '',
      t('readme_print'), ...files.filter((f) => f.name.startsWith('tests/')).map((f) => `  1. ${f.qty} x ${f.name}  (${t('readme_' + f.part.part)})`),
      ...files.filter((f) => !f.name.startsWith('tests/')).map((f) => `  2. ${f.qty} x ${f.name}`), '',
      t('readme_need'), ...bom.map((b) => `  - ${b}`), '',
      t('readme_guide'), `  https://github.com/abarriuso/bay2rack/blob/main/docs/BUILD${lang === 'es' ? '.es' : ''}.md`, '',
      t('readme_settings'), `  ${SITE}${hashString(v)}`, '',
      'https://github.com/abarriuso/bay2rack · CC BY-NC-SA 4.0', '',
    ];
    zip['bay2rack/README.txt'] = strToU8(lines.join('\n'));
    zip['bay2rack/settings.json'] = strToU8(JSON.stringify(Object.fromEntries(
      Object.entries(v).filter(([k, x]) => !same(x, S.defaults[k]))), null, 2));
    const blob = new Blob([zipSync(zip, { level: 6 })], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    h('a', { href: url, download: testsOnly ? 'bay2rack-tests.zip' : `bay2rack-kit-${v.bays}bay.zip` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus(t('kitDone', { n: files.length + 2 }), 'ok');
    $('#nextStep').hidden = false;
  } finally {
    S.kitBusy = false;
    $('#kit').disabled = false;
    $('#kitBar').disabled = false;
    $('#kitTests').disabled = false;
    if (S.wantRender) render();
  }
}

// ---------------------------------------------------------------- hero + gallery
// the hero film: its still is what you see first; the film loads after the page (960 px on phones, 1.1 MB instead
// of 3.4), plays while on screen, and stays a still for reduced motion or data saving
function wireHeroVideo() {
  const video = $('#heroVideo');
  const label = () => video.setAttribute('aria-label', t('hero_video_label'));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;
  const start = () => {
    if (matchMedia('(max-width: 900px)').matches)
      for (const s of video.querySelectorAll('source')) s.src = s.src.replace(/hero\.(webm|mp4)$/, 'hero-960.$1');
    video.preload = 'auto';
    video.autoplay = true;                              // (a play() right after load() can be dropped)
    video.load();
    new IntersectionObserver(([e]) => { if (e.isIntersecting) video.play().catch(() => {}); else video.pause(); })
      .observe(video);
  };
  if (!still) {
    if (document.readyState === 'complete') setTimeout(start, 300);
    else addEventListener('load', () => setTimeout(start, 300), { once: true });
  }
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
      filament: filamentHexes(), ...opts });
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
    mods.length ? t('spec_mods', { n: mods.length }) : null,
  ].filter(Boolean).join(' · ');
}

// the gallery is one row that scrolls sideways: the arrows move it by a card
const galleryStep = (dir) => {
  const g = $('#galleryGrid');
  g.scrollBy({ left: dir * (g.firstElementChild?.offsetWidth ?? 300), behavior: 'smooth' });
};
// drag the row with the mouse like a swipe (touch already swipes): it follows the pointer, then settles on a card;
// a drag is not a click on the card under it
{
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
    row.scrollTo({ left: Math.round(row.scrollLeft / (w + gap)) * (w + gap), behavior: 'smooth' });
    row.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, once: true });
  });
}
$('#galPrev').onclick = () => galleryStep(-1);
$('#galNext').onclick = () => galleryStep(1);

function renderGallery() {
  $('#galleryGrid').replaceChildren(...GALLERY.map((k) => {
    const v = { ...S.defaults, ...EXAMPLES[k] };
    const units = calc(v).units;
    return h('figure', { className: 'shot' },
      h('span', { className: 'shot-img' },
        // (a 640 px copy for the card size; the big one for sharp screens)
        h('img', { src: `${BASE}img/gallery/${k}.webp`, srcset: `${BASE}img/gallery/${k}-640.webp 640w, ${BASE}img/gallery/${k}.webp 1200w`,
          sizes: '(max-width: 600px) 82vw, 420px', alt: t('ex_' + k), loading: 'lazy', decoding: 'async', width: 1200, height: 900,
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

async function boot() {
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
