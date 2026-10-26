// The parts of the preview that are not printed: real-looking PC cases, client PCs,
// an access point and network cables. bay2rack.scad sends the numbers (SCENE echo lines).
// World axes as in OpenSCAD: X width, Y depth (+Y into the case), Z up, fronts face -Y.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT } from './materials.js';

const YZX = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);   // shape (y, z) + extrude -> world (x)

function tiled(mat, size) {
  for (const k of ['map', 'bumpMap', 'roughnessMap', 'alphaMap']) {
    if (!mat[k]) continue;
    mat[k] = mat[k].clone();
    mat[k].repeat.set(1 / size, 1 / size);
    mat[k].needsUpdate = true;
  }
  return mat;
}

function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// box from its min corner and size
function box(x0, y0, z0, sx, sy, sz, mat, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(r, sx / 2, sy / 2, sz / 2)) : new THREE.BoxGeometry(sx, sy, sz);
  const m = mesh(g, mat);
  m.position.set(x0 + sx / 2, y0 + sy / 2, z0 + sz / 2);
  return m;
}

function cyl(x, y, z, r, len, mat, axis = 'y', seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === 'y') { /* cylinder axis is Y already */ } else if (axis === 'z') g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2);
  const m = mesh(g, mat);
  m.position.set(x, y, z);
  return m;
}

function rrect(path, x, y, w, h, r) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

// a front panel in the XZ plane with rectangular cut-outs, front face at yFront, `depth` deep
function frontPanel({ x0, z0, w, h, r = 8 }, holes, yFront, depth, mat) {
  const s = rrect(new THREE.Shape(), x0, z0, w, h, r);
  for (const [a, b, c, d] of holes) s.holes.push(rrect(new THREE.Path(), a, c, b - a, d - c, 1.5));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.4, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(Math.PI / 2);
  g.translate(0, yFront + depth + 1.6, 0);
  return mesh(g, mat);
}

// a side panel in the YZ plane, optional rounded window cut-out (returned as its rectangle)
function sidePanel(x, y0, z0, d, h, t, mat, win, round = []) {
  const s = rrect(new THREE.Shape(), y0, z0, d, h, 3);
  if (win) s.holes.push(rrect(new THREE.Path(), win[0], win[1], win[2], win[3], 10));
  for (const [cy, cz, r] of round) s.holes.push(new THREE.Path().absarc(cy, cz, r, 0, Math.PI * 2, true));
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 10 });
  g.applyMatrix4(YZX);
  g.translate(x, 0, 0);
  return mesh(g, mat);
}

function plane(cx, cy, cz, sx, sz, mat, normal = 'y') {
  const g = new THREE.PlaneGeometry(sx, sz);
  if (normal === 'y') g.rotateX(Math.PI / 2);          // facing -Y (towards the viewer)
  else if (normal === 'x') g.rotateY(-Math.PI / 2).rotateX(Math.PI / 2);
  else if (normal === 'z') { /* XY plane */ }
  const m = mesh(g, mat, false);
  m.position.set(cx, cy, cz);
  return m;
}

// a shape in the XZ plane extruded along +Y from y0 (panels with cut-outs)
function slab(shape, y0, depth, mat, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  g.rotateX(Math.PI / 2);
  g.translate(0, y0 + depth, 0);
  return mesh(g, mat);
}

// a case fan as made: a square frame with a round bore and screw holes (size x size x 25 for 120 mm),
// seven curved blades on a hub with its sticker, faces -Y, front face at y
function fan(cx, y, cz, size, frameMat) {
  const g = new THREE.Group();
  const depth = Math.round(size * 0.21);
  const r = size / 2 - 3;
  const s = rrect(new THREE.Shape(), cx - size / 2, cz - size / 2, size, size, size * 0.06);
  s.holes.push(new THREE.Path().absarc(cx, cz, r, 0, Math.PI * 2, true));
  const hole = size * 0.0875 / 2, off = size / 2 - size * 0.075;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
    s.holes.push(new THREE.Path().absarc(cx + sx * off, cz + sz * off, hole, 0, Math.PI * 2, true));
  g.add(slab(s, y, depth, frameMat, 32));
  const blades = MAT.plastic(0x1e1f23, 0.4);
  g.add(cyl(cx, y + depth / 2, cz, r * 0.36, depth * 0.7, MAT.plastic(0x18191c, 0.5), 'y', 40));
  g.add(cyl(cx, y + depth * 0.15 - 0.2, cz, r * 0.26, 0.4, MAT.plastic(0x2a2b30, 0.6), 'y', 40));   // hub sticker
  // one blade: a swept outline from the hub to the bore, wider at the tip, 1.6 mm thick and pitched
  const rh = r * 0.34, rt = r - 1.5;
  const bs = new THREE.Shape();
  bs.moveTo(-r * 0.1, rh);
  bs.quadraticCurveTo(-r * 0.05, (rh + rt) / 2, -r * 0.02, rt);
  bs.quadraticCurveTo(r * 0.2, rt + 1, r * 0.4, rt - 3);
  bs.quadraticCurveTo(r * 0.24, (rh + rt) / 2, r * 0.14, rh);
  bs.quadraticCurveTo(0, rh - 2, -r * 0.1, rh);
  const bladeGeo = new THREE.ExtrudeGeometry(bs, { depth: 1.6, bevelEnabled: false, curveSegments: 10 });
  bladeGeo.translate(0, 0, -0.8);
  for (let i = 0; i < 7; i++) {
    const blade = mesh(bladeGeo, blades);
    blade.rotation.y = 0.55;                     // the pitch, about the blade's own radius
    const pivot = new THREE.Group();
    pivot.add(blade);
    pivot.rotation.x = Math.PI / 2;              // the shape's plane faces the fan's axis (Y)
    const spin = new THREE.Group();
    spin.add(pivot);
    spin.position.set(cx, y + depth / 2, cz);
    spin.rotation.y = (i / 7) * Math.PI * 2;
    g.add(spin);
  }
  return g;
}

// a wire fan guard (rings and four spokes that end on the outer ring), in the XZ plane at y
function fanGuard(cx, y, cz, size, mat = MAT.steel()) {
  const g = new THREE.Group();
  const R = size / 2 - 3;
  for (let r = R; r > 8; r -= R / 5.2) {
    const ring = mesh(new THREE.TorusGeometry(r, 0.9, 6, 72), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, y, cz);
    g.add(ring);
  }
  g.add(cyl(cx, y, cz, R * 0.22, 1.6, mat, 'y'));
  for (let a = 0; a < 4; a++) {
    const spoke = box(-0.9, -0.9, 0, 1.8, 1.8, R, mat);
    const pivot = new THREE.Group();
    pivot.add(spoke);
    pivot.position.set(cx, y, cz);
    pivot.rotation.y = Math.PI / 4 + (a * Math.PI) / 2;
    g.add(pivot);
  }
  return g;
}

// ATX power supply, rear face: honeycomb, IEC C14 inlet with its three pins, rocker switch, four screws.
// x0 / z0: lower left corner seen from the back is x0 + 150; the face is 150 x 86 at y
function psuFace(g, x0, y, z0) {
  const face = tiled(MAT.powder(0x141518), 40);
  g.add(box(x0, y, z0, 150, 1.4, 86, face, 1));
  g.add(plane(x0 + 50, y + 1.6, z0 + 43, 84, 70, perforated(0x1b1c1f, 84, 70), 'y'));
  g.add(plane(x0 + 50, y + 0.5, z0 + 43, 84, 70, MAT.plastic(0x050506, 0.9), 'y'));
  const inlet = x0 + 122, iz = z0 + 50;
  g.add(box(inlet - 13.5, y + 1.4, iz - 10, 27, 3, 20, MAT.plastic(0x0d0d0f, 0.6), 1.5));
  g.add(box(inlet - 10, y + 2.6, iz - 7, 20, 2, 13, MAT.plastic(0x030303, 0.9)));
  for (const [px, pz] of [[-4.5, -1.5], [4.5, -1.5], [0, 3]]) g.add(box(inlet + px - 1, y + 2.4, iz + pz - 2, 2, 1.4, 4, MAT.steel()));
  g.add(box(inlet - 7, y + 1.4, z0 + 18, 14, 3, 18, MAT.plastic(0x0d0d0f, 0.6), 1));          // rocker switch
  g.add(box(inlet - 5.5, y + 3.6, z0 + 19.5, 11, 1.6, 7, MAT.plastic(0x1b1c1f, 0.4), 0.6));
  for (const [sx, sz] of [[6, 6], [144, 6], [6, 80], [144, 80]]) g.add(cyl(x0 + sx, y + 1.8, z0 + sz, 2.4, 1.2, MAT.zinc()));
}

// rear I/O shield of the board (44.45 x 158.75, ATX), ports from the top: USB pairs, LAN, video,
// USB 3 pairs, audio jacks
function ioShield(g, x0, y, zTop) {
  const W = 44.45, H = 158.75;
  g.add(box(x0, y, zTop - H, W, 0.8, H, tiled(MAT.brushed(0xb4b8be), 20)));
  const port = (z, w, hgt, tongue = null) => {
    g.add(box(x0 + W / 2 - w / 2, y + 0.6, z, w, 1.4, hgt, MAT.plastic(0x050506, 0.9)));
    if (tongue) g.add(box(x0 + W / 2 - w / 2 + 1.5, y + 1.4, z + hgt * 0.45, w - 3, 0.8, hgt * 0.22, MAT.plastic(tongue, 0.4)));
  };
  let z = zTop - 8;
  for (let i = 0; i < 2; i++) { z -= 7; port(z, 14, 6, 0x16171a); }       // USB 2
  z -= 17; port(z, 16, 14);                                                  // LAN with its LEDs
  g.add(box(x0 + W / 2 - 7, y + 1.8, z + 12.2, 2.4, 0.6, 1.4, MAT.led(0x3ddc84, 2)));
  g.add(box(x0 + W / 2 + 4.6, y + 1.8, z + 12.2, 2.4, 0.6, 1.4, MAT.led(0xf5d142, 2)));
  z -= 10; port(z, 16, 6);                                                   // HDMI
  z -= 10; port(z, 17, 6.5);                                                 // DisplayPort
  for (let i = 0; i < 4; i++) { z -= 8; port(z, 14, 6, 0x2a5bd7); }       // USB 3
  [0x6fbcff, 0x7ed957, 0xff7ab3, 0xf28c28, 0x111111].forEach((c, i) => {     // audio jacks
    const jz = zTop - H + 12 + (i % 3) * 11, jx = x0 + W / 2 + (i < 3 ? -7 : 7);
    g.add(cyl(jx, y + 1, jz, 3.6, 1.6, MAT.plastic(c, 0.4)));
    g.add(cyl(jx, y + 1.4, jz, 1.8, 1.6, MAT.plastic(0x030303, 0.9)));
  });
}

// perforated steel on a plane w x h mm, holes at `pitch` (the texture has 8 holes a tile)
function perforated(color, w, h, pitch = 5) {
  const m = MAT.mesh(color);
  m.alphaMap = m.alphaMap.clone();
  m.alphaMap.repeat.set(w / (pitch * 8), h / (pitch * 8));
  return m;
}

// a round stamped opening (dark) behind a wire guard, the fan inside, on a rear face at y
function rearFan(g, x, y, z, size, guardMat) {
  g.add(cyl(x, y - 0.4, z, size / 2 - 2, 0.8, MAT.plastic(0x060607, 0.9), 'y', 48));
  g.add(fanGuard(x, y + 1, z, size, guardMat));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(cyl(x + sx * size * 0.4, y + 0.4, z + sz * size * 0.4, 2, 1, MAT.zinc()));
}

// expansion slot cover: brushed steel with its vent slots, the screw that holds it at the top end
function slotCover(g, x0, len, y, zc) {
  g.add(box(x0, y, zc - 8.2, len, 1, 16.4, tiled(MAT.brushed(0x8d9298), 20)));
  for (let k = 0; k < 6; k++) g.add(box(x0 + 18 + k * 13, y + 0.8, zc - 3, 8, 0.4, 6, MAT.plastic(0x050506, 0.9), 0.5));
}

// ------------------------------------------------------------------ cases
const CASE_STYLES = {
  definer5:     { body: 0x1a1b1e, front: 'door', frontColor: 0x232427, window: true, top: 'solid' },
  obsidian750d: { body: 0x18191c, front: 'brushed', frontColor: 0x34363a, window: true, top: 'mesh' },
  antec300:     { body: 0x121315, front: 'mesh', frontColor: 0x141517, window: false, top: 'fan' },
  enthoopro:    { body: 0x161719, front: 'brushed', frontColor: 0x222326, window: true, top: 'mesh' },
  definexlr2:   { body: 0x1a1b1e, front: 'door', frontColor: 0x232427, window: true, top: 'solid' },
  haf932:       { body: 0x101113, front: 'mesh', frontColor: 0x121314, window: false, top: 'fan' },
  stacker830:   { body: 0xb6bac0, front: 'bays', frontColor: 0xaeb2b8, window: false, top: 'solid', metal: true },
  // a "sleeper": a 90s beige tower outside, a modern server inside
  sleeper:      { body: 0xcbc2a8, front: 'retro', frontColor: 0xd6cdb4, window: false, top: 'solid', sleeper: true },
};

// a named sub-group of a case: the Blender video moves these as single parts
function part(parent, name) {
  const p = new THREE.Group();
  p.name = name;
  parent.add(p);
  return p;
}

// 90s tower controls: keylock, LEDs, MHz display, turbo / reset and the big power key
function retroControls(g, x, y, zTop, small = false) {
  const steel = MAT.steel();
  const key = MAT.plastic(0xcfc6ad, 0.5);
  key.name = 'case_front';
  g.add(cyl(x, y - 1, zTop - 12, 7, 3, steel));                                   // keylock
  g.add(box(x - 0.8, y - 2.8, zTop - 16, 1.6, 0.6, 8, MAT.plastic(0x101010, 0.8)));
  [0x3ddc84, 0xf5d142, 0xff4d4d].forEach((c, i) =>                                  // POWER, TURBO, HDD
    g.add(box(x - 9 + i * 7, y - 1.2, zTop - 30, 4, 1.4, 2.4, MAT.led(c, i === 1 ? 2.4 : 2.8))));
  if (!small) {
    // the turbo MHz display: smoked window and three red seven-segment digits
    g.add(box(x - 13, y - 1.4, zTop - 54, 26, 1.4, 16, MAT.gloss(0x1a0d0d)));
    const seg = MAT.led(0xff3b30, 3.2);
    const digit = (dx, on) => {
      const S = [[1, 12, 6, 1.4], [0, 6.6, 1.4, 5.4], [7, 6.6, 1.4, 5.4], [1, 6, 6, 1.4], [0, 0.6, 1.4, 5.4], [7, 0.6, 1.4, 5.4], [1, 0, 6, 1.4]];
      on.forEach((k) => g.add(box(x - 11 + dx + S[k][0], y - 1.8, zTop - 52 + S[k][1], S[k][2], 0.4, S[k][3], seg)));
    };
    // segments: 0 top, 1 upper left, 2 upper right, 3 middle, 4 lower left, 5 lower right, 6 bottom -> "133"
    digit(0, [2, 5]);
    digit(8, [0, 2, 3, 5, 6]);
    digit(16, [0, 2, 3, 5, 6]);
    g.add(box(x - 8, y - 1.8, zTop - 70, 16, 3, 8, key, 1.2));                  // turbo
    g.add(box(x - 4, y - 1.8, zTop - 84, 8, 3, 7, key, 1.2));                   // reset
  }
}

// a 3.5in floppy drive face
function floppy(g, x, y, z, w = 102) {
  const face = MAT.plastic(0xd2c9b0, 0.5);
  face.name = 'case_front';
  g.add(box(x - w / 2, y, z, w, 5, 25, face, 1));
  g.add(box(x - w / 2 + 8, y - 0.4, z + 13, w - 30, 0.8, 3.4, MAT.plastic(0x141414, 0.85)));
  g.add(box(x + w / 2 - 20, y - 1, z + 4, 12, 1.4, 5, MAT.plastic(0xc4bba2, 0.5), 1));
  g.add(box(x - w / 2 + 10, y - 0.6, z + 5, 4, 0.8, 2, MAT.led(0x3ddc84, 1.6)));
}

function frontIO(g, xr, y, z, dark) {
  const ring = MAT.steel();
  g.add(cyl(xr, y - 1.2, z, 7.5, 2.4, ring));
  g.add(cyl(xr, y - 1.6, z, 6.2, 2.4, MAT.plastic(dark ? 0x0d0e10 : 0xd8d5cc, 0.35)));
  g.add(cyl(xr, y - 2.0, z, 6.6, 0.6, MAT.led(0x8fd0ff, 2.2)));
  for (let i = 0; i < 2; i++) {
    g.add(box(xr - 34 - i * 17, y - 0.6, z - 3, 13, 1.2, 5.5, MAT.gloss(0x050506), 0.5));
    g.add(box(xr - 32.5 - i * 17, y - 0.9, z - 1, 10, 0.6, 1.6, MAT.plastic(0x2a5bd7, 0.4)));
  }
  g.add(cyl(xr - 62, y - 0.8, z, 2.6, 1.4, MAT.gloss(0x050506)));
  g.add(cyl(xr - 70, y - 0.8, z, 2.6, 1.4, MAT.gloss(0x050506)));
}

function finStack(x0, y0, z0, sx, sy, sz, n, mat) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) g.add(box(x0, y0 + (i * sy) / n, z0, sx, Math.max(0.5, sy / n * 0.35), sz, mat));
  return g;
}

// A modern server board in the tower, laid out like a real ATX board (305 x 244 mm) on the
// motherboard tray: rear I/O at the back edge under the roof, CPU with a tower cooler, the DIMMs
// on the front side of the CPU, PCIe slots that line up with the case's expansion slots,
// M.2 heatsinks between the slots, chipset at the bottom front. Cards hang component side down.
export const ATX = { top: 40, height: 305, depth: 244, rear: 18, slot0: 175, pitch: 20.32 };
function interior(g0, c, xWall) {
  const g = part(g0, 'guts');
  const { w, d, z0, z1 } = c;
  const s = xWall > 0 ? -1 : 1;                 // towards the inside of the case
  const xs = (v) => xWall + s * v;              // distance from the motherboard tray
  const span = (a, b) => [Math.min(xs(a), xs(b)), Math.abs(b - a)];
  const BS = 7.6;                               // board surface: 6 mm standoffs + 1.6 mm board
  const on = (a, b) => span(BS + a, BS + b);    // a..b mm above the board surface
  const alu = tiled(MAT.brushed(0xc4c9cf), 20);
  const dark = (col) => tiled(MAT.brushed(col), 20);
  const black = MAT.plastic(0x16171a, 0.5);
  const mbTop = z1 - ATX.top, mbZ = mbTop - ATX.height, mbY = d - ATX.rear - ATX.depth;
  const slotZ = (i) => mbTop - ATX.slot0 - i * ATX.pitch;
  const add = (grp, [x, sx], y, z, sy, sz, mat, r = 0) => grp.add(box(x, y, z, sx, sy, sz, mat, r));

  // the motherboard tray between the board and the side panel, with the cut-out for the CPU backplate
  // (what a window on that side shows)
  g.add(sidePanel(xs(1.2), 30, z0 + 20, d - 40, z1 - z0 - 40, 1.2, tiled(MAT.powder(0x1c1d20), 50),
    [mbY + 96, mbTop - 175, 100, 150]));
  const mb = part(g, 'part_board');
  // the cooler's backplate on the back of the board, its four screws (through the tray's cut-out)
  add(mb, span(4.4, 6), mbY + 103, mbTop - 133, 70, 70, tiled(MAT.brushed(0x6d7279), 12), 2);
  for (const [dy, dz] of [[-26, -26], [26, -26], [26, 26], [-26, 26]])
    mb.add(cyl(xs(4), mbY + 138 + dy, mbTop - 98 + dz, 3.4, 1.6, MAT.zinc(), 'x', 16));
  add(mb, span(6, BS), mbY, mbZ, ATX.depth, ATX.height, MAT.board());
  add(mb, on(0, 26), d - ATX.rear - 26, mbTop - 160, 26, 150, MAT.powder(0x2a2c30));          // rear I/O stack
  add(mb, on(0, 22), mbY + 110, mbTop - 28, 116, 18, dark(0x3a3d42));                          // VRM heatsinks
  add(mb, on(0, 22), d - ATX.rear - 40, mbTop - 150, 18, 110, dark(0x3a3d42));
  add(mb, on(0, 12), mbY + 40, mbZ + 20, 45, 45, dark(0x2f3236));                              // chipset
  add(mb, on(0, 14), mbY, mbTop - 150, 8, 52, black);                                        // 24-pin socket
  // PCIe slots: x16 (the first two with steel armour), x1 and x4, as on an ATX board; a card's slot is x16
  const steel = tiled(MAT.brushed(0xb9bec5), 12);
  ['x16a', 'x16a', 'x1', 'x16', 'x1', 'x1', 'x4'].forEach((k, i) => {
    const kind = i === c.nic || (c.style === 'sleeper' && i === 3) ? 'x16a' : k;
    const len = kind.startsWith('x16') ? 89 : kind === 'x4' ? 39 : 25;
    add(mb, on(0, 8), d - ATX.rear - 6 - len, slotZ(i) - 3.2, len, 6.4, kind === 'x16a' ? steel : black);
    add(mb, on(8, 8.4), d - ATX.rear - 6 - len + 2, slotZ(i) - 0.5, len - 4, 1, MAT.plastic(0x050506, 0.9));   // the slit
    if (kind.startsWith('x16')) add(mb, on(0, 10), d - ATX.rear - 6 - len - 6, slotZ(i) - 3.2, 6, 6.4, black);    // latch
  });
  // M.2 drives under flat heatsinks with grooves, between the slots
  for (const [a, b] of [[0, 1], [2, 3]]) {
    const z = (slotZ(a) + slotZ(b)) / 2 - 11;
    add(mb, on(0, 4), mbY + 70, z, 80, 22, dark(0x4a4e55), 1);
    for (let k = 0; k < 4; k++) add(mb, on(4, 4.3), mbY + 72, z + 3 + k * 5, 76, 1.2, MAT.plastic(0x101113, 0.8));
  }
  // EPS (CPU power) socket at the top edge, behind the VRM heatsink
  add(mb, on(0, 12), mbY + 130, mbTop - 12, 20, 9, black);

  // CPU tower cooler: fin stack and heat pipes over the socket, 120 mm fan on its front side
  const cooler = part(g, 'part_cooler');
  const [fx, fw] = on(4, 154);
  cooler.add(finStack(fx, mbY + 112, mbTop - 160, fw, 52, 125, 28, alu));
  for (let i = 0; i < 4; i++) cooler.add(cyl(xs(BS + 76), mbY + 118 + i * 12, mbTop - 98, 3, 150, MAT.gold(), 'x'));
  cooler.add(fan(xs(BS + 84), mbY + 106, mbTop - 98, 120, black));

  // four DIMMs between the CPU and the front edge of the board, with light bars
  const ram = part(g, 'part_ram');
  for (let i = 0; i < 4; i++) {
    const y = mbY + 22 + i * 9;
    add(ram, on(0, 6), y - 0.8, mbTop - 176, 8, 145, black);                                    // slot
    for (const z of [mbTop - 179, mbTop - 34]) add(ram, on(0, 9), y - 0.8, z, 8, 3, MAT.plastic(0x2a2b2f, 0.5));   // latches
    add(ram, on(4, 34), y, mbTop - 170, 6.4, 133, dark(0x2c2f35), 1);                          // heat spreader
    add(ram, on(34, 34.8), y + 2.6, mbTop - 166, 1.2, 125, MAT.led(0x9fb6ff, 0.5));            // a thin diffused light line
  }

  // PSU at the bottom rear, its cable bundle up to the 24-pin socket
  const psu = part(g, 'part_psu');
  psu.add(box(-w / 2 + 8, d - 1.4 - 150, z0 + 6, 150, 150, 86, MAT.powder(0x111214), 1));
  psu.add(box(-w / 2 + 30, d - 1.4 - 150 - 0.6, z0 + 20, 100, 0.6, 50, MAT.plastic(0xd8d8d2, 0.6)));   // rating label
  // the shroud over the PSU (from behind the drive cage to the back), a vent strip on top
  const inner = tiled(MAT.powder(0x1c1d20), 50);
  const shZ = Math.min(z0 + 104, mbZ - 4), shX0 = -w / 2 + 1.4, shX1 = xs(1.2);
  psu.add(box(shX0, 186, z0 + 1.4, shX1 - shX0, d - 1.4 - 186, shZ - z0 - 1.4, inner, 2));
  psu.add(plane((shX0 + shX1) / 2 + 20, d - 120, shZ + 0.3, 110, 60, perforated(0x0c0c0d, 110, 60, 5), 'z'));
  psu.add(box(shX0 + 6, 185.4, shZ - 22, 60, 1, 14, MAT.plastic(0xd9dadc, 0.6), 1));          // the maker's badge
  // sleeved cables come through rubber grommets in the tray, next to their sockets
  const grommet = (y, z, len) => {
    add(psu, span(1.2, 4), y - 7, z - len / 2, 14, len, MAT.rubber(), 3);
    add(psu, span(4, 4.4), y - 0.6, z - len / 2 + 3, 1.2, len - 6, MAT.plastic(0x020202, 0.9));
  };
  const sleeved = (pts, rows, cols, r, col = 0x111214) => {
    const mat = MAT.plastic(col, 0.55);
    for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) {
      const ra = (a - (rows - 1) / 2) * r * 1.5;      // rows on the diagonal: apart both leaving the tray (X) and at the socket (Y)
      const off = new THREE.Vector3(ra, ra, (b - (cols - 1) / 2) * r * 2.1);
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(off)), false, 'centripetal');
      psu.add(mesh(new THREE.TubeGeometry(curve, 24, r, 6, false), mat));
    }
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pin24 = mbTop - 124;
  grommet(mbY - 30, pin24, 70);
  sleeved([V(xs(3), mbY - 30, pin24), V(xs(22), mbY - 34, pin24), V(xs(BS + 14), mbY - 20, pin24), V(xs(BS + 7), mbY - 2, pin24)], 2, 12, 1.4);
  grommet(mbY + 140, mbTop + 9, 16);
  sleeved([V(xs(3), mbY + 140, mbTop + 9), V(xs(BS + 18), mbY + 140, mbTop + 8), V(xs(BS + 12), mbY + 140, mbTop - 6)], 2, 4, 1.4);

  // 3.5in drives in the front cage at the bottom, SATA cables to the board's front edge
  const drives = part(g, 'part_drives');
  // the cage they slide into: two side walls with the rails, a roof, the screws of each drive
  const cageMat = tiled(MAT.brushed(0x8d9298), 40);
  for (const x of [-w / 2 + 19, -w / 2 + 22 + 101.6 + 0.4]) drives.add(box(x, 20, z0 + 16, 2.6, 160, 104, cageMat));
  drives.add(box(-w / 2 + 19, 20, z0 + 117, 101.6 + 6, 160, 1.2, cageMat));
  for (let i = 0; i < 3; i++) {
    const zz = z0 + 26 + i * 30;
    for (const y of [50, 130]) drives.add(cyl(-w / 2 + 19 - 0.4, y, zz + 7, 2.6, 1.2, MAT.zinc(), 'x'));
    drives.add(box(-w / 2 + 50, 171, zz + 4, 40, 3, 8, MAT.plastic(0x101010, 0.6)));            // SATA data + power
    add(mb, on(0, 9), mbY - 1, mbZ + 26 + i * 8, 11, 7, MAT.plastic(0x101012, 0.5));              // board SATA port
  }
  for (let i = 0; i < 3; i++) {
    const zz = z0 + 26 + i * 30;
    drives.add(box(-w / 2 + 22, 24, zz, 101.6, 147, 26, tiled(MAT.brushed(0x9ea3aa), 30)));
    drives.add(box(-w / 2 + 22, 24 + 20, zz + 26, 101.6, 80, 0.4, MAT.plastic(0xe9e9e6, 0.5)));   // label
    // out of the back of the drive, up in front of the PSU shroud, over it to the board's SATA ports
    const shTop = Math.min(z0 + 104, mbZ - 4), pz = mbZ + 29.5 + i * 8;
    const sata = new THREE.CatmullRomCurve3([new THREE.Vector3(-w / 2 + 70, 172, zz + 13),
      new THREE.Vector3(-w / 2 + 74 + i * 6, 180, Math.max(zz + 20, shTop + 8)), new THREE.Vector3(xs(BS + 30), 186, shTop + 14 + i * 5),
      new THREE.Vector3(xs(BS + 14), mbY - 22, pz), new THREE.Vector3(xs(BS + 4.5), mbY - 1, pz)], false, 'centripetal');
    drives.add(mesh(new THREE.TubeGeometry(sata, 30, 2.2, 8, false), MAT.plastic(i === 1 ? 0x101010 : 0xb32020, 0.4)));
  }
}

// low-profile graphics card (a server only needs a display output): board, shroud and a small fan
function lowProfileGPU(g, x0, len, zc, d) {
  const gpu = part(g, 'part_gpu');
  gpu.add(box(x0, d - 0.6, zc - 9, len, 1.2, 18, tiled(MAT.brushed(0x2a2c30), 20)));
  for (let i = 0; i < 3; i++) gpu.add(box(x0 + 22 + i * 24, d - 0.2, zc - 4, 16, 1.6, 7, MAT.plastic(0x0b0b0c, 0.7)));
  const xr = x0 + len + 3;
  gpu.add(box(xr - 68, d - 172, zc - 6, 68, 170, 1.6, MAT.pcb()));
  gpu.add(box(xr - 66, d - 160, zc - 21, 60, 150, 15, MAT.plastic(0x1a1b1e, 0.45), 3));      // shroud, under the board
  gpu.add(cyl(xr - 36, d - 90, zc - 21.5, 25, 1.6, MAT.plastic(0x0f1012, 0.5), 'z'));
  gpu.add(box(xr - 5, d - 172, zc - 7.5, 5, 90, 4.6, MAT.gold()));
}

// 4-port server network card: bracket with the RJ45 ports and link LEDs at the rear, the board
// inside the case (low profile, parallel to the floor in a tower) with its heatsink
function networkCard(g0, ports, x0, len, zc, d) {
  const g = part(g0, 'part_nic');
  g.add(box(x0, d - 0.6, zc - 9, len, 1.2, 18, tiled(MAT.brushed(0xc9ced4), 20)));
  for (const [x, , z] of ports) {
    g.add(box(x - 8, d - 0.2, z - 6.8, 16, 1.6, 13.6, MAT.plastic(0x0b0b0c, 0.7)));
    g.add(box(x - 4.5, d + 1.3, z + 3, 9, 0.3, 1.2, MAT.gold()));
    g.add(box(x - 7, d + 1.4, z - 6.4, 2.4, 0.3, 1.6, MAT.led(0x3ddc84, 2.4)));
    g.add(box(x + 4.6, d + 1.4, z - 6.4, 2.4, 0.3, 1.6, MAT.led(0xf5d142, 2.2)));
  }
  const xr = x0 + len + 3;                      // the board edge sits in the slot on the motherboard
  g.add(box(xr - 66, d - 168, zc - 6, 66, 166, 1.6, MAT.pcb()));
  g.add(finStack(xr - 52, d - 120, zc - 15, 30, 30, 9, tiled(MAT.brushed(0x9aa0a8), 20)));   // under the board
  g.add(box(xr - 5, d - 168, zc - 7.5, 5, 90, 4.6, MAT.gold()));       // edge connector in the x8 slot
}

export function buildCase(c) {
  const st = c.style === 'sleeper' ? CASE_STYLES.sleeper : CASE_STYLES[c.id] ?? CASE_STYLES.obsidian750d;
  const root = new THREE.Group();
  const g = part(root, 'shell');
  const { w, h, d, z0, z1, fd } = c;
  const [bayW, bayH, pitch, bezelW, bezelH1, cageT] = c.bay;
  const t = 1.4;
  const body = tiled(st.metal ? MAT.brushed(st.body) : MAT.powder(st.body), 50);
  body.name = 'case_body';

  // chassis
  const winRect = st.window ? [70, z0 + 40, d - 110, h - 80] : null;
  const winSide = c.window === 'right' ? 1 : -1;
  const sideG = part(root, 'side_panel');
  const side = sidePanel(winSide > 0 ? w / 2 - t : -w / 2, 0, z0, d, h, t, body, st.window ? winRect : null);
  side.userData.role = 'side';
  sideG.add(side);
  part(root, 'side_panel_mb').add(sidePanel(winSide > 0 ? -w / 2 : w / 2 - t, 0, z0, d, h, t, body, null));
  if (st.window) {
    const glass = plane(winSide * (w / 2 - t / 2), winRect[0] + winRect[2] / 2, winRect[1] + winRect[3] / 2, winRect[2], winRect[3], MAT.glass(), 'x');
    glass.userData.role = 'side';
    sideG.add(glass);
  }
  part(root, 'top_panel').add(box(-w / 2, 0, z1 - t, w, d, t, body));
  g.add(box(-w / 2, 0, z0, w, d, t, body));
  // rear wall, cut like the real sheet: a round bore for the exhaust fan next to the I/O shield, the I/O and
  // PSU openings (both fill them flush), one opening per expansion slot (the covers sit outside) and a
  // honeycomb vent field beside the slots
  const fanX = Math.min(-10, w / 2 - 60 - 66), fanZ = z1 - 120;
  const [px0, pztop, ppitch, pl] = c.pci?.length === 4 ? c.pci : [w / 2 - 18 - 112, z1 - ATX.top - ATX.slot0, ATX.pitch, 112];
  const slotZ = (i) => pztop - i * ppitch;
  const rearWall = rrect(new THREE.Shape(), -w / 2, z0, w, h, 2);
  const cut = (x0, z0_, x1, z1_) => rearWall.holes.push(rrect(new THREE.Path(), x0, z0_, x1 - x0, z1_ - z0_, 1));
  rearWall.holes.push(new THREE.Path().absarc(fanX, fanZ, 58, 0, Math.PI * 2, true));
  cut(w / 2 - 60, z1 - ATX.top - 4 - 158.75, w / 2 - 60 + 44.45, z1 - ATX.top - 4);
  cut(-w / 2 + 8, z0 + 6, -w / 2 + 158, z0 + 92);
  for (let i = 0; i < 7; i++) cut(px0 + 4, slotZ(i) - 6.5, px0 + pl - 4, slotZ(i) + 6.5);
  const hex = (cx, cz, r) => {
    const h6 = new THREE.Path();
    for (let k = 0; k < 6; k++) h6[k ? 'lineTo' : 'moveTo'](cx + r * Math.cos(k * Math.PI / 3), cz + r * Math.sin(k * Math.PI / 3));
    h6.closePath();
    rearWall.holes.push(h6);
  };
  const vx0 = -w / 2 + 16, vx1 = px0 - 20, vz0 = slotZ(6) - 6, vz1 = slotZ(0) + 6, hp = 6.4;
  for (let r = 0, cz = vz0; cz <= vz1; r++, cz += hp * 0.866)
    for (let cx = vx0 + (r % 2 ? hp / 2 : 0); cx <= vx1; cx += hp) hex(cx, cz, 2.6);
  g.add(slab(rearWall, d - t, t, body, 48));
  g.add(fan(fanX, d - t - 25, fanZ, 120, MAT.plastic(0x16171a, 0.5)));
  g.add(fanGuard(fanX, d + 1.2, fanZ, 120, MAT.powder(st.body)));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(cyl(fanX + sx * 52.5, d + 0.6, fanZ + sz * 52.5, 2.6, 1.6, MAT.zinc()));
  // top: mesh panel or a fan
  if (st.top === 'mesh') g.add(plane(0, d * 0.55, z1 + 0.3, w - 40, d * 0.6, perforated(0x0c0c0d, w - 40, d * 0.6, 6), 'z'));
  if (st.top === 'fan') {         // a 200 mm fan under a wire guard in the roof
    const top = new THREE.Group();
    top.add(fan(0, t, 0, 180, MAT.plastic(0x16171a, 0.5)), fanGuard(0, -1.2, 0, 180, MAT.powder(st.body)));
    top.rotation.x = -Math.PI / 2;               // +Y of the group points down: the fan hangs under the roof
    top.position.set(0, d * 0.5, z1);
    g.add(top);
  }
  // rear: I/O shield, PCI slots, the PSU face, the side panels' thumbscrews
  ioShield(g, w / 2 - 60, d - 0.8, z1 - ATX.top - 4);
  psuFace(g, -w / 2 + 8, d - t, z0 + 6);
  for (const sx of [-1, 1]) for (const zz of [z0 + 70, z1 - 70]) {
    g.add(cyl(sx * (w / 2 - 5), d + 3, zz, 4.2, 6, tiled(MAT.brushed(0x7d8288), 6), 'y', 18));     // knurled head
    g.add(cyl(sx * (w / 2 - 5), d + 6.1, zz, 3.2, 0.4, MAT.zinc()));
  }
  // expansion slots: horizontal, stacked under the I/O shield (an ATX tower)
  for (let i = 0; i < 7; i++) {
    if ((c.rearSlots ?? []).includes(i) || i === c.nic || (st.sleeper && i === 3)) continue;   // printed brackets, cards
    slotCover(g, px0, pl, d, slotZ(i));
  }
  // the bar that holds the brackets, with a thumbscrew per slot (the brackets' tabs are away from the board)
  g.add(box(px0 - 12, d, slotZ(6) - 10, 10, 1.2, slotZ(0) - slotZ(6) + 20, tiled(MAT.brushed(0x8d9298), 20)));
  for (let i = 0; i < 7; i++) g.add(cyl(px0 - 7, d + 2, slotZ(i), 3.2, 3.4, tiled(MAT.brushed(0x7d8288), 6), 'y', 18));
  if (c.nic >= 0) networkCard(root, c.nicPorts ?? [], px0, pl, slotZ(c.nic), d);
  // feet
  for (const fx of [-w / 2 + 22, w / 2 - 22]) for (const fy of [24, d - 24]) g.add(cyl(fx, fy, z0 - 4, 14, 8, MAT.rubber(), 'z'));

  // drive cage around the bays (visible through the window)
  // black steel walls with a row of vent holes and the screw holes per bay
  const cage = tiled(MAT.brushed(0xa6abb2), 40);
  const cageHoles = [];
  for (let zb = c.cz0; zb + bayH <= c.cz1 + 0.5; zb += pitch) {
    const zc = zb + bayH / 2;
    for (const y of [62, 84, 166, 188]) cageHoles.push([y, zc, 6]);
    for (const y of [47.4, 127]) cageHoles.push([y, zb + 10, 1.7]);
  }
  for (const s of [-1, 1]) g.add(sidePanel(s > 0 ? bayW / 2 : -bayW / 2 - cageT, 1, c.cz0, 200, c.cz1 - c.cz0, cageT,
    tiled(MAT.powder(0x1c1d20), 50), null, cageHoles));
  // the tabs the drives rest on: they run in the grooves of the adapter
  for (let j = Math.ceil(c.cz0 / pitch); j <= Math.floor(c.cz1 / pitch) + 1; j++) {
    const zt = j * pitch - (pitch - bayH) / 2;
    if (zt < c.cz0 + 2 || zt > c.cz1 - 2) continue;
    for (const s of [-1, 1]) for (const y of [14, 120]) g.add(box(s > 0 ? bayW / 2 - 2.2 : -bayW / 2, y, zt - 0.5, 2.2, 24, 1, cage));
  }

  // front fascia with the adapter opening and the free bays
  const front = part(root, 'front');
  const holes = [c.open];
  for (let k = 1; k <= c.extra; k++) {
    const zb = -k * pitch - (bezelH1 - bayH) / 2;
    holes.push([-bezelW / 2, bezelW / 2, zb, zb + bezelH1]);
  }
  const meshArea = st.front === 'mesh' ? [-w / 2 + 16, w / 2 - 16, z0 + 26, Math.min(c.cz0 - (c.extra ? 0 : 14), z1 - 60) - 12] : null;
  if (meshArea && meshArea[3] - meshArea[2] > 40) holes.push(meshArea);
  const frontMat = st.front === 'brushed' ? tiled(MAT.brushed(st.frontColor), 60)
    : st.metal ? tiled(MAT.brushed(st.frontColor), 60) : tiled(MAT.plastic(st.frontColor, 0.42), 40);
  frontMat.name = 'case_front';
  // a sleeper front: the floppy bay under the 5.25in bays and a vent grille at the bottom
  const lowBay = -c.extra * pitch - (bezelH1 - bayH) / 2;
  const floppyZ = lowBay - 34;
  if (st.sleeper) {
    holes.push([-52, 52, floppyZ - 1, floppyZ + 26]);
    for (let i = 0; i < 9; i++) holes.push([-w / 2 + 34, w / 2 - 34, z0 + 30 + i * 9, z0 + 33.5 + i * 9]);
  }
  front.add(frontPanel({ x0: -w / 2, z0: z0 + 2, w, h: h - 2, r: st.sleeper ? 3 : 8 }, holes, -fd, fd + 14, frontMat));
  if (st.sleeper) {
    floppy(front, 0, -fd + 0.8, floppyZ);
    front.add(box(-w / 2 + 34, 2, z0 + 28, w - 68, 2, 84, MAT.plastic(0x0a0a0a, 0.9)));
    retroControls(front, w / 2 - 21, -fd, z1 - 20);
    // the big power key and the maker badge plate
    const key = MAT.plastic(0xcfc6ad, 0.5);
    key.name = 'case_front';
    front.add(box(w / 2 - 36, -fd - 3, z0 + 140, 26, 4, 20, key, 2));
    front.add(box(-w / 2 + 14, -fd - 0.8, z1 - 30, 46, 1, 12, MAT.steel(), 1));
  }
  if (meshArea && meshArea[3] - meshArea[2] > 40) {
    const mw = meshArea[1] - meshArea[0], mh = meshArea[3] - meshArea[2];
    g.add(plane(0, -fd + 2.5, meshArea[2] + mh / 2, mw, mh, perforated(0x1a1b1d, mw, mh, 7), 'y'));
    g.add(plane(0, 14, meshArea[2] + mh / 2, mw, mh, MAT.plastic(0x050506, 0.9), 'y'));
    const n = Math.max(1, Math.floor(mh / 130));
    for (let i = 0; i < n; i++) g.add(fan(0, 8, meshArea[2] + mh * (i + 0.5) / n, Math.min(120, mh / n - 6), MAT.plastic(0x141517, 0.5)));
  }
  // blank covers in the free bays
  for (let k = 1; k <= c.extra; k++) {
    const zb = -k * pitch - (bezelH1 - bayH) / 2;
    const coverMat = st.metal ? tiled(MAT.brushed(st.frontColor), 60) : tiled(MAT.plastic(st.frontColor, 0.45), 40);
    coverMat.name = 'case_front';
    front.add(box(-bezelW / 2 + 0.4, -fd + 0.8, zb + 0.4, bezelW - 0.8, fd + 6, bezelH1 - 0.8, coverMat, 1.2));
    front.add(box(-bezelW / 2 + 10, -fd + 0.6, zb + bezelH1 / 2 - 0.4, bezelW - 20, 0.4, 0.8, MAT.plastic(0x050506, 0.8)));
  }
  // Define-style cases: the front door comes off to use the rack, only its hinge pins stay
  if (st.front === 'door') for (const zh of [z0 + 60, z1 - 60]) front.add(cyl(-w / 2 + 4, -fd - 2, zh, 2.2, 14, MAT.zinc(), 'z'));
  if (!st.sleeper) {
    // the front I/O strip (power key, USB, jacks: x from xr - 77 to xr + 8, 15 mm tall) must not sit on the
    // printed front: above it when there is room, else on the roof, like a top-I/O tower
    const xr = w / 2 - 34, [ox0, ox1, oz0, oz1] = c.open;
    const hits = (z) => xr - 77 < ox1 + 4 && xr + 8 > ox0 - 4 && z - 8 < oz1 + 4 && z + 8 > oz0 - 4;
    let z = z1 - 24;
    if (hits(z)) z = oz1 + 14;
    if (!hits(z) && z + 8 <= z1 - 6) frontIO(front, xr, -fd, z, st.body < 0x808080);
    else {
      const top = part(root, 'top_io');
      frontIO(top, xr, 0, 0, st.body < 0x808080);
      top.rotation.x = -Math.PI / 2;           // the strip faces up, near the front edge of the roof
      top.position.set(0, 40, z1);
    }
  }
  // a sleeper hides a modern server: draw it even without a window (the video takes the side panel off)
  // the motherboard tray is always on +X, like the rear I/O and the slots (bay2rack.scad places them there)
  if (st.window || st.sleeper) interior(root, c, w / 2 - t);
  if (st.sleeper && c.nic !== 3) lowProfileGPU(root, px0, pl, slotZ(3), d);
  return root;
}

// ------------------------------------------------------------------ client PCs (old towers)
function dvdDrive(g, x, y, z, beige) {
  const face = beige ? 0xd9d3c3 : 0x141517;
  g.add(box(x - 74, y, z, 148, 6, 42, MAT.plastic(face, 0.45), 1.2));
  g.add(box(x - 66, y - 0.3, z + 22, 132, 0.4, 0.8, MAT.plastic(0x2c2c2c, 0.8)));       // tray line
  g.add(box(x + 46, y - 0.8, z + 8, 14, 1, 5, MAT.plastic(beige ? 0xc9c3b2 : 0x222326, 0.4), 1));   // eject
  g.add(cyl(x + 38, y - 0.4, z + 10.5, 1.2, 0.8, MAT.led(0x33f266, 1.5)));
}

export function buildClient(i, cl, bays) {
  const [x, W, H, D, rgb] = cl;
  const col = bays.sleeper ? 0xcbc2a8 : new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace).getHex();
  const beige = bays.sleeper || rgb[0] > 0.5;
  const g = new THREE.Group();
  const z0 = bays.z0;
  const body = beige ? tiled(MAT.plastic(col, 0.6), 40) : tiled(MAT.powder(col), 50);
  const R = D - bays.fd;                         // its back, as in bay2rack.scad (the network cable ends there)
  g.add(box(x - W / 2, 4, z0, W, R - 4, H, body, 2));
  const bw = bays.bezelW;
  // printed bay2rack bezels (buttons, 80 mm fan) come from OpenSCAD: leave their openings
  const holes = bays.bezels.map(([zb, hh]) => [x - bw / 2, x + bw / 2, zb, zb + hh]);
  const zLow = bays.bezels.length ? Math.min(...bays.bezels.map((b) => b[0])) : z0 + H - 40 - bays.pitch;
  const zDvd = zLow - bays.pitch;
  holes.push([x - bw / 2, x + bw / 2, zDvd, zDvd + bays.bezelH1]);
  const vent = [x - W / 2 + 22, x + W / 2 - 22, z0 + 26, z0 + 110];
  holes.push(vent);
  g.add(frontPanel({ x0: x - W / 2, z0: z0 + 1, w: W, h: H - 2, r: beige ? 4 : 10 }, holes, -bays.fd, bays.fd + 10,
    beige ? tiled(MAT.plastic(0xddd7c7, 0.55), 40) : tiled(MAT.plastic(0x151619, 0.4), 40)));
  if (bays.bezels.length) g.add(box(x - bw / 2, 2, zLow, bw, 6, Math.max(...bays.bezels.map((b) => b[0] + b[1])) - zLow, MAT.plastic(0x050506, 0.9)));
  dvdDrive(g, x, -bays.fd + 0.6, zDvd + 0.2, beige);
  if (beige) {   // a 3.5in floppy drive under the DVD
    g.add(box(x - 51, -bays.fd + 0.6, zDvd - 34, 102, 6, 25, MAT.plastic(0xd9d3c3, 0.5), 1));
    g.add(box(x - 45, -bays.fd + 0.2, zDvd - 20, 90, 0.6, 3, MAT.plastic(0x1a1a1a, 0.8)));
    g.add(box(x + 28, -bays.fd + 0.2, zDvd - 30, 12, 0.8, 5, MAT.plastic(0xc4beab, 0.5), 1));
  }
  g.add(plane(x, -bays.fd + 2, (vent[2] + vent[3]) / 2, vent[1] - vent[0], vent[3] - vent[2], perforated(beige ? 0x8f8a7c : 0x0c0c0d, vent[1] - vent[0], vent[3] - vent[2], 6), 'y'));
  g.add(plane(x, 6, (vent[2] + vent[3]) / 2, vent[1] - vent[0], vent[3] - vent[2], MAT.plastic(0x050506, 0.9), 'y'));
  // the back of a micro-ATX tower: the I/O shield (its LAN port is where the cable ends), a 92 mm fan,
  // four slot covers under the shield, the PSU at the bottom
  const p = bays.port;
  ioShield(g, p[0] - 22.2, R, p[2] + 32);
  const guard = beige ? MAT.plastic(0xcfc9b8, 0.5) : MAT.powder(col);
  rearFan(g, p[0] + 78, R, p[2] - 18, 92, guard);
  for (let i = 0; i < 4; i++) slotCover(g, p[0] - 16, 100, R, p[2] + 32 - 175 - i * 20.32);
  psuFace(g, x + W / 2 - 158, R, z0 + 6);
  for (const fx of [x - W / 2 + 18, x + W / 2 - 18]) for (const fy of [22, D - 22]) g.add(cyl(fx, fy, z0 - 3, 10, 6, MAT.rubber(), 'z'));
  if (bays.sleeper) retroControls(g, x + W / 2 - 16, -bays.fd, z0 + H - 16, true);
  return g;
}

// 4-bay NAS (Synology DS920+ size): matte black, four drive trays, status LEDs, two rear fans
export function buildNAS(cl, bays) {
  const [x, W, H, D] = cl;
  const z0 = bays.z0;
  const fd = bays.fd;
  const g = new THREE.Group();
  const shell = bays.sleeper ? tiled(MAT.plastic(0xcbc2a8, 0.55), 40) : tiled(MAT.plastic(0x141517, 0.55), 40);
  if (bays.sleeper) shell.name = 'case_front';
  g.add(box(x - W / 2, -fd, z0, W, D, H, shell, bays.sleeper ? 3 : 6));
  g.add(box(x - W / 2 + 6, -fd - 1, z0 + 10, W - 12, 2, H - 34, MAT.plastic(0x0b0b0c, 0.7), 2));
  if (bays.sleeper) retroControls(g, x + W / 2 - 16, -fd - 1, z0 + H - 4, true);
  for (let i = 0; i < 4; i++) {
    const tx = x - W / 2 + 10 + i * 36.5;
    g.add(box(tx, -fd - 2.2, z0 + 14, 33, 2, H - 44, tiled(MAT.plastic(0x1d1e21, 0.4), 30), 1.5));
    for (let k = 0; k < 9; k++) g.add(box(tx + 6, -fd - 2.5, z0 + 40 + k * 12, 21, 0.4, 2.4, MAT.plastic(0x050506, 0.9)));
    g.add(box(tx + 13, -fd - 2.6, z0 + 22, 7, 0.6, 3, MAT.plastic(0x2a2b2e, 0.4), 0.8));
    g.add(cyl(tx + 16.5, -fd - 1.4, z0 + H - 18, 1.3, 0.8, MAT.led(0x33f266, 2.5)));
  }
  g.add(cyl(x + W / 2 - 16, -fd - 1.2, z0 + H - 18, 4.5, 1.6, MAT.steel()));
  g.add(cyl(x + W / 2 - 16, -fd - 1.8, z0 + H - 18, 5.2, 0.6, MAT.led(0x5ac8ff, 2.2)));
  for (const fz of [z0 + 55, z0 + 145]) rearFan(g, x - 20, D - fd, fz, 80, MAT.powder(0x141517));
  const p = bays.port;
  g.add(box(p[0] - 7, D - fd - 0.6, p[2] - 5, 14, 1.2, 11, MAT.gloss(0x050506)));
  for (const fx of [x - W / 2 + 18, x + W / 2 - 18]) for (const fy of [16, D - 26]) g.add(cyl(fx, fy, z0 - 3, 8, 6, MAT.rubber(), 'z'));
  return g;
}

// ------------------------------------------------------------------ access point (ceiling-style disc)
export function buildAP(pos) {
  const g = new THREE.Group();
  const prof = [[0, 0], [78, 0], [84, 3], [85, 12], [82, 24], [70, 32], [0, 34]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(prof, 72);
  geo.rotateX(Math.PI / 2);
  const ap = mesh(geo, MAT.gloss(0xf3f3f1));
  ap.position.set(pos[0], pos[1], pos[2]);
  g.add(ap);
  const ring = mesh(new THREE.TorusGeometry(18, 1.1, 10, 64), MAT.led(0x5ac8ff, 3), false);
  ring.position.set(pos[0], pos[1], pos[2] + 34.2);
  g.add(ring);
  return g;
}

// fibre box (ONT) on the floor behind the server: the WAN cable ends here
export function buildONT(pos) {
  const g = new THREE.Group();
  g.add(box(pos[0] - 70, pos[1] - 45, pos[2], 140, 95, 28, MAT.plastic(0xeeeeea, 0.4), 6));
  g.add(box(pos[0] - 70, pos[1] - 45, pos[2] + 27.5, 140, 95, 1, MAT.plastic(0xdcdcd6, 0.5), 6));
  [0x3ddc84, 0x3ddc84, 0x5ac8ff, 0x3ddc84].forEach((c, i) =>
    g.add(box(pos[0] - 50 + i * 12, pos[1] - 45.6, pos[2] + 18, 5, 1, 2, MAT.led(c, 2))));
  // LAN port on the side facing the router, the green SC/APC fibre socket on the other side
  g.add(box(pos[0] + 69.4, pos[1] - 28, pos[2] + 5.2, 1.4, 16, 13.6, MAT.plastic(0x0b0b0c, 0.7)));
  g.add(box(pos[0] + 70.6, pos[1] - 24.5, pos[2] + 15, 0.3, 9, 1.2, MAT.gold()));
  g.add(box(pos[0] - 72, pos[1] + 5, pos[2] + 7, 3, 10, 10, MAT.plastic(0x2e9e5b, 0.4), 1));
  return g;
}

// ------------------------------------------------------------------ cables
function plug(end, dir, color) {
  const g = new THREE.Group();
  const boot = box(-5, 0, -4, 10, 13, 8, MAT.gloss(color), 2);
  const head = box(-6, -12, -4.5, 12, 12, 9, new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.1, transmission: 0.85, thickness: 3, transparent: true, opacity: 0.5 }), 1);
  g.add(boot, head);
  g.position.copy(end);
  g.lookAt(end.clone().add(dir));
  g.rotateX(-Math.PI / 2);
  return g;
}

export function buildCable(cb) {
  const pts = cb.p.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const color = new THREE.Color().setRGB(cb.c[0], cb.c[1], cb.c[2], THREE.SRGBColorSpace).getHex();
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const g = new THREE.Group();
  g.userData.role = 'cables';
  g.userData.vlan = cb.vlan;
  g.add(mesh(new THREE.TubeGeometry(curve, pts.length * 28, cb.d / 2, 12, false), MAT.gloss(color)));
  if (cb.plugs[0]) g.add(plug(pts[0], pts[0].clone().sub(pts[1]).normalize(), color));
  if (cb.plugs[1]) g.add(plug(pts.at(-1), pts.at(-1).clone().sub(pts.at(-2)).normalize(), color));
  return g;
}

// everything at once, from the parsed SCENE lines
export function buildScene(data) {
  const g = new THREE.Group();
  g.name = 'scene';
  // every object gets a name (the Blender video pipeline animates them by name)
  const safe = (what, f) => {
    try { const o = f(); if (o) { o.name = what.replace(/\s+/g, '_'); g.add(o); } } catch (e) { console.warn(`scene: ${what} skipped`, e); }
  };
  safe('case', () => data.case && buildCase(data.case));
  if (data.homelab && data.case) {
    const c = data.case;
    const hl = data.homelab;
    hl.clients.forEach((cl, i) => {
      const bays = { z0: c.z0, fd: c.fd, pitch: c.bay[2], bezelW: c.bay[3], bezelH1: c.bay[4], bezels: hl.clientBezels ?? [], port: hl.ports[i],
        sleeper: c.style === 'sleeper' };
      const type = hl.types?.[i] ?? 'pc';
      safe(type === 'nas' ? 'nas' : 'proxmox', () => (type === 'nas' ? buildNAS(cl, bays) : buildClient(i, cl, bays)));
    });
    safe('ap', () => buildAP(hl.ap));
    if (hl.ont) safe('ont', () => buildONT(hl.ont));
  }
  (data.cables ?? []).forEach((cb, i) => safe(`cable_${i}_vlan${cb.vlan ?? 'x'}`, () => buildCable(cb)));
  if (data.case?.tidy) safe('cable_ties', () => cableTies(data.case, data.cables ?? []));
  return g;
}

// Velcro ties around the flat ribbon of cables inside the case (bay2rack.scad routes it along the roof and
// down the back wall, data in case.tidy: [ribbon z, ribbon y on the wall, x of lane 0]), each on an
// adhesive mount when the ribbon lies against the roof or the wall
function cableTies(c, cables) {
  const [zt, yr] = c.tidy;
  const inner = cables.filter((cb) => cb.p.some((q) => Math.abs(q[1] - 262) < 0.01 && Math.abs(q[2] - zt) < 0.01));
  if (!inner.length) return null;
  const xs = inner.map((cb) => cb.p.find((q) => Math.abs(q[1] - 262) < 0.01)[0]);
  const r = Math.max(...inner.map((cb) => cb.d)) / 2 + 0.6;
  const x0 = Math.min(...xs) - r, x1 = Math.max(...xs) + r;
  const band = MAT.plastic(0x111214, 0.85), mount = MAT.plastic(0x3a3c40, 0.6);
  const g = new THREE.Group();
  g.userData.role = 'cables';
  const roof = c.z1 - zt < 20;
  // along the roof: bands across Y
  for (const y of [300, (262 + c.d - 60) / 2, c.d - 80]) {
    g.add(box(x0, y - 2, zt + r, x1 - x0, 4, 1.2, band), box(x0, y - 2, zt - r - 1.2, x1 - x0, 4, 1.2, band));
    g.add(box(x0 - 1.2, y - 2, zt - r - 1.2, 1.2, 4, 2 * r + 2.4, band), box(x1, y - 2, zt - r - 1.2, 1.2, 4, 2 * r + 2.4, band));
    if (roof) g.add(box((x0 + x1) / 2 - 7, y - 7, zt + r + 1.2, 14, 14, c.z1 - 1.4 - zt - r - 1.2, mount, 1));
  }
  // down the back wall: bands across Z, between the bend at the roof and the turn to the slot
  const low = Math.min(...inner.flatMap((cb) => cb.p.filter((q) => Math.abs(q[1] - yr) < 0.01).map((q) => q[2])));
  const zs = [zt - 64];
  if (zt - 64 - low > 70) zs.push((zt - 64 + low) / 2);
  for (const z of zs) {
    g.add(box(x0, yr - r - 1.2, z - 2, x1 - x0, 1.2, 4, band), box(x0, yr + r, z - 2, x1 - x0, 1.2, 4, band));
    g.add(box(x0 - 1.2, yr - r - 1.2, z - 2, 1.2, 2 * r + 2.4, 4, band), box(x1, yr - r - 1.2, z - 2, 1.2, 2 * r + 2.4, 4, band));
    g.add(box((x0 + x1) / 2 - 7, yr + r + 1.2, z - 7, 14, c.d - 1.4 - yr - r - 1.2, 14, mount, 1));
  }
  return g;
}
