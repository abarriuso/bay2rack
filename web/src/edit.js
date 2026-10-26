// Changing the settings: every change, undo / redo, and the fixes a change makes necessary.
import { clampValue } from './customizer.js';
import { $, S } from './state.js';
import { calc, usedMods, fixingFits, zoneList, zoneBox, moduleBox, fanMax } from './model.js';
import { startEngine } from './engine.js';
import { renderSteps } from './steps.js';
import { renderTabs, syncAdvanced, showPrebuilt } from './tabs.js';
import { writeHash } from './hash.js';
import { schedule } from './render.js';

// ---------------------------------------------------------------- state changes
// every value that comes in (steps, advanced form, link) stays inside its parameter's range
export const clamped = (patch) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, S.params[k] ? clampValue(S.params[k], v) : v]));
// undo / redo: every change keeps the settings it came from (the last 60)
export const past = [];
export const future = [];
export const snapshot = () => ({ ...S.values });
export function restore(v) {
  S.values = { ...v };
  refresh();
  schedule(0);
}
export function undo() { if (past.length) { future.push(snapshot()); restore(past.pop()); } }
export function redo() { if (future.length) { past.push(snapshot()); restore(future.pop()); } }
export function update(patch) {
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
export function normalize(v) {
  if (!fixingFits(v, v.rack_fixing, v.rack_screw)) v.rack_fixing = ['square_nut', 'heatset'].find((f) => fixingFits(v, f, v.rack_screw)) ?? 'heatset';
  const c = calc(v);
  const fanPlaces = [...zoneList(v, c).filter(([f]) => f === 'fan40').map(([, hh]) => fanMax(zoneBox(v, hh))),
    ...(usedMods(v, c.units).includes('fan40') ? [fanMax(moduleBox(v))] : [])];
  if (fanPlaces.length) v.fan40_count = Math.max(1, Math.min(v.fan40_count, ...fanPlaces.map((n) => Math.max(1, n))));
}
export function refresh() {
  const focus = focusPath();
  // one part failing (a hand-written link with something odd in it) must not leave the rest out of date
  for (const f of [renderSteps, renderTabs, syncAdvanced, showPrebuilt, writeHash]) {
    try { f(); } catch (e) { console.error(e); }
  }
  restoreFocus(focus);
}
// where the focus is inside the steps or the tabs, as child indexes, to put it back after they are drawn again
export function focusPath() {
  const el = document.activeElement;
  const box = el?.closest?.('#steps, #tabs');
  if (!box || el === box) return null;
  const path = [];
  for (let n = el; n !== box; n = n.parentElement) path.unshift([...n.parentElement.children].indexOf(n));
  return { box: '#' + box.id, path, tag: el.tagName, type: el.type };
}
export function restoreFocus(f) {
  if (!f) return;
  let n = $(f.box);
  for (const i of f.path) n = n?.children[i];
  if (n && n.tagName === f.tag && n.type === f.type) n.focus({ preventScroll: true });
}