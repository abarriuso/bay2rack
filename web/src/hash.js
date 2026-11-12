// The settings in the address (shareable links), readable or short.
import { strToU8, strFromU8, deflateSync, inflateSync } from 'three/addons/libs/fflate.module.js';
import { fromPreset, same, clampValue } from './customizer.js';
import { S, START } from './state.js';

// ---------------------------------------------------------------- URL hash (shareable settings)
// the settings that differ from the defaults; "," and "+" stay readable (kvm:jet+nano)
export function hashString(values = S.values) {
  const q = new URLSearchParams();
  for (const [k, x] of Object.entries(values)) if (!same(x, S.defaults[k])) q.set(k, Array.isArray(x) ? x.join(',') : String(x));
  // (the model's defaults still say something: an address without settings is the first look, START)
  if (!q.size && S.defaults.bays != null) q.set('bays', String(S.defaults.bays));
  return '#' + q.toString().replace(/\+/g, '%20').replace(/%2C/g, ',').replace(/%2B/g, '+').replace(/%3A/g, ':').replace(/%3D/g, '=');
}
// the settings of the first look: the model's defaults and START on top
export const startValues = () => {
  const v = { ...S.defaults };
  for (const [k, x] of Object.entries(START)) if (S.params[k]) v[k] = clampValue(S.params[k], x);
  return v;
};
export function writeHash() {
  // (the first look: no settings in the address, and no '#' left dangling at its end)
  const h = hashString();
  history.replaceState(null, '', h === hashString(startValues()) ? location.pathname + location.search : h);
}
// a short link: the same settings, deflated (#z=...) when that is shorter than the readable ones
export const b64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export function shortHash(values = S.values) {
  const plain = hashString(values);
  const z = '#z=' + b64url(deflateSync(strToU8(plain.slice(1)), { level: 9 }));
  return z.length < plain.length ? z : plain;
}
// the case models had other names in older links
const OLD_CASES = {'definer5': 'quiet_mid', 'obsidian750d': 'window_full', 'antec300': 'mesh_compact', 'enthoopro': 'large_mid', 'definexlr2': 'quiet_full', 'haf932': 'mesh_full', 'stacker830': 'all_bays'};
export function readHash(from = location.hash) {
  let hash = from.replace(/^#/, '');
  if (!/=/.test(hash)) { S.values = startValues(); return; }   // (no settings, or a place in the page: the first look)
  if (hash.startsWith('z=')) {
    try { hash = strFromU8(inflateSync(unb64url(hash.slice(2)))); } catch { hash = ''; }
  }
  // a "+" in a link is a plus here (kvm:jet+nano), not a space
  for (const [k, s] of new URLSearchParams(hash.replace(/\+/g, '%2B'))) {
    const x = k === 'case_model' ? OLD_CASES[s] ?? s : s;
    if (S.params[k]) S.values[k] = clampValue(S.params[k], fromPreset(S.params[k], x));
  }
}