// The film's end, built in the configurator. The film leaves the kit on the table (docs/scroll/table.json, from
// scripts/blender/scroll.py --table: where each piece lies there and the film's last camera); the 3D view takes
// over that very picture - the same pieces in the same places, seen from the same camera, framed as the film's
// frame was on the page - and builds the PC from them: the adapter slides into the bays, its screws go in from the
// open side, the side panel shuts, the modules lock in one by one from the bottom with their screws, the cables
// plug in. The camera meanwhile rises to the configurator's own view. A drag, a wheel or a key ends it at once.
import * as THREE from 'three';
import { pieces, fasteners, subset } from './explode.js';
import { sfx } from './sound.js';
import { BASE } from './state.js';

const HARDWARE = new Set(['steel', 'zinc', 'brass']);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const out3 = (t) => 1 - (1 - t) ** 3;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const bez = (a, b, c, d, t, o) => {
  const u = 1 - t;
  return o.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
};
const mat4 = (rows, dz = 0) => new THREE.Matrix4().set(...rows[0].slice(0, 3), rows[0][3], ...rows[1].slice(0, 3), rows[1][3],
  ...rows[2].slice(0, 3), rows[2][3] + dz, 0, 0, 0, 1);

let tableData = null;
const loadTable = () => (tableData ??= fetch(BASE + 'scroll/table.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));
export const preloadTable = () => loadTable();

// the model's meshes cut into the parts that move: adapter, filler, module<k> (top first), screw<j> (each screw of
// the film's table), the rest stays. -> Map key -> { meshes, box }
function split(v, T) {
  const P = v.parts, units = [...(P.units ?? [])].map(([, b]) => b).sort((a, b) => b[1][2] - a[1][2]);
  const zones = P.zones ?? [];
  const [[, , fz0], [fx1, , fz1]] = P.front;
  const xIn = P.posts?.[1]?.[0]?.[0] ?? fx1 - 12;
  const inBand = (z, b) => z >= b[0][2] - 0.6 && z <= b[1][2] + 0.6;
  const at = T.screws.map((s) => new THREE.Vector3(...s.at));
  const c = new THREE.Vector3(), sz = new THREE.Vector3();
  const band = (z) => {
    const u = units.findIndex((b) => inBand(z, b));
    if (u >= 0) return 'module' + u;
    return zones.some((b) => inBand(z, b)) ? 'filler' : null;
  };
  const classify = (box, mat) => {
    box.getCenter(c); box.getSize(sz);
    if (Math.abs(c.x) > fx1 + 8 || c.z < fz0 - 20 || c.z > fz1 + 20) return 'stay';
    if (mat === 'print_0') return 'adapter';
    if (HARDWARE.has(mat)) {
      let best = -1, d = 4;
      at.forEach((p, j) => { const e = p.distanceTo(c); if (e < d) { d = e; best = j; } });
      if (best >= 0) return 'screw' + best;
      if (mat === 'brass' && Math.abs(c.x) > xIn - 2) return 'adapter';
      return band(c.z) ?? 'adapter';
    }
    if (mat === 'print_1') return 'filler';
    return band(c.z) ?? 'stay';
  };
  const parts = new Map();
  const add = (mesh, key) => {
    if (key === 'stay') return;
    if (!parts.has(key)) parts.set(key, { meshes: [], box: new THREE.Box3() });
    const p = parts.get(key);
    p.meshes.push(mesh);
    mesh.geometry.computeBoundingBox();
    p.box.union(mesh.geometry.boundingBox);
  };
  const meshes = [];
  v.model.traverse((o) => { if (o.isMesh && !o.userData.bpLine) meshes.push(o); });
  for (const m of meshes) {
    const mat = m.material.name;
    const { tri, boxes } = pieces(m.geometry);
    const keyOf = (HARDWARE.has(mat) ? fasteners(boxes) : boxes).map((b) => classify(b, mat));
    const keys = [...new Set(keyOf)];
    if (keys.length === 1) { add(m, keys[0]); continue; }
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
  return parts;
}

// The camera of the film's last frame, framed as that frame is on the page: `img` is where the film's picture is on
// screen, `view` where the 3D view is (CSS px). The 3D view shows its part of that same picture.
function filmProjection(cam, C, img, view) {
  const hf = 2 * Math.atan(C.sensor / 2 / C.lens);
  const vf = 2 * Math.atan(Math.tan(hf / 2) * C.size[1] / C.size[0]);
  return { fov: THREE.MathUtils.radToDeg(vf), full: [img.width, img.height],
    off: [view.left - img.left + C.shift[0] * img.width, view.top - img.top - C.shift[1] * img.width], size: [view.width, view.height] };
}
function project(cam, p) {
  cam.fov = p.fov;
  cam.aspect = p.full[0] / p.full[1];
  cam.setViewOffset(p.full[0], p.full[1], p.off[0], p.off[1], p.size[0], p.size[1]);
  cam.updateProjectionMatrix();
}

// -> { play(), finish() } with the pieces on the table and the camera of the film, or null (no table, not the
// film's build)
export async function fromTable(v, img, view) {
  const T = await loadTable();
  if (!T || !v.model || !v.parts?.front || v.tools?.on) return null;
  const parts = split(v, T);
  if (!parts.has('adapter') || !parts.has('module0')) return null;
  const dz = v.floor.position.z - T.floor;                  // (the view's floor: the pieces lie on it)
  const cam = v.camera, ctl = v.controls;
  // the film's camera
  const cm = mat4(T.camera.matrix, dz);
  const eye0 = new THREE.Vector3().setFromMatrixPosition(cm);
  const aim0 = new THREE.Vector3(...T.camera.aim).add(new THREE.Vector3(0, 0, dz));
  const proj0 = filmProjection(cam, T.camera, img, view);
  const end = v.fitPose(undefined, view.width / view.height);
  const proj1 = { fov: cam.fov, full: [view.width, view.height], off: [0, 0], size: [view.width, view.height] };
  const fov1 = 30;

  // each part: from its place on the table (D) to its place in the PC, along a path in front of its bay
  const tracks = [];
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), tmp = new THREE.Vector3();
  const track = (key, D, { from, ms, approach, lift, spin = 0, axis = null, sound, kind }) => {
    const part = parts.get(key);
    if (!part) return null;
    const c0 = part.box.getCenter(new THREE.Vector3());
    const p0 = c0.clone().applyMatrix4(D);
    const q0 = new THREE.Quaternion().setFromRotationMatrix(D);
    const pf = c0.clone().add(approach);
    const tr = { key, part, c0, p0, q0, pf, l1: p0.clone().add(new THREE.Vector3(0, 0, lift)),
      l2: pf.clone().add(new THREE.Vector3(0, 0, lift * 0.4)), from, ms, spin, axis, sound, kind, state: 0 };
    tracks.push(tr);
    return tr;
  };
  // where a part is at time t (ms): on the table, flying, sliding in, home
  const pose = (tr, t) => {
    const u = clamp01((t - tr.from) / tr.ms);
    const A = 0.62;                                          // the flight; then the slide in
    if (u < A) {
      const a = ease(u / A);
      bez(tr.p0, tr.l1, tr.l2, tr.pf, a, p);
      q.copy(tr.q0).slerp(new THREE.Quaternion(), a);
    } else {
      const b = out3((u - A) / (1 - A));
      p.lerpVectors(tr.pf, tr.c0, b);
      q.identity();
      if (tr.spin) q.setFromAxisAngle(tr.axis, tr.spin * (1 - b));
    }
    for (const m of tr.part.meshes) {
      m.quaternion.copy(q);
      m.position.copy(p).sub(tmp.copy(tr.c0).applyQuaternion(q));
    }
    return u;
  };

  // the order (ms): the adapter, its bay screws, the side panel, the modules from the bottom, each with its screws,
  // the cables
  const pan = (c) => Math.max(-0.6, Math.min(0.6, c.x / 160));
  const ad = track('adapter', mat4(T.pieces.adapter.move, dz), { from: 250, ms: 1400, approach: new THREE.Vector3(0, -170, 0), lift: 140, kind: 'thunk' });
  let t = ad.from + ad.ms;
  const screwTracks = [];
  T.screws.forEach((s, j) => {
    const key = 'screw' + j;
    if (!parts.has(key)) return;
    const side = s.size[0] > s.size[1];
    const c = new THREE.Vector3(...s.at);
    screwTracks.push({ key, s, side, c, D: mat4(s.move, dz), hidden: s.hidden });
  });
  const hiddenKeys = [];
  let k = 0;
  for (const st of screwTracks.filter((x) => x.side)) {
    if (st.hidden) { hiddenKeys.push(st.key); continue; }
    track(st.key, st.D, { from: t + 80 + 110 * k++, ms: 620, approach: new THREE.Vector3(-34, 0, 0), lift: 60,
      spin: Math.PI * 6, axis: new THREE.Vector3(1, 0, 0), kind: 'screw' });
  }
  t += 80 + 110 * k + 620;
  // the side panel shuts (its hinge: the fixed point of its turn on the table)
  let door = null;
  const sides = [];
  v.extras?.traverse((o) => { if (o.userData.role === 'side') sides.push(o); });
  if (T.panel && sides.length) {
    const D = mat4(T.panel.move);
    const ang = Math.atan2(D.elements[1], D.elements[0]);
    const tx = D.elements[12], ty = D.elements[13], ca = Math.cos(ang), sa = Math.sin(ang);
    // (I - R) h = t, in the plane
    const a11 = 1 - ca, a12 = sa, a21 = -sa, a22 = 1 - ca, det = a11 * a22 - a12 * a21;
    const hinge = new THREE.Vector3((tx * a22 - a12 * ty) / det, (a11 * ty - a21 * tx) / det, 0);
    door = { objs: sides.map((o) => ({ o, base: o.matrix.clone(), auto: o.matrixAutoUpdate })), ang, hinge, from: t, ms: 620, state: 0 };
    t += 520;
  }
  // the modules and the strip, from the bottom up, each with the screws of its front
  const order = [...parts.keys()].filter((x) => x === 'filler' || x.startsWith('module'))
    .sort((a, b) => parts.get(a).box.min.z - parts.get(b).box.min.z);
  const frontScrews = screwTracks.filter((x) => !x.side);
  const used = new Set();
  for (const key of order) {
    const piece = T.pieces[key];
    if (!piece) continue;
    const tr = track(key, mat4(piece.move, dz), { from: t, ms: 1050, approach: new THREE.Vector3(0, -130, 0), lift: 110, kind: 'snap' });
    t += 420;
    const box = parts.get(key).box;
    let m = 0;
    for (const st of frontScrews) {
      if (used.has(st.key) || st.c.z < box.min.z - 2 || st.c.z > box.max.z + 2) continue;
      used.add(st.key);
      track(st.key, st.D, { from: tr.from + tr.ms - 260 + 90 * m++, ms: 560, approach: new THREE.Vector3(0, -26, 0), lift: 50,
        spin: Math.PI * 6, axis: new THREE.Vector3(0, 1, 0), kind: 'screw' });
    }
  }
  // screws of no piece here go in at the end
  for (const st of frontScrews) if (!used.has(st.key)) {
    track(st.key, st.D, { from: t, ms: 560, approach: new THREE.Vector3(0, -26, 0), lift: 50, spin: Math.PI * 6, axis: new THREE.Vector3(0, 1, 0), kind: 'screw' });
    t += 60;
  }
  const last = Math.max(...tracks.map((x) => x.from + x.ms), door ? door.from + door.ms : 0);
  const cablesAt = last + 120;
  const total = cablesAt + 500;
  const CAM_MS = Math.max(2300, total - 1600);         // (the camera rises with the build, home as it ends)

  // the first picture: everything where the film left it
  const hidden = hiddenKeys.flatMap((key) => parts.get(key)?.meshes ?? []);
  const setHidden = (on) => { for (const m of hidden) m.visible = !on; };
  const cablesWere = v.show.cables;
  const setCables = (on) => v.extras?.traverse((o) => { if (o.userData.role === 'cables') o.visible = on && cablesWere; });
  const doorAt = (a) => {
    if (!door) return;
    const R = new THREE.Matrix4().makeTranslation(door.hinge.x, door.hinge.y, 0)
      .multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(-door.hinge.x, -door.hinge.y, 0));
    for (const d of door.objs) { d.o.matrixAutoUpdate = false; d.o.matrix.copy(R).multiply(d.base); d.o.matrixWorldNeedsUpdate = true; }
  };
  const camAt = (u) => {
    const a = ease(u);
    cam.position.lerpVectors(eye0, end.eye, a);
    ctl.target.lerpVectors(aim0, end.target, a);
    const P = {
      fov: proj0.fov + (fov1 - proj0.fov) * a,
      full: proj0.full.map((x, i) => x + (proj1.full[i] - x) * a),
      off: proj0.off.map((x, i) => x + (proj1.off[i] - x) * a),
      size: proj1.size,
    };
    project(cam, P);
    cam.near = 8; cam.far = 30000;
    cam.updateProjectionMatrix();
    ctl.update();
  };
  const frame = (ms) => {
    camAt(clamp01(ms / CAM_MS));
    for (const tr of tracks) {
      const u = pose(tr, ms);
      // the sounds: a breath as it leaves the table, then its own one as it is home
      if (tr.state === 0 && ms >= tr.from && tr.kind !== 'screw') { tr.state = 1; sfx.lift(pan(tr.c0), tr.ms * 0.6); }
      if (tr.state < 2 && tr.kind === 'screw' && u >= 0.62) { tr.state = 2; sfx.screw(pan(tr.c0), tr.ms * 0.38, 4); }
      if (tr.state < 2 && u >= 1 && tr.kind !== 'screw') {
        tr.state = 2;
        if (tr.kind === 'thunk') sfx.thunk(pan(tr.c0)); else sfx.snap(pan(tr.c0), tr.key === 'filler' ? 0.8 : 1);
      }
    }
    if (ms >= ad.from + ad.ms) setHidden(false);
    if (door) {
      const u = clamp01((ms - door.from) / door.ms);
      doorAt(door.ang * (1 - out3(u)));
      if (door.state === 0 && u >= 1) { door.state = 1; sfx.thunk(-0.5); }
    }
    if (ms >= cablesAt && !frame.cables) { frame.cables = true; setCables(true); sfx.plug(-0.2); setTimeout(() => sfx.plug(0.15), 70); setTimeout(() => sfx.plug(0.3), 150); }
  };
  stopOthers(v);
  setHidden(true);
  setCables(false);
  frame(0);
  v.dirty = true;

  let stop = null, done = false;
  const finish = () => {
    if (done) return;
    done = true;
    stop?.();
    for (const ev of ['wheel', 'keydown', 'pointerdown']) v.renderer.domElement.removeEventListener(ev, finish);
    ctl.removeEventListener('start', finish);
    for (const tr of tracks) for (const m of tr.part.meshes) { m.position.set(0, 0, 0); m.quaternion.identity(); }
    setHidden(false);
    setCables(true);
    if (door) for (const d of door.objs) { d.o.matrix.copy(d.base); d.o.matrixAutoUpdate = d.auto; d.o.matrix.decompose(d.o.position, d.o.quaternion, d.o.scale); }
    cam.clearViewOffset();
    cam.fov = fov1;
    v.resize();
    v.dirty = true;
  };
  const model = v.model;
  return {
    play() {
      // (another model came meanwhile: no pieces of this one to build)
      if (v.model !== model) { finish(); v.fit(); return; }
      for (const ev of ['wheel', 'keydown', 'pointerdown']) v.renderer.domElement.addEventListener(ev, finish, { passive: true });
      ctl.addEventListener('start', finish);
      stop = v.run(total, (u) => frame(u * total), () => { stop = null; finish(); });
    },
    finish,
  };
}

// (a glide or a settle of the view under way would fight the film's camera)
function stopOthers(v) {
  v.stopFly?.();
  v.stopArrive?.();
  if (v.model) { v.model.scale.setScalar(1); v.model.position.set(0, 0, 0); }
}
