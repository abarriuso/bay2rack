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
  // fan grille: rings and spokes (alpha)
  grille: canvasTexture(256, (g, n) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, n, n);
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    for (let r = 16; r < n / 2; r += 18) { g.beginPath(); g.arc(n / 2, n / 2, r, 0, Math.PI * 2); g.stroke(); }
    for (let a = 0; a < 4; a++) {
      g.beginPath(); g.moveTo(n / 2, n / 2);
      g.lineTo(n / 2 + Math.cos(a * Math.PI / 2 + 0.6) * n, n / 2 + Math.sin(a * Math.PI / 2 + 0.6) * n); g.stroke();
    }
  }),
  // PCB: dark green with traces
  pcb: canvasTexture(256, (g, n) => {
    g.fillStyle = '#13361f';
    g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(160, 200, 120, 0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      let x = Math.random() * n, y = Math.random() * n;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { if (k % 2) x += (Math.random() - 0.5) * 80; else y += (Math.random() - 0.5) * 80; g.lineTo(x, y); }
      g.stroke();
    }
  }, { color: true }),
};

const std = (o) => new THREE.MeshStandardMaterial(o);

export const MAT = {
  powder: (color) => std({ color, roughness: 0.62, metalness: 0.25, bumpMap: TEX.grain, bumpScale: 0.35 }),
  brushed: (color) => std({ color, roughness: 0.34, metalness: 0.9, roughnessMap: TEX.brushed, bumpMap: TEX.brushed, bumpScale: 0.15 }),
  plastic: (color, roughness = 0.5) => std({ color, roughness, metalness: 0, bumpMap: TEX.grain, bumpScale: 0.12 }),
  gloss: (color) => std({ color, roughness: 0.22, metalness: 0 }),
  mesh: (color) => std({ color, roughness: 0.45, metalness: 0.7, alphaMap: TEX.perforated, alphaTest: 0.5, side: THREE.DoubleSide }),
  grille: (color) => std({ color, roughness: 0.4, metalness: 0.7, alphaMap: TEX.grille, alphaTest: 0.5, side: THREE.DoubleSide }),
  glass: () => new THREE.MeshPhysicalMaterial({
    color: 0x9aa6b4, metalness: 0, roughness: 0.04, transmission: 0.92, thickness: 4, ior: 1.5,
    transparent: true, opacity: 0.35, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
  steel: () => std({ color: 0xb9bec5, roughness: 0.38, metalness: 1, envMapIntensity: 0.7 }),
  zinc: () => std({ color: 0xa9adb3, roughness: 0.42, metalness: 1, envMapIntensity: 0.7 }),
  brass: () => std({ color: 0xd9b25a, roughness: 0.3, metalness: 1 }),
  gold: () => std({ color: 0xe6bf55, roughness: 0.25, metalness: 1 }),
  rubber: () => std({ color: 0x111112, roughness: 0.95, metalness: 0 }),
  pcb: () => std({ map: TEX.pcb, roughness: 0.55, metalness: 0.1 }),
  led: (color, k = 2.2) => std({ color, emissive: color, emissiveIntensity: k, roughness: 0.3, toneMapped: false }),
  filament: (color) => std({ color, roughness: 0.58, metalness: 0, bumpMap: TEX.layers, bumpScale: 0.55 }),
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

export const PRINT_HEX = [0x303236, 0x3f4146, 0x4d4f54];   // adapter, fillers, modules (PRINT_A/B/C)

export function materialFor(hex, filament) {
  const pi = PRINT_HEX.findIndex((p) => near(hex, p, 2));
  if (pi >= 0) return { mat: MAT.filament(filament[pi]), print: true };
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
