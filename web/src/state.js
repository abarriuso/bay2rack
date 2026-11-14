// Constants, the shared state (S), the per-browser view settings (UI) and the DOM helpers.
import { lang } from './i18n.js';
import { EXAMPLES } from './examples.js';

// the site root (the scripts sit in assets/ next to it; in dev, in src/): the same bundle serves / and /es/
export const BASE = new URL(/* @vite-ignore */ '../', import.meta.url).href;
export const SITE = 'https://bay2rack.pages.dev/';                      // the links in the kit README
export const VIEW_ONLY = new Set(['part', 'print_orientation', 'explode', 'case_view', 'case_model', 'case_window', 'show_devices',
  'demo_devices', 'show_hardware', 'section', 'scene', 'module_type', 'cover_type']);
export const FILLS = ['keystone', 'buttons', 'fan40', 'fan60', 'fan80', 'fan92', 'fan120', 'vent', 'cable', 'label', 'blank'];
export const MODULES = ['ms105g', 'uswflex', 'ux', 'kvm', 'nkvm', 'pi', 'piblade', 'dev1', 'dev2', 'patch', 'fan40', 'fan60', 'fan80', 'fan92', 'fan120', 'buttons',
  'vent', 'blank', 'cable', 'label'];
// trays that hold a list of boxes, written "kvm:jet+nano": choices, how many, default
export const TRAYS = {
  kvm: { items: ['jet', 'nano', 'custom'], max: 3, def: 'jet+nano' },
  pi: { items: ['pi5', 'pi4', 'pi3', 'zero'], max: 2, def: 'pi5' },
  piblade: { items: ['pi5', 'pi4', 'pi3'], max: 4, def: 'pi5+pi5+pi5' },
  nkvm: { items: ['side', 'ks'], max: 1, def: 'side' },                 // NanoKVM bay: standing outside, or behind a keystone
};
export const KVM_DIMS = { jet: 'jetkvm_dims', nano: 'nanokvm_dims', custom: 'kvm_custom' };
// device modules -> the parameters holding their size (W, H, D)
export const DEVICE_DIMS = {
  ms105g: ['ms_w', 'ms_h', 'ms_d'], uswflex: ['usw_dims'], ux: ['ux_dims'],
  dev1: ['dev1_dims'], dev2: ['dev2_dims'], piblade: ['pi_blade_pitch'], nkvm: ['nkvm_dims', 'nkvm_headroom'],
};
// an example also clears what you set inside the build (port names, buttons, label, NanoKVM bay…); your case,
// screws, fits, device sizes and the view stay
export const CONTENT_KEYS = ['ks_ports', 'ks_names', 'ks_style', 'ks_labels', 'ks_label_start', 'label_text', 'label_size', 'label_align',
  'label_dx', 'label_dz', 'label_relief', 'label_depth', 'label_bold', 'vent_style', 'vent_margin', 'btn_type', 'btn_count',
  'btn_metal_d', 'btn_turbo', 'led_style', 'led_d', 'fan_count', 'fan40_t', 'fan_guard', 'nkvm_keystones',
  'nkvm_split', 'kvm_boxes', 'pi_boards', 'units_override', 'bezel_depth', 'labels_multicolour'];
export const EXAMPLE_KEYS = [...new Set([...Object.values(EXAMPLES).flatMap(Object.keys), ...CONTENT_KEYS])];
export const GALLERY = ['router', 'kvm', 'pi', 'audio', 'client', 'network', 'unifi', 'bezel'];
// the builds that show a use of the project: its title, what it is for and what to buy
export const USES = { router: 'router', kvm: 'kvm', pi: 'pi', audio: 'audio', client: 'clients' };
export const PORTS = ['rj45m', 'rj45', 'hdmi', 'usb', 'rca', 'jack', 'toslink', 'cover', 'pass', 'none'];
export const SCREWS = ['M3', 'M4', 'M5', 'M6', '10-32', '12-24'];
export const FIXINGS = ['heatset', 'tap', 'nut_trap', 'square_nut', 'channel'];
export const BAY_FIXINGS = ['heatset', 'tap', 'nut', 'clearance'];
export const TESTS = ['test_bay', 'test_rack', 'test_keystone'];
// filament colours: [adapter, fillers, modules] - slightly different so the parts read apart
export const FILAMENTS = {
  beige: [0xafa995, 0xb4ae9a, 0xb9b39f], black: [0x26282c, 0x2e3035, 0x36383d], gray: [0x8a9098, 0x979da5, 0xa4aab2], white: [0xe6e6e1, 0xdcdcd6, 0xefefea],
  blue: [0x2d58a6, 0x3564b5, 0x3f70c2], red: [0xa83029, 0xb63c35, 0xc24841], green: [0x2d7a4c, 0x378858, 0x429564],
};
// What the configurator shows before anything is touched (an address without settings): the PC of the film - four
// bays in the homelab, a switch, the KVM on its side and a vent. Not the model's own defaults (those stay as the file
// has them, and are what a link leaves out).
export const START = { bays: 4, case_model: 'quiet_full', scene: 'homelab', rack_modules: 'uswflex,nkvm:side,vent', vent_style: 'dots' };
// (v: the sleeper case became the first look in 2, beige parts to go with it in 3; what an older visit stored about
// them does not count)
export const UI_DEFAULT = { v: 3, filament: 'beige', custom: '#e07a2f', labelColour: '#f2f3ef', cables: true, side: true, sleeper: true };
export const UI = (() => {
  try {
    const old = JSON.parse(localStorage.getItem('ui') || '{}');
    if (old.v !== UI_DEFAULT.v) { delete old.sleeper; delete old.filament; delete old.v; }
    return { ...UI_DEFAULT, ...old };
  } catch { return { ...UI_DEFAULT }; }
})();
export const saveUI = () => { try { localStorage.setItem('ui', JSON.stringify(UI)); } catch { /* private mode */ } };
// the colour of the printed parts: a preset, or your own (three close shades so the parts still read apart)
export function filamentHexes() {
  const lab = parseInt(String(UI.labelColour).replace('#', ''), 16) || 0xf2f3ef;    // slot 3: multicolour letters
  if (UI.filament !== 'custom') return [...(FILAMENTS[UI.filament] ?? FILAMENTS.black), lab];
  const c = parseInt(String(UI.custom).replace('#', ''), 16) || 0x808080;
  const shade = (k) => [16, 8, 0].reduce((acc, sh) => acc | (Math.min(255, Math.round(((c >> sh) & 255) + (255 - ((c >> sh) & 255)) * k)) << sh), 0);
  return [shade(0), shade(0.06), shade(0.12), lab];
}

export const $ = (s) => document.querySelector(s);
// phones and narrow windows: the one-screen configurator (the same query as in style.css)
export const CALM = matchMedia('(prefers-reduced-motion: reduce)');       // motion off, if the system asks
// The page at rest: the heavy steps of the 3D view (its start, a model laid out, its first draw - each holds the page
// for a moment) wait for a pause in the visitor's scroll, so a scroll seldom stutters on them; never more than `most`
// ms (a scroll that does not stop still gets its 3D view in time).
let moved = 0, still = false;
for (const e of ['scroll', 'wheel', 'touchstart', 'touchmove'])
  addEventListener(e, () => { if (!still || e === 'scroll') moved = performance.now(); }, { passive: true, capture: true });
// the page held still (film.js: the 3D view on its way): a wheel or a finger on it moves nothing - not a scroll
export function stillInput(on) { still = on; }
export function atRest(quiet = 150, most = 900) {
  const t0 = performance.now();
  return new Promise((ok) => {
    const check = () => {
      const now = performance.now();
      if (now - t0 > most) return ok();
      const wait = moved + quiet - now;
      if (wait > 0) return setTimeout(check, wait + 10);
      if (window.requestIdleCallback) requestIdleCallback(() => (performance.now() - moved < quiet ? check() : ok()), { timeout: 300 });
      else setTimeout(() => (performance.now() - moved < quiet ? check() : ok()), 0);
    };
    check();
  });
}
// Just after the next frame is drawn: what runs there has the whole frame before the next one to itself, so a slice of
// a long job done there never holds a frame of the page up - the scroll goes on as smooth while it runs. (A hidden tab
// draws no frames: the job waits until it is seen again.)
export const afterFrame = () => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
// A long job as a loop of small steps: a few ms of them per frame (`budget`), never a long task. A step that is a
// generator is taken a yield at a time (scene.js builds a case so).
export async function sliced(steps, budget = 6) {
  let t = performance.now();
  const turn = async () => { if (performance.now() - t > budget) { await afterFrame(); t = performance.now(); } };
  for (const step of steps) {
    await turn();
    const r = step();
    if (r && typeof r.next === 'function') while (!r.next().done) await turn();
  }
}
export const NARROW = '(max-width: 900px) and (max-aspect-ratio: 5/4)';
export const h = (tag, { dataset, ...props } = {}, ...kids) => {
  // aria-* (and role) are attributes, not properties (everywhere)
  const aria = Object.entries(props).filter(([k]) => k.startsWith('aria-') || k === 'role');
  for (const [k] of aria) delete props[k];
  const e = Object.assign(document.createElement(tag), props);
  for (const [k, x] of aria) e.setAttribute(k, x);
  if (props.type === 'number') e.inputMode = 'decimal';          // the number keyboard on a phone
  if (dataset) for (const [k, x] of Object.entries(dataset)) if (x != null) e.dataset[k] = x;
  e.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return e;
};
export const svgEl = (markup) => { const s = h('span', { className: 'ico' }); s.innerHTML = markup; return s; };
export const num = (x, d = 1) => Number(x).toLocaleString(lang, { maximumFractionDigits: d });

export const S = {
  sections: [], params: {}, defaults: {}, values: {}, presets: {}, catalog: null,
  engine: 'loading', busy: false, dirty: false, wantRender: false, kitBusy: false,
  result: null, lastKey: '', tests: 'test_bay',
  opening: 122.1,           // the rack opening (mm), as the last render reported it
  notes: { insert: '' },    // notes shown in their step instead of the list
  leftOut: '',              // modules that do not fit in the rack (a note in the list too)
  lastEcho: null,           // the last render's messages, shown again in the other language
  editFrom: null,           // where in the steps the last interaction was ({ target, at }), and
  pulse: null,              // the part of the edit waiting for its result (it flares in the 3D view)
};