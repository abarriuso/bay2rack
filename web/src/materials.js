// Physically based materials with procedural textures (no image files to download).
import * as THREE from 'three';

function canvasTexture(size, draw, { repeat = 1, color = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noise(g, n, lo, hi) {
  const img = g.createImageData(n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = lo + Math.random() * (hi - lo);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// world-space size of one texture tile (mm) is set through UVs: see boxUV()
export const TEX = {
  // fine powder-coat grain
  grain: canvasTexture(256, (g, n) => noise(g, n, 110, 150)),
  // brushed metal: long horizontal streaks
  brushed: canvasTexture(512, (g, n) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
      const y = Math.random() * n;
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + Math.random() * 0.08})`;
      g.fillRect(0, y, n, 0.6 + Math.random());
    }
  }),
  // perforated steel: white = metal, black = hole (alpha map), hex pattern
  perforated: canvasTexture(128, (g, n) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, n, n);
    g.fillStyle = '#000';
    const p = n / 8;
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
      g.beginPath();
      g.arc(c * p + (r % 2 ? p / 2 : 0), r * p * 0.866, p * 0.36, 0, Math.PI * 2);
      g.fill();
    }
  }),
  // 3D-print layer lines + a little grain
  layers: canvasTexture(256, (g, n) => {
    noise(g, n, 120, 136);
    for (let y = 0; y < n; y += 4) {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(0, y, n, 1.2);
    }
  }),
  // PCBs: green (Raspberry Pi, cards) and black (the motherboard)
  pcb: pcbTexture('#163f26', 'rgba(110, 170, 100, 0.30)', 'rgba(236, 240, 228, 0.55)'),
  board: pcbTexture('#151719', 'rgba(150, 160, 172, 0.14)', 'rgba(225, 228, 232, 0.40)'),
};

// A printed circuit board as made: buses of parallel traces with 45 degree corners, vias, the white
// silkscreen outlines of the parts. 512 px for about 250 mm: one trace is about 0.3 mm.
function pcbTexture(base, trace, silk) {
  return canvasTexture(512, (g, n) => {
    g.fillStyle = base;
    g.fillRect(0, 0, n, n);
    const rnd = (a, b) => a + Math.random() * (b - a);
    g.strokeStyle = trace;
    g.lineWidth = 1.2;
    g.lineJoin = 'round';
    for (let b = 0; b < 46; b++) {                 // buses
      const lines = Math.round(rnd(3, 9)), gap = 4;
      let x = rnd(0, n), y = rnd(0, n);
      const horiz = Math.random() < 0.5, l1 = rnd(30, 150), l2 = rnd(10, 50), l3 = rnd(30, 150), dir = Math.random() < 0.5 ? 1 : -1;
      for (let k = 0; k < lines; k++) {
        const o = k * gap;
        g.beginPath();
        if (horiz) {
          g.moveTo(x, y + o); g.lineTo(x + l1 + o * dir, y + o);
          g.lineTo(x + l1 + o * dir + l2, y + o + l2 * dir); g.lineTo(x + l1 + o * dir + l2 + l3, y + o + l2 * dir);
        } else {
          g.moveTo(x + o, y); g.lineTo(x + o, y + l1 + o * dir);
          g.lineTo(x + o + l2 * dir, y + l1 + o * dir + l2); g.lineTo(x + o + l2 * dir, y + l1 + o * dir + l2 + l3);
        }
        g.stroke();
      }
    }
    g.fillStyle = trace;                           // vias
    for (let i = 0; i < 260; i++) { g.beginPath(); g.arc(rnd(0, n), rnd(0, n), 1.6, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = silk;                          // silkscreen: part outlines and pin-1 marks
    g.lineWidth = 1;
    for (let i = 0; i < 34; i++) {
      const w = rnd(6, 26), h = rnd(4, 16), x = rnd(0, n - w), y = rnd(0, n - h);
      g.strokeRect(x, y, w, h);
      g.fillStyle = silk;
      g.fillRect(x - 3, y - 3, 2, 2);
    }
  }, { color: true });
}

const std = (o) => new THREE.MeshStandardMaterial(o);
// every material carries a name: the Blender video pipeline finds the parts by it
const named = (name, m) => { m.name = name; return m; };

export const MAT = {
  powder: (color) => named('powder', std({ color, roughness: 0.62, metalness: 0.25, bumpMap: TEX.grain, bumpScale: 0.35 })),
  brushed: (color) => named('brushed', std({ color, roughness: 0.34, metalness: 0.9, roughnessMap: TEX.brushed, bumpMap: TEX.brushed, bumpScale: 0.15 })),
  plastic: (color, roughness = 0.5) => named('plastic', std({ color, roughness, metalness: 0, bumpMap: TEX.grain, bumpScale: 0.12 })),
  gloss: (color) => named('gloss', std({ color, roughness: 0.22, metalness: 0 })),
  mesh: (color) => named('mesh', std({ color, roughness: 0.45, metalness: 0.7, alphaMap: TEX.perforated, alphaTest: 0.5, side: THREE.DoubleSide })),
  glass: () => named('glass', new THREE.MeshPhysicalMaterial({
    color: 0x9aa6b4, metalness: 0, roughness: 0.04, transmission: 0.92, thickness: 4, ior: 1.5,
    transparent: true, opacity: 0.35, side: THREE.DoubleSide, envMapIntensity: 1.2 })),
  steel: () => named('steel', std({ color: 0xb9bec5, roughness: 0.38, metalness: 1, envMapIntensity: 0.7 })),
  zinc: () => named('zinc', std({ color: 0xa9adb3, roughness: 0.42, metalness: 1, envMapIntensity: 0.7 })),
  brass: () => named('brass', std({ color: 0xd9b25a, roughness: 0.3, metalness: 1 })),
  gold: () => named('gold', std({ color: 0xe6bf55, roughness: 0.25, metalness: 1 })),
  rubber: () => named('rubber', std({ color: 0x111112, roughness: 0.95, metalness: 0 })),
  pcb: () => named('pcb', std({ map: TEX.pcb, roughness: 0.55, metalness: 0.1 })),
  board: () => named('pcb', std({ map: TEX.board, roughness: 0.62, metalness: 0.05 })),
  led: (color, k = 2.2) => named('led', std({ color, emissive: color, emissiveIntensity: k, roughness: 0.3, toneMapped: false })),
  filament: (color) => named('print', std({ color, roughness: 0.58, metalness: 0, bumpMap: TEX.layers, bumpScale: 0.55 })),
};

// Box projection UVs (mm / tile) so the procedural textures work on any mesh.
// Faces looking along ±Y (the printed front, which lies on the bed) get no layer lines.
export function boxUV(geometry, tile = 24) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k];
      let u, v;
      if (ay >= ax && ay >= az) { u = p.x; v = p.z * 0.002; }      // front / back: smooth
      else if (ax >= az) { u = p.z; v = p.y; }                      // sides: layers run along Y
      else { u = p.x; v = p.y; }                                    // top / bottom
      uv[(i + k) * 2] = u / tile;
      uv[(i + k) * 2 + 1] = v / tile;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// colours written by bay2rack.scad -> materials
const near = (hex, ref, tol = 6) =>
  Math.abs(((hex >> 16) & 255) - ((ref >> 16) & 255)) <= tol &&
  Math.abs(((hex >> 8) & 255) - ((ref >> 8) & 255)) <= tol &&
  Math.abs((hex & 255) - (ref & 255)) <= tol;

export const PRINT_HEX = [0x303236, 0x3f4146, 0x4d4f54, 0x5c40a0];   // adapter, fillers, modules (PRINT_A/B/C), multicolour letters (LABEL_C)

// which printed part a colour stands for (0 adapter, 1 fillers, 2 modules) or -1.
// Every rack module adds its index to the red channel so it stays a separate object: PRINT_C + [k, 0, 0].
export function printSlot(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  if (Math.abs(g - 0x4f) <= 1 && Math.abs(b - 0x54) <= 1 && r >= 0x4c && r <= 0x4d + 40) return 2;
  return PRINT_HEX.findIndex((p) => near(hex, p, 2));
}

export function materialFor(hex, filament) {
  const pi = printSlot(hex);
  if (pi >= 0) {
    const mat = MAT.filament(filament[pi]);
    mat.name = 'print_' + pi;
    return { mat, print: true, slot: pi };
  }
  if (near(hex, 0x124d29, 3)) return { mat: MAT.pcb() };                                   // Raspberry Pi boards
  if (near(hex, 0xbdc2c9) || near(hex, 0xb8bdc4)) return { mat: MAT.steel() };          // screws, metal keystones
  if (near(hex, 0xdbad42)) return { mat: MAT.brass() };                                   // heat-set inserts
  if (near(hex, 0x94999f)) return { mat: MAT.zinc() };                                    // nuts
  if (near(hex, 0xcca633)) return { mat: MAT.gold() };                                    // contacts
  if (near(hex, 0x33f266) || near(hex, 0x338cff) || near(hex, 0x59d9ff) || near(hex, 0x4dbfff))
    return { mat: MAT.led(hex) };                                                         // LEDs, OLED
  if (near(hex, 0xdb2126, 10)) return { mat: MAT.plastic(hex, 0.35) };                   // MS105G red ports
  const lum = ((hex >> 16) & 255) * 0.3 + ((hex >> 8) & 255) * 0.59 + (hex & 255) * 0.11;
  return { mat: lum < 40 ? MAT.gloss(hex) : MAT.plastic(hex, 0.45) };
}
