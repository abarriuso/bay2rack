// A coloured 3MF (an OpenSCAD assembly) read off the page's thread: unzipped, its XML scanned, its triangles grouped
// by colour into flat, ready-to-draw arrays (position, face normals, the raw box-mapping UVs) - exactly what three.js's
// 3MF loader, then viewer.js, made of it on the page, where it held the page for seconds on a phone. Anything this
// does not know (transforms, components, textures, more than one material group) is answered with null: the page
// reads it the old way.
import { unzipSync } from 'three/addons/libs/fflate.module.js';

self.onmessage = ({ data: { id, data } }) => {
  let meshes = null;
  try { meshes = read(data); } catch (e) { meshes = null; }
  const list = meshes ? meshes.flatMap((m) => [m.position.buffer, m.normal.buffer, m.uv.buffer]) : [];
  self.postMessage({ id, meshes }, list);
};

function read(data) {
  const files = unzipSync(new Uint8Array(data), { filter: (f) => /^3D\/.*\.model$/i.test(f.name) });
  const names = Object.keys(files);
  if (names.length !== 1) return null;
  const s = new TextDecoder().decode(files[names[0]]);
  if (/<components|transform="|<m:colorgroup|<m:texture2d|<colorgroup|<texture2d/.test(s)) return null;
  // the one group of colours
  const groups = s.split('<basematerials').length - 1;
  if (groups > 1) return null;
  let matId = null;
  const colors = [];
  if (groups === 1) {
    const at = s.indexOf('<basematerials');
    const end = s.indexOf('</basematerials>', at);
    matId = attr(s, at, s.indexOf('>', at), 'id');
    for (let i = s.indexOf('<base ', at); i >= 0 && i < end; i = s.indexOf('<base ', i + 5)) {
      const c = attr(s, i, s.indexOf('>', i), 'displaycolor');
      colors.push(c ? parseInt(c.slice(1, 7), 16) : 0x808080);
    }
  }
  // the objects, by id
  const objects = new Map();
  for (let o = s.indexOf('<object'); o >= 0; o = s.indexOf('<object', o + 7)) {
    const head = s.indexOf('>', o);
    const id = attr(s, o, head, 'id');
    const pid = attr(s, o, head, 'pid');
    const pindex = attr(s, o, head, 'pindex');
    if (pid != null && pid !== matId) return null;
    const close = s.indexOf('</object>', o);
    objects.set(id, mesh(s, o, close, pindex != null ? +pindex : null, matId, colors));
    if (!objects.get(id)) return null;
    o = close;
  }
  // the build: its items, in order
  const out = [];
  const b = s.indexOf('<build');
  const be = s.indexOf('</build>', b);
  for (let i = s.indexOf('<item', b); i >= 0 && i < be; i = s.indexOf('<item', i + 5)) {
    const m = objects.get(attr(s, i, s.indexOf('>', i), 'objectid'));
    if (!m) return null;
    for (const g of m) out.push(out.includes(g) ? { hex: g.hex, position: g.position.slice(), normal: g.normal.slice(), uv: g.uv.slice() } : g);
  }
  return out;
}

// an attribute of the tag between `from` and `to`
function attr(s, from, to, name) {
  let i = from;
  for (;;) {
    i = s.indexOf(name + '="', i);
    if (i < 0 || i > to) return null;
    const c = s.charCodeAt(i - 1);
    if (c === 32 || c === 9 || c === 10 || c === 13) break;
    i += name.length;
  }
  const v = i + name.length + 2;
  return s.slice(v, s.indexOf('"', v));
}

// one object's mesh -> one group of flat arrays per colour, in the colours' order
function mesh(s, from, to, pindex, matId, colors) {
  const vs = s.indexOf('<vertices', from), ve = s.indexOf('</vertices>', vs);
  if (vs < 0 || vs > to) return [];
  const verts = [];
  for (let i = s.indexOf('<vertex', vs); i >= 0 && i < ve; i = s.indexOf('<vertex', i)) {
    const e = s.indexOf('>', i);
    verts.push(+attr(s, i, e, 'x'), +attr(s, i, e, 'y'), +attr(s, i, e, 'z'));
    i = e;
  }
  const ts = s.indexOf('<triangles', ve), te = s.indexOf('</triangles>', ts);
  const tri = [];
  for (let i = s.indexOf('<triangle ', ts); i >= 0 && i < te; i = s.indexOf('<triangle ', i)) {
    const e = s.indexOf('>', i);
    const pid = attr(s, i, e, 'pid');
    if (pid != null && pid !== matId) return null;
    const p1 = attr(s, i, e, 'p1');
    tri.push(+attr(s, i, e, 'v1'), +attr(s, i, e, 'v2'), +attr(s, i, e, 'v3'), p1 != null ? +p1 : (pindex ?? -1));
    i = e;
  }
  // count per colour, then fill
  const count = new Map();
  for (let t = 3; t < tri.length; t += 4) count.set(tri[t], (count.get(tri[t]) ?? 0) + 1);
  const keys = [...count.keys()].sort((a, b) => a - b);
  const groups = new Map(keys.map((k) => {
    const n = count.get(k);
    return [k, { hex: colors[k] ?? 0x808080, position: new Float32Array(n * 9), normal: new Float32Array(n * 9), uv: new Float32Array(n * 6), n: 0 }];
  }));
  const P = new Float32Array(verts);
  for (let t = 0; t < tri.length; t += 4) {
    const g = groups.get(tri[t + 3]);
    const o = g.n * 9, u = g.n * 6;
    g.n++;
    const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
    const pos = g.position;
    pos[o] = P[a]; pos[o + 1] = P[a + 1]; pos[o + 2] = P[a + 2];
    pos[o + 3] = P[b]; pos[o + 4] = P[b + 1]; pos[o + 5] = P[b + 2];
    pos[o + 6] = P[c]; pos[o + 7] = P[c + 1]; pos[o + 8] = P[c + 2];
    // the face's normal (three.js's computeVertexNormals on flat triangles: (C - B) x (A - B))
    const ax = pos[o], ay = pos[o + 1], az = pos[o + 2], bx = pos[o + 3], by = pos[o + 4], bz = pos[o + 5];
    const cbx = pos[o + 6] - bx, cby = pos[o + 7] - by, cbz = pos[o + 8] - bz;
    const abx = ax - bx, aby = ay - by, abz = az - bz;
    let nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const N = g.normal;
    N[o] = N[o + 3] = N[o + 6] = nx; N[o + 1] = N[o + 4] = N[o + 7] = ny; N[o + 2] = N[o + 5] = N[o + 8] = nz;
    // the box mapping of materials.js's boxUV, before its tile: the face's main axis picks the plane
    const fx = Math.abs(nx), fy = Math.abs(ny), fz = Math.abs(nz);
    const U = g.uv;
    for (let k = 0; k < 3; k++) {
      const x = pos[o + k * 3], y = pos[o + k * 3 + 1], z = pos[o + k * 3 + 2];
      let uu, vv;
      if (fy >= fx && fy >= fz) { uu = x; vv = z * 0.002; } else if (fx >= fz) { uu = z; vv = y; } else { uu = x; vv = y; }
      U[u + k * 2] = uu; U[u + k * 2 + 1] = vv;
    }
  }
  return keys.map((k) => { const g = groups.get(k); delete g.n; return g; });
}
