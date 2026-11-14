// The live exploded view ("despiece"): the loaded assembly comes apart in three.js, nothing is rendered again.
// The 3MF holds one mesh per colour (every screw of the build in one mesh, every switch in another), so the meshes
// are cut first into their connected pieces, and every piece goes with the part it belongs to (the SCENE `parts`
// boxes say where the rack units and the strip zones are): the modules slide out to the front, top first, their
// screws ahead of them, the fillers out and apart, the bay screws out to the sides. Each part follows the slider
// on its own spring (a little late, a little past and back: the "transformer" feel); with reduced motion it jumps.
import * as THREE from 'three';
import { piecesKnown } from './mesh.js';

// the materials of the screws, nuts and inserts (assemble.js too)
export const HARDWARE = new Set(['steel', 'zinc', 'brass']);
const ZETA = 0.6;                    // damping ratio: a slight overshoot (about 9 %)
const EPS = 1e-4;

// connected pieces of a geometry: triangles that share a vertex position are one piece.
// -> { tri: Int32Array (piece of each triangle), boxes: [Box3] }
export function pieces(geo) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const n = (idx ? idx.count : pos.count) / 3;
  // (found already by the worker that read the model - mesh-worker.js)
  const known = piecesKnown.get(geo);
  if (known && known.tri.length === n) {
    const b = known.boxes, boxes = [];
    for (let i = 0; i < b.length; i += 6) boxes.push(new THREE.Box3(new THREE.Vector3(b[i], b[i + 1], b[i + 2]), new THREE.Vector3(b[i + 3], b[i + 4], b[i + 5])));
    return { tri: known.tri, boxes };
  }
  const vid = idx ? (i) => idx.getX(i) : (i) => i;
  const weld = new Int32Array(pos.count);
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 64)},${Math.round(pos.getY(i) * 64)},${Math.round(pos.getZ(i) * 64)}`;
    let w = seen.get(k);
    if (w === undefined) { w = seen.size; seen.set(k, w); }
    weld[i] = w;
  }
  const up = new Int32Array(seen.size);
  for (let i = 0; i < up.length; i++) up[i] = i;
  const find = (a) => { while (up[a] !== a) { up[a] = up[up[a]]; a = up[a]; } return a; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) up[a] = b; };
  for (let t = 0; t < n; t++) {
    const a = weld[vid(3 * t)];
    join(a, weld[vid(3 * t + 1)]);
    join(a, weld[vid(3 * t + 2)]);
  }
  const ids = new Map();
  const tri = new Int32Array(n);
  const boxes = [];
  const p = new THREE.Vector3();
  for (let t = 0; t < n; t++) {
    const r = find(weld[vid(3 * t)]);
    let id = ids.get(r);
    if (id === undefined) { id = boxes.length; ids.set(r, id); boxes.push(new THREE.Box3()); }
    tri[t] = id;
    for (let k = 0; k < 3; k++) boxes[id].expandByPoint(p.fromBufferAttribute(pos, vid(3 * t + k)));
  }
  return { tri, boxes };
}

// A screw comes as several pieces (its head, its shank, a washer): the pieces of a hardware mesh that touch are one
// fastener, and go together. -> the box of the whole fastener, for each piece
export function fasteners(boxes) {
  const n = boxes.length;
  const up = boxes.map((_, i) => i);
  const find = (a) => { while (up[a] !== a) { up[a] = up[up[a]]; a = up[a]; } return a; };
  const s = new THREE.Vector3();
  const small = boxes.map((b) => { b.getSize(s); return Math.max(s.x, s.y, s.z) < 45; });   // (not a metal box of a device)
  const fat = boxes.map((b) => b.clone().expandByScalar(0.2));
  for (let i = 0; i < n; i++) {
    if (!small[i]) continue;
    for (let j = i + 1; j < n; j++) if (small[j] && fat[i].intersectsBox(fat[j])) up[find(i)] = find(j);
  }
  const whole = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!whole.has(r)) whole.set(r, new THREE.Box3());
    whole.get(r).union(boxes[i]);
  }
  return boxes.map((_, i) => whole.get(find(i)));
}

// the triangles of `geo` whose flag is set, as a new (non-indexed) geometry with the same attributes
export function subset(geo, keep, count) {
  const idx = geo.index;
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    const arr = new a.array.constructor(count * 3 * a.itemSize);
    let o = 0;
    for (let t = 0; t < keep.length; t++) {
      if (!keep[t]) continue;
      for (let k = 0; k < 3; k++) {
        const v = idx ? idx.getX(3 * t + k) : 3 * t + k;
        for (let c = 0; c < a.itemSize; c++) arr[o++] = a.array[v * a.itemSize + c];
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  return out;
}

// a mesh cut into one mesh a key: the key of each of its pieces (keyOf, the pieces' tri from pieces()); each mesh with
// its key to `add` - the mesh itself if it is all one key, else its parts in its place (assemble.js too)
export function cutByKey(m, tri, keyOf, add) {
  const keys = [...new Set(keyOf)];
  if (keys.length === 1) { add(m, keys[0]); return; }
  for (const key of keys) {
    const keep = new Uint8Array(tri.length);
    let count = 0;
    for (let t = 0; t < tri.length; t++) if (keyOf[tri[t]] === key) { keep[t] = 1; count++; }
    const sub = new THREE.Mesh(subset(m.geometry, keep, count), m.material);
    sub.castShadow = m.castShadow; sub.receiveShadow = m.receiveShadow;
    m.parent.add(sub);
    add(sub, key);
  }
  m.parent.remove(m);
  m.geometry.dispose();
}

// (a part is home below OUT of its way out, and has left past AWAY: apart, so that a spring's wobble is one sound)
const OUT = 0.02, AWAY = 0.08;

export class Explode {
  constructor(viewer) {
    this.v = viewer;
    this.target = 0;                // the slider, 0..1
    this.history = [];              // [{ at, value }]: each part follows the slider a little late
    this.state = new Map();         // part key -> { s, vel }
    this.groups = new Map();        // part key -> { meshes: [], off: Vector3, delay, w }
    this.model = null;
    this.hook = null;
  }

  // what each part does at full explode, from the SCENE parts and the size of the build
  plan(key, D, units, zones) {
    const [kind, a] = key.split(':');
    const i = Number(a);
    const n = units.length;
    const unit = (k) => new THREE.Vector3(0, -1.25 * D, ((n - 1) / 2 - k) * 0.16 * D);
    const zone = (k) => {
      const zb = zones[k], fr = this.v.parts.front;
      const up = (zb[0][2] + zb[1][2]) / 2 > (fr[0][2] + fr[1][2]) / 2 ? 1 : -1;
      return new THREE.Vector3(0, -0.85 * D, up * 0.2 * D);
    };
    if (kind === 'unit') return { off: unit(i), delay: 70 + 75 * i, w: Math.max(7, 11 - 0.9 * i) };
    if (kind === 'uscrew') return { off: unit(i).add(new THREE.Vector3(0, -0.6 * D, 0)), delay: 75 * i, w: 14 };
    if (kind === 'zone') return { off: zone(i), delay: 120 + 60 * i, w: 10 };
    if (kind === 'zscrew') return { off: zone(i).add(new THREE.Vector3(0, -0.55 * D, 0)), delay: 50 + 60 * i, w: 14 };
    if (kind === 'zdev') return { off: new THREE.Vector3(0, -1.1 * D, 0), delay: 90 + 60 * i, w: 10 };
    if (kind === 'side') return { off: new THREE.Vector3(i * 0.5 * D, 0, 0), delay: 30, w: 12 };
    return null;                     // the adapter, and what is not part of the front: it stays
  }

  // cut the meshes of the model into the parts that move (once a model: on first use)
  prepare() {
    const v = this.v, P = v.parts, model = v.model;
    if (!P?.front || !model || this.model === model) return;
    this.model = model;
    this.groups.clear();
    const units = (P.units ?? []).map(([, b]) => b);
    const zones = P.zones ?? [];
    const meshes = [];
    model.traverse((o) => { if (o.isMesh && !o.userData.bpLine) meshes.push(o); });
    const separate = meshes.some((m) => m.material.name === 'print_1');
    const [[fx0, fy0, fz0], [fx1, , fz1]] = P.front;
    const xIn = P.posts?.[1]?.[0]?.[0] ?? fx1 - 12;
    const adapter = new THREE.Box3();
    for (const m of meshes) if (m.material.name === 'print_0') { m.geometry.computeBoundingBox(); adapter.union(m.geometry.boundingBox); }
    const D = Math.max(60, adapter.isEmpty() ? 60 : adapter.max.y - Math.min(adapter.min.y, fy0));
    const inBand = (z, b) => z >= b[0][2] - 0.6 && z <= b[1][2] + 0.6;
    const c = new THREE.Vector3(), s = new THREE.Vector3();
    const classify = (box, mat) => {
      box.getCenter(c); box.getSize(s);
      if (Math.abs(c.x) > fx1 + 8 || c.z < fz0 - 20 || c.z > fz1 + 20) return 'stay';     // the scene around
      if (mat === 'print_0') return 'stay';
      const u = units.findIndex((b) => inBand(c.z, b));
      const z = zones.findIndex((b) => inBand(c.z, b));
      if (HARDWARE.has(mat)) {
        // bay screws: along X, beside the frame -> out to the sides; inserts in the rack posts stay
        if (Math.abs(c.x) > xIn - 2 && s.x > s.y && s.x > s.z * 0.9) return 'side:' + Math.sign(c.x);
        if (mat === 'brass' && Math.abs(c.x) > xIn - 2) return 'stay';
        if (c.y < 1.5 && u >= 0) return 'uscrew:' + u;
        if (c.y < 1.5 && z >= 0) return 'zscrew:' + z;
        return u >= 0 ? 'unit:' + u : 'stay';
      }
      if (mat === 'print_1') return z >= 0 ? 'zone:' + z : 'stay';
      if (u >= 0) return 'unit:' + u;
      if (z >= 0) return separate ? 'zone:' + z : 'zdev:' + z;
      return 'stay';
    };
    for (const m of meshes) {
      const mat = m.material.name;
      const { tri, boxes } = pieces(m.geometry);
      const keyOf = (HARDWARE.has(mat) ? fasteners(boxes) : boxes).map((b) => classify(b, mat));
      cutByKey(m, tri, keyOf, (mesh, key) => {
        if (key === 'stay') return;
        let g = this.groups.get(key);
        if (!g) {
          const p = this.plan(key, D, units, zones);
          if (!p) return;
          g = { meshes: [], ...p };
          this.groups.set(key, g);
        }
        g.meshes.push(mesh);
      });
    }
    // the parts take the slider's current place at once (a new result while it is apart: no animation)
    for (const key of this.groups.keys()) if (!this.state.has(key)) this.state.set(key, { s: this.target, vel: 0, home: this.target < OUT });
    for (const [key, st] of this.state) if (!this.groups.has(key)) this.state.delete(key);
    this.apply();
    v.dirty = true;
  }

  // the new model: its parts are cut again when it is apart (or the blueprint needs them)
  reset() {
    this.model = null;
    this.groups.clear();
    if (!this.hook) for (const st of this.state.values()) { st.s = this.target; st.vel = 0; }
  }

  // how far a part has moved now (the blueprint's labels follow their unit)
  offset(key, out = new THREE.Vector3()) {
    const g = this.groups.get(key), st = this.state.get(key);
    return g && st ? out.copy(g.off).multiplyScalar(st.s) : out.set(0, 0, 0);
  }

  get apart() { return this.target > 0 || [...this.state.values()].some((st) => Math.abs(st.s) > EPS); }

  apply() {
    for (const [key, g] of this.groups) {
      const s = this.state.get(key)?.s ?? 0;
      for (const m of g.meshes) m.position.copy(g.off).multiplyScalar(s);
    }
    this.onChange?.();
  }

  // a build that has just come: every part out where the full explode has it, and home at once - each one after its
  // delay, on its spring, but a piece stops at its seat (it knocks and rests, it does not go through the rack)
  burst() {
    this.prepare();
    if (!this.groups.size) return;
    for (const st of this.state.values()) { st.s = 1; st.vel = 0; st.seated = false; }
    this.target = 0;
    this.history = [{ at: -Infinity, value: 1 }, { at: performance.now() + 120, value: 0 }];
    this.seat = true;
    this.apply();
    if (!this.hook) { this.hook = (dt) => this.step(dt); this.v.hooks.push(this.hook); }
    this.v.dirty = true;
  }

  set(value, calm) {
    this.seat = false;                            // (the slider takes it: the springs as they are)
    if (value > 0) this.prepare();                // (its parts start where the slider was)
    const now = performance.now();
    if (!this.history.length) this.history.push({ at: -Infinity, value: this.target });
    this.target = value;
    this.history.push({ at: now, value });
    if (calm) {
      // no motion: it is where the slider says, at once
      this.stop();
      for (const st of this.state.values()) { st.s = value; st.vel = 0; st.home = value < OUT; }
      this.history = [];
      this.apply();
      this.v.dirty = true;
      return;
    }
    if (this.hook) return;
    this.hook = (dt) => this.step(dt);
    this.v.hooks.push(this.hook);
    this.v.dirty = true;                          // (the view asks for frames again)
  }

  stop() {
    const i = this.v.hooks.indexOf(this.hook);
    if (i >= 0) this.v.hooks.splice(i, 1);
    this.hook = null;
    this.v.dirty = true;
  }

  // the slider's value `delay` ms ago
  at(delay, now) {
    let value = this.history[0]?.value ?? this.target;
    for (const h of this.history) if (h.at <= now - delay) value = h.value; else break;
    return value;
  }

  step(dt) {
    const now = performance.now();
    let moving = false, heard = 0;
    let maxDelay = 0;
    for (const [key, st] of this.state) {
      const g = this.groups.get(key);
      if (!g) continue;
      maxDelay = Math.max(maxDelay, g.delay);
      const goal = this.at(g.delay, now);
      // a damped spring, in small steps (stable at any frame rate)
      for (let left = dt; left > 1e-6; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        st.vel += (g.w * g.w * (goal - st.s) - 2 * ZETA * g.w * st.vel) * h;
        st.s += st.vel * h;
        // home: a knock, a little back out, and it rests there
        if (this.seat && st.s < 0) {
          st.s = 0;
          if (!st.seated) { st.seated = true; this.onSeat?.(key, Math.min(1, 0.6 + Math.abs(st.vel) / 6)); }
          st.vel = Math.abs(st.vel) * 0.18;
        }
      }
      // a part leaving its seat, or back in it (the slider's or the key's explode; a build putting itself together
      // has its own knock, onSeat): its sound - a few a frame at most, the rest come in silence
      if (this.seat) st.home = st.s < OUT;
      else if (st.home !== false && st.s > AWAY) { st.home = false; if (heard++ < 4) this.onMove?.(key, true); }
      else if (st.home === false && st.s < OUT && st.vel <= 0) { st.home = true; if (heard++ < 4) this.onMove?.(key, false); }
      if (Math.abs(goal - st.s) > EPS || Math.abs(st.vel) > EPS * 10) moving = true;
    }
    // the history older than the latest delay is no longer needed (one entry before it stays)
    while (this.history.length > 1 && this.history[1].at <= now - maxDelay - 50) this.history.shift();
    const settled = !moving && (this.history.length <= 1 || this.history.at(-1).at <= now - maxDelay);
    if (settled) {
      this.seat = false;
      // exactly where the slider is (0 is the assembly as it came, to the bit)
      for (const st of this.state.values()) { st.s = this.target; st.vel = 0; st.home = this.target < OUT; }
      this.history = [];
      this.apply();
      this.stop();
      return;
    }
    this.apply();
  }
}
