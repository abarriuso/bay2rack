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
function sidePanel(x, y0, z0, d, h, t, mat, win) {
  const s = rrect(new THREE.Shape(), y0, z0, d, h, 3);
  if (win) s.holes.push(rrect(new THREE.Path(), win[0], win[1], win[2], win[3], 10));
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

function fan(cx, y, cz, size, frameMat) {
  const g = new THREE.Group();
  const r = size / 2 - 4;
  g.add(box(cx - size / 2, y, cz - size / 2, size, 3, size, frameMat, 4));
  const hub = cyl(cx, y - 1, cz, r * 0.32, 8, MAT.plastic(0x1b1c1f, 0.5));
  g.add(hub);
  for (let i = 0; i < 7; i++) {
    const blade = box(-r * 0.12, -1.5, 0, r * 0.24, 3, r * 0.95, MAT.plastic(0x232428, 0.45));
    const pivot = new THREE.Group();
    blade.rotation.y = 0.35;
    pivot.add(blade);
    pivot.position.set(cx, y - 1, cz);
    pivot.rotation.y = (i / 7) * Math.PI * 2;
    g.add(pivot);
  }
  return g;
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
};

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

function interior(g, c, xWall) {
  const { w, d, z0, z1 } = c;
  const s = xWall > 0 ? -1 : 1;                 // towards the inside of the case
  const xs = (v) => xWall + s * v;              // distance from the motherboard wall
  const lo = (a, b) => Math.min(xs(a), xs(b));
  const sz = (a, b) => Math.abs(xs(a) - xs(b));
  const alu = tiled(MAT.brushed(0xc4c9cf), 20);
  const black = MAT.plastic(0x16171a, 0.5);
  const mbY = d - 262, mbZ = z1 - 340;           // ATX board 244 x 305 near the top rear
  g.add(box(lo(4, 6), mbY, mbZ, sz(4, 6), 244, 305, MAT.pcb()));
  // rear I/O block, VRM heatsinks, chipset, M.2
  g.add(box(lo(6, 26), d - 30, mbZ + 175, sz(6, 26), 26, 120, MAT.powder(0x2a2c30)));
  g.add(box(lo(6, 22), mbY + 70, mbZ + 260, sz(6, 22), 120, 18, tiled(MAT.brushed(0x3a3d42), 20)));
  g.add(box(lo(6, 22), mbY + 200, mbZ + 150, sz(6, 22), 18, 100, tiled(MAT.brushed(0x3a3d42), 20)));
  g.add(box(lo(6, 14), mbY + 40, mbZ + 40, sz(6, 14), 45, 45, tiled(MAT.brushed(0x2f3236), 20)));
  g.add(box(lo(6, 9), mbY + 60, mbZ + 110, sz(6, 9), 80, 22, tiled(MAT.brushed(0x55595f), 20)));
  // CPU tower cooler: fin stack, heat pipes, 120 mm fan
  g.add(finStack(lo(10, 160), mbY + 95, mbZ + 150, sz(10, 160) - 25, 52, 125, 28, alu));
  for (let i = 0; i < 4; i++) g.add(cyl(xs(80), mbY + 105 + i * 11, mbZ + 145, 3, 150, MAT.gold(), 'x'));
  g.add(fan(xs(85), mbY + 84, mbZ + 212, 120, black));
  // RAM
  for (let i = 0; i < 2; i++) {
    g.add(box(lo(6, 40), mbY + 165 + i * 10, mbZ + 120, sz(6, 40), 7, 133, MAT.plastic(0x1d2433, 0.35)));
    g.add(box(lo(38, 42), mbY + 165 + i * 10, mbZ + 120, sz(38, 42), 7, 133, MAT.led(0x7aa2ff, 1.4)));
  }
  // an HBA / network card in the top PCIe slot
  g.add(box(lo(6, 26), d - 175, mbZ + 75, sz(6, 26), 170, 70, MAT.pcb()));
  g.add(box(lo(12, 22), d - 120, mbZ + 95, sz(12, 22), 40, 30, tiled(MAT.brushed(0x2c2f34), 20)));
  // PSU with its fan grille, 24-pin cable bundle
  g.add(box(-w / 2 + 8, d - 158, z0 + 6, 150, 150, 86, MAT.powder(0x111214)));
  g.add(plane(-w / 2 + 83, d - 158 - 0.6, z0 + 49, 70, 70, MAT.grille(0x2a2c30), 'y'));
  const harness = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-w / 2 + 60, d - 160, z0 + 60), new THREE.Vector3(xs(60), d - 200, z0 + 160),
    new THREE.Vector3(xs(14), mbY + 225, mbZ + 120)]);
  g.add(mesh(new THREE.TubeGeometry(harness, 40, 7, 10, false), MAT.plastic(0x0d0d0e, 0.7)));
  // 3.5in drives in the cage at the front, SATA cables
  for (let i = 0; i < 3; i++) {
    const zz = z0 + 26 + i * 30;
    g.add(box(-w / 2 + 22, 24, zz, 101.6, 147, 26, tiled(MAT.brushed(0x9ea3aa), 30)));
    g.add(box(-w / 2 + 22, 24 + 20, zz + 26, 101.6, 80, 0.4, MAT.plastic(0xe9e9e6, 0.5)));   // label
    const sata = new THREE.CatmullRomCurve3([new THREE.Vector3(-w / 2 + 70, 172, zz + 13),
      new THREE.Vector3(-w / 2 + 90, 230, zz + 40), new THREE.Vector3(xs(14), mbY + 20, mbZ + 30)]);
    g.add(mesh(new THREE.TubeGeometry(sata, 30, 2.2, 8, false), MAT.plastic(i === 1 ? 0x101010 : 0xb32020, 0.4)));
  }
}

export function buildCase(c) {
  const st = CASE_STYLES[c.id] ?? CASE_STYLES.obsidian750d;
  const g = new THREE.Group();
  const { w, h, d, z0, z1, fd } = c;
  const [bayW, bayH, pitch, bezelW, bezelH1, cageT] = c.bay;
  const t = 1.4;
  const body = tiled(st.metal ? MAT.brushed(st.body) : MAT.powder(st.body), 50);

  // chassis
  const winRect = st.window ? [70, z0 + 40, d - 110, h - 80] : null;
  const winSide = c.window === 'right' ? 1 : -1;
  const side = sidePanel(winSide > 0 ? w / 2 - t : -w / 2, 0, z0, d, h, t, body, st.window ? winRect : null);
  side.userData.role = 'side';
  g.add(side);
  g.add(sidePanel(winSide > 0 ? -w / 2 : w / 2 - t, 0, z0, d, h, t, body, null));
  if (st.window) {
    const glass = plane(winSide * (w / 2 - t / 2), winRect[0] + winRect[2] / 2, winRect[1] + winRect[3] / 2, winRect[2], winRect[3], MAT.glass(), 'x');
    glass.userData.role = 'side';
    g.add(glass);
  }
  g.add(box(-w / 2, 0, z1 - t, w, d, t, body));
  g.add(box(-w / 2, 0, z0, w, d, t, body));
  g.add(box(-w / 2, d - t, z0, w, t, h, body));
  // top: mesh panel or fan grille
  if (st.top === 'mesh') g.add(plane(0, d * 0.55, z1 + 0.3, w - 40, d * 0.6, MAT.mesh(0x0c0c0d), 'z'));
  if (st.top === 'fan') {
    const gr = plane(0, d * 0.5, z1 + 0.3, 180, 180, MAT.grille(0x0c0c0d), 'z');
    g.add(gr);
  }
  // rear: I/O shield, PCI slots, rear fan, PSU grille
  g.add(box(w / 2 - 60, d - 0.5, z1 - 210, 44, 1, 160, MAT.plastic(0x2a2c30, 0.5)));
  const [pz0, pl] = c.pci ?? [z1 - 380, 112];
  for (let i = 0; i < 7; i++) {
    if ((c.rearSlots ?? []).includes(i)) continue;      // printed cable / power brackets (from OpenSCAD) go there
    g.add(box(-w / 2 + 40 + i * 20.32, d - 0.4, pz0, 16.4, 1, pl, tiled(MAT.brushed(0x8d9298), 20)));
  }
  g.add(plane(-10, d + 0.6, z1 - 120, 120, 120, MAT.grille(0x0a0a0b), 'y'));
  g.add(plane(-w / 2 + 83, d + 0.6, z0 + 49, 80, 80, MAT.grille(0x0a0a0b), 'y'));
  // feet
  for (const fx of [-w / 2 + 22, w / 2 - 22]) for (const fy of [24, d - 24]) g.add(cyl(fx, fy, z0 - 4, 14, 8, MAT.rubber(), 'z'));

  // drive cage around the bays (visible through the window)
  const cage = tiled(MAT.brushed(0xa6abb2), 40);
  for (const s of [-1, 1]) g.add(box(s > 0 ? bayW / 2 : -bayW / 2 - cageT, 1, c.cz0, cageT, 200, c.cz1 - c.cz0, cage));

  // front fascia with the adapter opening and the free bays
  const holes = [c.open];
  for (let k = 1; k <= c.extra; k++) {
    const zb = -k * pitch - (bezelH1 - bayH) / 2;
    holes.push([-bezelW / 2, bezelW / 2, zb, zb + bezelH1]);
  }
  const meshArea = st.front === 'mesh' ? [-w / 2 + 16, w / 2 - 16, z0 + 26, Math.min(c.cz0 - (c.extra ? 0 : 14), z1 - 60) - 12] : null;
  if (meshArea && meshArea[3] - meshArea[2] > 40) holes.push(meshArea);
  const frontMat = st.front === 'brushed' ? tiled(MAT.brushed(st.frontColor), 60)
    : st.metal ? tiled(MAT.brushed(st.frontColor), 60) : tiled(MAT.plastic(st.frontColor, 0.42), 40);
  g.add(frontPanel({ x0: -w / 2, z0: z0 + 2, w, h: h - 2 }, holes, -fd, fd + 14, frontMat));
  if (meshArea && meshArea[3] - meshArea[2] > 40) {
    const mw = meshArea[1] - meshArea[0], mh = meshArea[3] - meshArea[2];
    g.add(plane(0, -fd + 2.5, meshArea[2] + mh / 2, mw, mh, tiled(MAT.mesh(0x1a1b1d), 1), 'y'));
    g.add(plane(0, 14, meshArea[2] + mh / 2, mw, mh, MAT.plastic(0x050506, 0.9), 'y'));
    const n = Math.max(1, Math.floor(mh / 130));
    for (let i = 0; i < n; i++) g.add(fan(0, 8, meshArea[2] + mh * (i + 0.5) / n, Math.min(120, mh / n - 6), MAT.plastic(0x141517, 0.5)));
  }
  // blank covers in the free bays
  for (let k = 1; k <= c.extra; k++) {
    const zb = -k * pitch - (bezelH1 - bayH) / 2;
    const coverMat = st.metal ? tiled(MAT.brushed(st.frontColor), 60) : tiled(MAT.plastic(st.frontColor, 0.45), 40);
    g.add(box(-bezelW / 2 + 0.4, -fd + 0.8, zb + 0.4, bezelW - 0.8, fd + 6, bezelH1 - 0.8, coverMat, 1.2));
    g.add(box(-bezelW / 2 + 10, -fd + 0.6, zb + bezelH1 / 2 - 0.4, bezelW - 20, 0.4, 0.8, MAT.plastic(0x050506, 0.8)));
  }
  // front door (Define style): hinged on the left, open
  if (st.front === 'door') {
    const door = new THREE.Group();
    door.add(box(0, -5, 0, w - 4, 5, h - 30, tiled(MAT.brushed(0x2a2b2e), 60), 2));
    door.position.set(-w / 2 + 1, -fd - 1, z0 + 14);
    door.rotation.z = -1.95;
    g.add(door);
  }
  frontIO(g, w / 2 - 34, -fd, z1 - 24, st.body < 0x808080);
  if (st.window) interior(g, c, winSide > 0 ? -w / 2 + t : w / 2 - t);
  return g;
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
  const col = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace).getHex();
  const beige = rgb[0] > 0.5;
  const g = new THREE.Group();
  const z0 = bays.z0;
  const body = beige ? tiled(MAT.plastic(col, 0.6), 40) : tiled(MAT.powder(col), 50);
  g.add(box(x - W / 2, 4, z0, W, D - 4, H, body, 2));
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
  g.add(plane(x, -bays.fd + 2, (vent[2] + vent[3]) / 2, vent[1] - vent[0], vent[3] - vent[2], MAT.mesh(beige ? 0x8f8a7c : 0x0c0c0d), 'y'));
  g.add(plane(x, 6, (vent[2] + vent[3]) / 2, vent[1] - vent[0], vent[3] - vent[2], MAT.plastic(0x050506, 0.9), 'y'));
  const p = bays.port;
  g.add(box(p[0] - 14, D - 0.6, p[2] - 60, 44, 1, 150, MAT.plastic(0x2a2c30, 0.5)));
  g.add(box(p[0] - 7, D - 0.8, p[2] - 5, 14, 1.2, 11, MAT.gloss(0x050506)));
  for (const fx of [x - W / 2 + 18, x + W / 2 - 18]) for (const fy of [22, D - 22]) g.add(cyl(fx, fy, z0 - 3, 10, 6, MAT.rubber(), 'z'));
  return g;
}

// 4-bay NAS (Synology DS920+ size): matte black, four drive trays, status LEDs, two rear fans
export function buildNAS(cl, bays) {
  const [x, W, H, D] = cl;
  const z0 = bays.z0;
  const fd = bays.fd;
  const g = new THREE.Group();
  g.add(box(x - W / 2, -fd, z0, W, D, H, tiled(MAT.plastic(0x141517, 0.55), 40), 6));
  g.add(box(x - W / 2 + 6, -fd - 1, z0 + 10, W - 12, 2, H - 34, MAT.plastic(0x0b0b0c, 0.7), 2));
  for (let i = 0; i < 4; i++) {
    const tx = x - W / 2 + 10 + i * 36.5;
    g.add(box(tx, -fd - 2.2, z0 + 14, 33, 2, H - 44, tiled(MAT.plastic(0x1d1e21, 0.4), 30), 1.5));
    for (let k = 0; k < 9; k++) g.add(box(tx + 6, -fd - 2.5, z0 + 40 + k * 12, 21, 0.4, 2.4, MAT.plastic(0x050506, 0.9)));
    g.add(box(tx + 13, -fd - 2.6, z0 + 22, 7, 0.6, 3, MAT.plastic(0x2a2b2e, 0.4), 0.8));
    g.add(cyl(tx + 16.5, -fd - 1.4, z0 + H - 18, 1.3, 0.8, MAT.led(0x33f266, 2.5)));
  }
  g.add(cyl(x + W / 2 - 16, -fd - 1.2, z0 + H - 18, 4.5, 1.6, MAT.steel()));
  g.add(cyl(x + W / 2 - 16, -fd - 1.8, z0 + H - 18, 5.2, 0.6, MAT.led(0x5ac8ff, 2.2)));
  for (const fz of [z0 + 55, z0 + 145]) g.add(plane(x - 20, D - fd + 0.6, fz, 80, 80, MAT.grille(0x0a0a0b), 'y'));
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
  g.add(mesh(new THREE.TubeGeometry(curve, pts.length * 28, cb.d / 2, 12, false), MAT.gloss(color)));
  if (cb.plugs[0]) g.add(plug(pts[0], pts[0].clone().sub(pts[1]).normalize(), color));
  if (cb.plugs[1]) g.add(plug(pts.at(-1), pts.at(-1).clone().sub(pts.at(-2)).normalize(), color));
  return g;
}

// everything at once, from the parsed SCENE lines
export function buildScene(data) {
  const g = new THREE.Group();
  const safe = (what, f) => { try { const o = f(); if (o) g.add(o); } catch (e) { console.warn(`scene: ${what} skipped`, e); } };
  safe('case', () => data.case && buildCase(data.case));
  if (data.homelab && data.case) {
    const c = data.case;
    const hl = data.homelab;
    hl.clients.forEach((cl, i) => {
      const bays = { z0: c.z0, fd: c.fd, pitch: c.bay[2], bezelW: c.bay[3], bezelH1: c.bay[4], bezels: hl.clientBezels ?? [], port: hl.ports[i] };
      safe(`client ${i}`, () => ((hl.types?.[i] ?? 'pc') === 'nas' ? buildNAS(cl, bays) : buildClient(i, cl, bays)));
    });
    safe('access point', () => buildAP(hl.ap));
  }
  for (const cb of data.cables ?? []) safe('cable', () => buildCable(cb));
  return g;
}
