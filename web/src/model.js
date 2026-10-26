// What the model will do, worked out in the page (mirrors config.scad): units, zones, what fits, the patch panels.
import { t } from './i18n.js';
import { MODULES, TRAYS, KVM_DIMS, S } from './state.js';
import { INSERT_D } from './editors.js';

// ---------------------------------------------------------------- derived (mirrors config.scad)
export function calc(v) {
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
export const splitList = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
export const ksTypes = (v) => (String(v.ks_ports_list).trim() ? splitList(v.ks_ports_list)
  : Array(Math.max(v.ks_ports, 1)).fill(v.ks_style === 'metal' ? 'rj45m' : 'rj45'));
// rack modules: "kvm:jet+nano" = kind kvm with two boxes; a bare kvm / pi takes kvm_boxes / pi_boards
export const modKind = (m) => { const k = String(m).split(':')[0]; return k === 'kvm2' ? 'kvm' : k; };
export function modItems(m, v = S.values) {
  const [k, spec] = String(m).split(':');
  if (spec) return spec.split('+').filter(Boolean);
  if (k === 'kvm2') return ['jet', 'nano'];
  if (k === 'kvm') return String(v.kvm_boxes).split('+').filter(Boolean);
  if (k === 'pi' || k === 'piblade') return String(v.pi_boards).split('+').filter(Boolean);
  return [];
}
export const DEVICE_MODS = ['ms105g', 'uswflex', 'ux', 'dev1', 'dev2'];
export const modU = (m) => (modKind(m) === 'piblade' ? 2 : 1);
export const modLabel = (m) => {
  const items = TRAYS[modKind(m)] ? modItems(m) : [];
  if (!MODULES.includes(modKind(m))) return String(m);
  if (modKind(m) === 'patch' && m.includes(':')) return `${t('mod_patch')} · ${t('nPorts', { n: patchOf(m).types.length })}`;
  if (modKind(m) === 'label' && m.includes(':')) return `${t('mod_label')} · «${labelOf(m)}»`;
  return t('mod_' + modKind(m)) + (items.length ? ` · ${items.map((x) => (TRAYS[modKind(m)].items.includes(x) ? t('box_' + x) : x)).join(' + ')}` : '');
};
export const modFile = (m) => String(m).replace(/[:+]/g, '-');
// modules from the top like config.scad: one that no longer fits becomes a blank
export function placeMods(v, units) {
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
export const usedMods = (v, units) => placeMods(v, units).map((p) => p.m);
// will these boxes fit side by side in one tray? (default M5 posts: 123.7 mm between them; OpenSCAD has the last word)
export const OPENING = 123.7;
export function trayFits(kind, items, v) {
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
export const NUT_AF = { M3: 5.5, M4: 7, M5: 8, M6: 10, '6-32': 7.94, '10-32': 9.53, '12-24': 11.1 };
export const TAP_D = { M3: 2.6, M4: 3.5, M5: 4.4, M6: 5.2, '6-32': 2.9, '10-32': 4.2, '12-24': 4.7 };
export function sideWall(v, fixing = v.rack_fixing, screw = v.rack_screw) {
  const af = NUT_AF[screw] ?? 10;
  const feat = fixing === 'heatset' ? (v.rack_insert_d || INSERT_D[screw]) : fixing === 'tap' ? TAP_D[screw]
    : fixing === 'nut_trap' ? af / Math.cos(Math.PI / 6) + 0.3 : fixing === 'square_nut' ? af + 0.5 : af + 0.6;
  const slot = fixing === 'heatset' || fixing === 'tap' ? 0 : v.rack_hole_slot;
  return (146.05 - v.sleeve_clearance) / 2 - (134.925 / 2 + feat / 2 + slot / 2);
}
export const fixingFits = (v, f, screw) => sideWall(v, f, screw) >= 1;
// the zones of the strip: [fill, height], bottom first (as config.scad)
export function zoneList(v, c = calc(v)) {
  if (!c.hasSpare) return [];
  return v.spare_pos === 'split' ? [[v.spare_fill, c.spare * v.spare_split], [v.spare_fill_2, c.spare * (1 - v.spare_split)]]
    : [[v.spare_fill, c.spare]];
}
// the room a fill gets: a separate filler panel (or a 1U module) between the rack holes, a fill cut into the
// frame between the posts (the opening the model reports, which depends on the screws and their fixing)
export const HW_CLEAR = { M3: 3.4, M4: 4.5, M5: 5.5, M6: 6.6, '6-32': 3.7, '10-32': 5.1, '12-24': 5.8 };
export const panelW = (v) => 134.925 - (HW_CLEAR[v.rack_screw] ?? 6.6) - 6;
export const zoneBox = (v, height) => (v.filler_mode === 'separate' ? [panelW(v), height - 0.8] : [S.opening - 2, height]);
export const moduleBox = (v) => [panelW(v), v.rack_u_h - 0.79];
// how many keystones fit in w x h (ks_layout in fills.scad)
export const isMetalPort = (x, v) => x === 'rj45m' || ((x === 'cover' || x === 'pass') && v.ks_style === 'metal');
export function ksCapacity([w, h], v = S.values, types = ksTypes(v)) {
  const metal = types.some((x) => isMetalPort(x, v));
  const cw = metal ? v.ksm_w + 2 * v.ks_fit + 2 * v.ksm_wall : v.ks_w + 2 * v.ks_fit + 3;
  const px = metal ? v.ksm_pitch : v.ks_pitch;
  const cell = (metal ? v.ksm_cav_h + 2 * v.ks_fit + 2 * v.ksm_wall : v.ks_h + 2 * v.ks_fit + 7) + 1;
  return cw > w ? 0 : (Math.floor((w - cw) / px) + 1) * Math.max(0, Math.floor((h - 1) / cell));
}
// every place with the strip's patch panel ports (ks_ports_list), as [w, h]: keystone zones and bare patch modules
export function ksPlaces(v, c = calc(v)) {
  return [...zoneList(v, c).filter(([f]) => f === 'keystone').map(([, hh]) => zoneBox(v, hh)),
    ...usedMods(v, c.units).filter((m) => m === 'patch').map(() => moduleBox(v))];
}
// every patch panel of the build with its own ports: [box, types, names]
export function patchSets(v, c = calc(v)) {
  const names = String(v.ks_names ?? '').split(',').map((x) => x.trim());
  return [...ksPlaces(v, c).map((box) => [box, ksTypes(v), names]),
    ...usedMods(v, c.units).filter((m) => modKind(m) === 'patch' && m !== 'patch').map((m) => [moduleBox(v), patchOf(m).types, patchOf(m).names])];
}
// how many 40 mm fans fit side by side in w x h (fan40_pitch in fills.scad)
export function fanMax([w, h]) {
  if (h < 41) return 0;
  const room = Math.min(w, S.opening - 1) - 40;
  return [3, 2, 1].find((n) => n === 1 || room / (n - 1) >= 40.3);
}
// what is written over each port (ks_label in fills.scad): its name, else HDMI / USB…, else the number of its place
export const TYPE_NAMES = { hdmi: 'HDMI', usb: 'USB', rca: 'RCA', jack: 'AUDIO', toslink: 'OPTICAL' };
export const isJack = (tp) => tp !== 'cover' && tp !== 'pass' && tp !== 'none';
export function portLabels(v, types = ksTypes(v), names = String(v.ks_names ?? '').split(',').map((x) => x.trim())) {
  const start = Number(v.ks_label_start ?? 1);
  return types.map((tp, i) => names[i] || TYPE_NAMES[tp] || (isJack(tp) ? String(start + types.slice(0, i).filter(isJack).length) : ''));
}
// a patch module with its own ports, "patch:rj45m=NAS+hdmi+cover" (_ = a space in a name), and a label module with
// its own text, "label:MY_LAB"; a bare patch / label takes the strip's ks_ports_list / ks_names / label_text
// (patch_types / patch_names / label_of in config.scad)
export const specText = (s) => String(s).replace(/[,:+="\\]/g, ' ').trim().replace(/\s+/g, '_');
export const unscore = (s) => String(s).replace(/_/g, ' ').trim();
export function patchOf(m, v = S.values) {
  const spec = String(m).split(':')[1];
  if (!spec) return { types: ksTypes(v), names: String(v.ks_names ?? '').split(',').map((x) => x.trim()) };
  const items = spec.split('+').filter(Boolean).map((x) => x.split('='));
  return { types: items.map(([tp]) => tp), names: items.map(([, n]) => unscore(n ?? '')) };
}
export const patchSpec = (types, names) => 'patch:' + types.map((tp, i) => (specText(names[i] ?? '') ? `${tp}=${specText(names[i])}` : tp)).join('+');
export const labelOf = (m, v = S.values) => (String(m).includes(':') ? unscore(String(m).slice(String(m).indexOf(':') + 1)) : String(v.label_text));
export const labelSpec = (text) => 'label:' + (specText(text) || '_');