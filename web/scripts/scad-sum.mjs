// A sum of the whole OpenSCAD model (src/**/*.scad: bay2rack.scad and everything it includes), for the build made
// ahead for the film (scripts/first-render.mjs): it is only served with the model it was made from (copy-assets.mjs).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export function modelSum(src) {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(join(d, e.name)) : /\.scad$/.test(e.name) && files.push(join(d, e.name)); };
  walk(src);
  let h = 0x811c9dc5;
  for (const f of files.sort()) {
    const text = relative(src, f).replace(/\\/g, '/') + '\n' + readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
