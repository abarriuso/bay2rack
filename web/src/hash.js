// The settings in the address (shareable links), readable or short.
import { strToU8, strFromU8, deflateSync, inflateSync } from 'three/addons/libs/fflate.module.js';
import { fromPreset, same, clampValue } from './customizer.js';
import { S } from './state.js';

// ---------------------------------------------------------------- URL hash (shareable settings)
// the settings that differ from the defaults; "," and "+" stay readable (kvm:jet+nano)
export function hashString(values = S.values) {
  const q = new URLSearchParams();
  for (const [k, x] of Object.entries(values)) if (!same(x, S.defaults[k])) q.set(k, Array.isArray(x) ? x.join(',') : String(x));
  return '#' + q.toString().replace(/\+/g, '%20').replace(/%2C/g, ',').replace(/%2B/g, '+').replace(/%3A/g, ':').replace(/%3D/g, '=');
}
export function writeHash() {
  history.replaceState(null, '', hashString());
}
// a short link: the same settings, deflated (#z=...) when that is shorter than the readable ones
export const b64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export function shortHash(values = S.values) {
  const plain = hashString(values);
  const z = '#z=' + b64url(deflateSync(strToU8(plain.slice(1)), { level: 9 }));
  return z.length < plain.length ? z : plain;
}
export function readHash() {
  let hash = location.hash.slice(1);
  if (hash.startsWith('z=')) {
    try { hash = strFromU8(inflateSync(unb64url(hash.slice(2)))); } catch { hash = ''; }
  }
  // a "+" in a link is a plus here (kvm:jet+nano), not a space
  for (const [k, s] of new URLSearchParams(hash.replace(/\+/g, '%2B')))
    if (S.params[k]) S.values[k] = clampValue(S.params[k], fromPreset(S.params[k], s));
}