// The film's end, built in the configurator - with the scroll. The film leaves the kit on the table
// (docs/scroll/table.json, from scripts/blender/scroll.py --table: where each piece lies there, and the film's last
// camera). The 3D view takes over that very picture: the same pieces in the same places, seen from the same camera,
// framed as the film's frame is on the page, on the same table (the bare table of --plate, laid on the 3D floor by
// film.js with plateMatrix()). Then, as the page scrolls on, the PC is built from them: the adapter slides into the
// bays and its screws go in from the open side, the side panel shuts, the modules and the strip rise from the table
// into the exploded view in front of the rack, their screws ahead of them, and close in as the exploded view does,
// top first, each one's screws after it; the cables plug in. The camera meanwhile rises from the table to the
// configurator's own view. Every moment is a pose of the scroll (at(p), p 0..1): back up, it comes apart again.
import * as THREE from 'three';
import { pieces, fasteners, subset } from './explode.js';
import { sfx } from './sound.js';
import { BASE } from './state.js';

// the bare table sees this much more than the film's last frame, about the same centre (scroll.py PLATE_OVERSCAN)
export const PLATE_OVERSCAN = 1.5;
const HARDWARE = new Set(['steel', 'zinc', 'brass']);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const out3 = (t) => 1 - (1 - t) ** 3;
const out5 = (t) => 1 - (1 - t) ** 5;
const bez = (a, b, c, d, t, o) => {
  const u = 1 - t;
  return o.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
};
const mat4 = (rows, dz = 0) => new THREE.Matrix4().set(...rows[0].slice(0, 3), rows[0][3], ...rows[1].slice(0, 3), rows[1][3],
  ...rows[2].slice(0, 3), rows[2][3] + dz, 0, 0, 0, 1);

// The moments along the stretch of scroll (fractions of it). The camera rises over most of it; the adapter goes in
// first, the side panel shuts; meanwhile the modules fly into the exploded view, hold there a moment, and close in.
const CAM = [0.03, 0.62];
const BACK = 2.6;                  // (how far back the wide shot halfway is, of the configurator's own distance)
const ADAPTER = { fly: [0.05, 0.27], slide: [0.27, 0.34] };
const SIDE_SCREWS = { fly: [0.12, 0.33], slide: 0.34, each: 0.016, len: 0.06 };
const DOOR = [0.42, 0.5];
const MODULES = { fly: 0.12, each: 0.04, len: 0.3, close: 0.64, step: 0.032, slide: 0.11 };
const SCREW_SLIDE = 0.07;
const CABLES = 0.93;
const SHADE = [0.15, 0.45];

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

// The camera of the film's last frame, framed as that frame is on the page: `img` is where the film's picture is,
// `view` the 3D view (CSS px, the view's own corner at 0, 0). The 3D view shows its part of that same picture.
function filmProjection(C, img, view) {
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

// the homography that takes the unit square to the quad q (4 points, clockwise from the top left)
function squareTo(q) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h];
}

// -> { at(p), finish(), plateMatrix(w, h) } with the pieces on the table and the camera of the film, or null (no table,
// not the film's build)
export async function fromTable(v, img0, view0) {
  const T = await loadTable();
  if (!T || !v.model || !v.parts?.front || v.tools?.on) return null;
  const parts = split(v, T);
  if (!parts.has('adapter') || !parts.has('module0')) return null;
  stopOthers(v);
  const floorZ = v.floor.position.z;
  const dz = floorZ - T.floor;                              // (the view's floor: the pieces lie on it)
  const cam = v.camera, ctl = v.controls;
  const cm = mat4(T.camera.matrix, dz);
  const eye0 = new THREE.Vector3().setFromMatrixPosition(cm);
  const aim0 = new THREE.Vector3(...T.camera.aim).add(new THREE.Vector3(0, 0, dz));
  // (what depends on the page's layout: reframe() below)
  let view, proj0, proj1, end, K1, K2, corners;
  const fov1 = 30;

  // the exploded view's places (explode.js plan): the modules out to the front and apart, the strip out, the screws
  // ahead of their piece
  const P = v.parts;
  const adapterBox = parts.get('adapter').box;
  const D = Math.max(60, adapterBox.max.y - Math.min(adapterBox.min.y, P.front[0][1]));
  const modules = [...parts.keys()].filter((k) => k.startsWith('module')).sort();
  const n = modules.length;
  const frontMid = (P.front[0][2] + P.front[1][2]) / 2;
  const apart = (key) => {
    if (key.startsWith('module')) return new THREE.Vector3(0, -1.25 * D, ((n - 1) / 2 - Number(key.slice(6))) * 0.16 * D);
    const c = parts.get(key).box.getCenter(new THREE.Vector3());
    return new THREE.Vector3(0, -0.85 * D, (c.z > frontMid ? 1 : -1) * 0.2 * D);
  };

  // A track: from its place on the table (D: the table's move of it) up and over to H (its waiting place: in front
  // of its bay, or the exploded view), then home along its axis.
  const tracks = [];
  const q = new THREE.Quaternion(), qi = new THREE.Quaternion(), p = new THREE.Vector3(), tmp = new THREE.Vector3();
  const track = (key, Dm, o) => {
    const part = parts.get(key);
    if (!part) return null;
    const c0 = part.box.getCenter(new THREE.Vector3());
    const p0 = c0.clone().applyMatrix4(Dm);
    const q0 = new THREE.Quaternion().setFromRotationMatrix(Dm);
    const H = c0.clone().add(o.wait);
    const lift = o.lift ?? 120;
    const tr = { key, part, c0, p0, q0, H, l1: p0.clone().add(new THREE.Vector3(0, 0, lift)),
      l2: H.clone().add(new THREE.Vector3(0, -lift * 0.5, lift * 0.35)), spin: 0, axis: null, kind: 'snap', fired: 0, ...o };
    tracks.push(tr);
    return tr;
  };
  // where a part is at p: on the table, flying, waiting, sliding home, home
  const pose = (tr, pp) => {
    const a = seg(pp, tr.fly[0], tr.fly[1]), b = seg(pp, tr.slide[0], tr.slide[1]);
    if (b > 0) {
      p.lerpVectors(tr.H, tr.c0, out5(b));
      q.identity();
      if (tr.spin) q.setFromAxisAngle(tr.axis, tr.spin * (1 - out3(b)));
    } else {
      const k = inOut(a);
      bez(tr.p0, tr.l1, tr.l2, tr.H, k, p);
      q.copy(tr.q0).slerp(qi, k);
    }
    for (const m of tr.part.meshes) {
      m.quaternion.copy(q);
      m.position.copy(p).sub(tmp.copy(tr.c0).applyQuaternion(q));
    }
  };

  // the adapter, then the bay screws of the open side
  track('adapter', mat4(T.pieces.adapter.move, dz), { fly: ADAPTER.fly, slide: ADAPTER.slide, wait: new THREE.Vector3(0, -170, 0), lift: 140, kind: 'thunk' });
  const screws = [];
  T.screws.forEach((s, j) => {
    if (parts.has('screw' + j)) screws.push({ key: 'screw' + j, s, side: s.size[0] > s.size[1], c: new THREE.Vector3(...s.at), D: mat4(s.move, dz) });
  });
  const hiddenKeys = [];
  let k = 0;
  for (const st of screws.filter((x) => x.side)) {
    if (st.s.hidden) { hiddenKeys.push(st.key); continue; }
    const s0 = SIDE_SCREWS.slide + SIDE_SCREWS.each * k++;
    track(st.key, st.D, { fly: SIDE_SCREWS.fly, slide: [s0, s0 + SIDE_SCREWS.len], wait: new THREE.Vector3(-34, 0, 0), lift: 60,
      spin: Math.PI * 6, axis: new THREE.Vector3(1, 0, 0), kind: 'screw' });
  }
  // the side panel shuts (its hinge: the fixed point of its turn on the table)
  let door = null;
  const sides = [];
  v.extras?.traverse((o) => { if (o.userData.role === 'side') sides.push(o); });
  if (T.panel && sides.length) {
    const Dp = mat4(T.panel.move);
    const ang = Math.atan2(Dp.elements[1], Dp.elements[0]);
    const tx = Dp.elements[12], ty = Dp.elements[13], ca = Math.cos(ang), sa = Math.sin(ang);
    // (I - R) h = t, in the plane
    const a11 = 1 - ca, a12 = sa, a21 = -sa, a22 = 1 - ca, det = a11 * a22 - a12 * a21;
    const hinge = new THREE.Vector3((tx * a22 - a12 * ty) / det, (a11 * ty - a21 * tx) / det, 0);
    door = { objs: sides.map((o) => ({ o, base: o.matrix.clone(), auto: o.matrixAutoUpdate })), ang, hinge, fired: false };
  }
  // the modules and the strip into the exploded view (staggered off the table), then in, top first; each one's
  // front screws wait ahead of it and go in once it is home
  const order = [...parts.keys()].filter((x) => x === 'filler' || x.startsWith('module'))
    .sort((a, b) => parts.get(b).box.max.z - parts.get(a).box.max.z);
  const front = screws.filter((x) => !x.side);
  const used = new Set();
  let last = 0;
  order.forEach((key, i) => {
    const piece = T.pieces[key];
    if (!piece) return;
    const off = apart(key);
    const f0 = MODULES.fly + MODULES.each * i, c0 = MODULES.close + MODULES.step * i;
    track(key, mat4(piece.move, dz), { fly: [f0, f0 + MODULES.len], slide: [c0, c0 + MODULES.slide], wait: off, lift: 110, kind: 'snap', size: key === 'filler' ? 0.8 : 1 });
    const box = parts.get(key).box;
    let m = 0;
    for (const st of front) {
      if (used.has(st.key) || st.c.z < box.min.z - 2 || st.c.z > box.max.z + 2) continue;
      used.add(st.key);
      const s0 = c0 + MODULES.slide * 0.8 + 0.008 * m++;
      track(st.key, st.D, { fly: [f0 + 0.02, f0 + MODULES.len + 0.02], slide: [s0, s0 + SCREW_SLIDE], wait: off.clone().add(new THREE.Vector3(0, -0.6 * D, 0)),
        lift: 70, spin: Math.PI * 6, axis: new THREE.Vector3(0, 1, 0), kind: 'screw' });
      last = Math.max(last, s0 + SCREW_SLIDE);
    }
  });
  // screws of no piece here go in at the end
  for (const st of front) if (!used.has(st.key)) {
    const s0 = Math.min(CABLES - SCREW_SLIDE, last);
    track(st.key, st.D, { fly: [MODULES.fly, MODULES.fly + MODULES.len], slide: [s0, s0 + SCREW_SLIDE], wait: new THREE.Vector3(0, -0.6 * D, 0),
      lift: 70, spin: Math.PI * 6, axis: new THREE.Vector3(0, 1, 0), kind: 'screw' });
  }

  const hidden = hiddenKeys.flatMap((key) => parts.get(key)?.meshes ?? []);
  const cablesWere = v.show.cables;
  const setCables = (on) => v.extras?.traverse((o) => { if (o.userData.role === 'cables') o.visible = on && cablesWere; });
  const doorAt = (a) => {
    if (!door) return;
    const R = new THREE.Matrix4().makeTranslation(door.hinge.x, door.hinge.y, 0)
      .multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(-door.hinge.x, -door.hinge.y, 0));
    for (const d of door.objs) { d.o.matrixAutoUpdate = false; d.o.matrix.copy(R).multiply(d.base); d.o.matrixWorldNeedsUpdate = true; }
  };
  // The camera turns about what it looks at rather than cutting straight across, by way of a wider shot halfway: it
  // looks between the table and the bays, from in front and above, far enough back for the pieces on their way and
  // the front of the PC. Each pose is what it looks at, the way to it and how far: a curve through the three.
  const key = (eye, aim) => { const d = eye.clone().sub(aim); return { aim: aim.clone(), dir: d.clone().normalize(), far: Math.log(d.length()) }; };
  const K0 = key(eye0, aim0);
  const via = (k) => [K0[k], K1[k], K2[k]];
  // (a quadratic through the middle one at 1/2)
  const thru = ([a, b, c], t) => {
    const u = 1 - t, w0 = u * u - u * t, w1 = 4 * u * t, w2 = t * t - u * t;
    return typeof a === 'number' ? a * w0 + b * w1 + c * w2
      : new THREE.Vector3().addScaledVector(a, w0).addScaledVector(b, w1).addScaledVector(c, w2);
  };
  const camAt = (u) => {
    const a = (1 - Math.cos(Math.PI * u)) / 2;            // (a gentle start: the pieces leave the table early)
    ctl.target.copy(thru(via('aim'), a));
    cam.position.copy(ctl.target).addScaledVector(thru(via('dir'), a).normalize(), Math.exp(thru(via('far'), a)));
    project(cam, {
      fov: proj0.fov + (fov1 - proj0.fov) * a,
      full: proj0.full.map((x, i) => x + (proj1.full[i] - x) * a),
      off: proj0.off.map((x, i) => x + (proj1.off[i] - x) * a),
      size: proj1.size,
    });
    ctl.update();
    cam.updateMatrixWorld();
  };

  // The page's layout: `img` where the film's picture is, `box` the 3D view's size (CSS px). Again whenever the page
  // is laid out anew (a resized window, a turned phone): the film's camera framed as its picture now is, the
  // configurator's view at the view's shape, and the bare table.
  const ray = new THREE.Ray();
  const reframe = (img, box) => {
    view = box;
    proj0 = filmProjection(T.camera, img, view);
    proj1 = { full: [view.width, view.height], off: [0, 0], size: [view.width, view.height] };
    end = v.fitPose(undefined, view.width / view.height);
    K2 = key(end.eye, end.target);
    K1 = { aim: new THREE.Vector3(0, aim0.y + (end.target.y - aim0.y) * 0.6, aim0.z + (end.target.z - aim0.z) * 0.8),
      dir: K0.dir.clone().add(K2.dir).normalize(), far: Math.log(Math.max(Math.exp(K0.far), BACK * Math.exp(K2.far))) };
    // the bare table: its corners where the film's frame puts them (the frame, half as big again about its centre),
    // down on the floor - from then on they are points of the 3D floor, wherever the camera goes
    camAt(0);
    const cx = img.left + img.width / 2, cy = img.top + img.height / 2;
    const W = img.width * PLATE_OVERSCAN, Hh = img.height * PLATE_OVERSCAN;
    corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, y]) => {
      const ndc = new THREE.Vector3(((cx + x * W) / view.width) * 2 - 1, 1 - ((cy + y * Hh) / view.height) * 2, 0.5);
      ray.origin.copy(cam.position);
      ray.direction.copy(ndc.unproject(cam)).sub(cam.position).normalize();
      return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -floorZ), new THREE.Vector3());
    });
  };
  reframe(img0, view0);

  // the sounds go with the way forward only (a breath as a piece leaves the table, its own one as it is home)
  const pan = (c) => Math.max(-0.6, Math.min(0.6, c.x / 160));
  let was = 0;
  const sounds = (pp) => {
    if (pp <= was) { was = pp; return; }
    const crossed = (x) => was < x && pp >= x;
    for (const tr of tracks) {
      if (tr.kind !== 'screw' && crossed(tr.fly[0] + 0.005)) sfx.lift(pan(tr.c0), 380);
      if (tr.kind === 'screw' && crossed(tr.slide[0] + (tr.slide[1] - tr.slide[0]) * 0.4)) sfx.screw(pan(tr.c0), 260, 3);
      if (tr.kind !== 'screw' && crossed(tr.slide[1] - 0.004)) {
        if (tr.kind === 'thunk') sfx.thunk(pan(tr.c0)); else sfx.snap(pan(tr.c0), tr.size ?? 1);
      }
    }
    if (door && crossed(DOOR[1] - 0.004)) sfx.thunk(-0.5);
    if (crossed(CABLES)) { sfx.plug(-0.2); setTimeout(() => sfx.plug(0.15), 70); setTimeout(() => sfx.plug(0.3), 150); }
    was = pp;
  };

  // the 3D view's shadows on the floor: as light as the film's on its table to begin with, the view's own once the
  // camera has left it
  const shade = v.floor.material, shadeWas = shade.opacity;
  let done = false;
  const at = (pp) => {
    if (done) return;
    camAt(seg(pp, CAM[0], CAM[1]));
    const s = seg(pp, SHADE[0], SHADE[1]);
    shade.opacity = shadeWas * (0.27 + 0.73 * s * s * (3 - 2 * s));
    for (const tr of tracks) pose(tr, pp);
    for (const m of hidden) m.visible = pp >= ADAPTER.slide[1];
    if (door) doorAt(door.ang * (1 - inOut(seg(pp, DOOR[0], DOOR[1]))));
    setCables(pp >= CABLES);
    sounds(pp);
    v.dirty = true;
  };
  at(0);

  const finish = () => {
    if (done) return;
    done = true;
    shade.opacity = shadeWas;
    for (const tr of tracks) for (const m of tr.part.meshes) { m.position.set(0, 0, 0); m.quaternion.identity(); }
    for (const m of hidden) m.visible = true;
    v.setVisible('cables', cablesWere);
    if (door) for (const d of door.objs) { d.o.matrix.copy(d.base); d.o.matrixAutoUpdate = d.auto; d.o.matrix.decompose(d.o.position, d.o.quaternion, d.o.scale); }
    cam.position.copy(end.eye);
    ctl.target.copy(end.target);
    cam.clearViewOffset();
    cam.fov = fov1;
    v.resize();
    ctl.update();
    v.dirty = true;
  };

  // the bare table as the camera sees it now: a CSS matrix3d for a picture of w x h px laid at the view's corner
  // (null: a corner of it is behind the camera)
  const plateMatrix = (w, h) => {
    const vm = cam.matrixWorldInverse;
    const qd = [];
    for (const c of corners) {
      if (!c || tmp.copy(c).applyMatrix4(vm).z > -1) return null;
      tmp.copy(c).project(cam);
      qd.push({ x: (tmp.x + 1) / 2 * view.width, y: (1 - tmp.y) / 2 * view.height });
    }
    const [a, b, c, d, e, f, g, hh] = squareTo(qd);
    const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1];
    return `matrix3d(${m.map((x) => +x.toFixed(9)).join(',')})`;
  };
  return { at, finish, plateMatrix, reframe: (img, box) => { if (!done) reframe(img, box); }, model: v.model };
}

// (a glide or a settle of the view under way would fight the film's camera)
function stopOthers(v) {
  v.stopFly?.();
  v.stopArrive?.();
  if (v.model) { v.model.scale.setScalar(1); v.model.position.set(0, 0, 0); }
}
