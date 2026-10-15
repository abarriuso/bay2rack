// Copies everything the site serves as static files into web/public/ (generated, not committed):
//   scad/      the OpenSCAD model (src/) - the browser renders it
//   stl/       the pre-built STLs and their catalogue (stl/index.json)
//   openscad/  OpenSCAD compiled to WebAssembly (+ fonts and licence texts) from node_modules
import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(web, '..');
const pub = join(web, 'public');
const wasm = realpathSync(join(web, 'node_modules', '@kreijstal', 'openscad-wasm'));

rmSync(pub, { recursive: true, force: true });
mkdirSync(pub, { recursive: true });
const copy = (from, to) => cpSync(from, join(pub, to), { recursive: true, dereference: true });

copy(join(repo, 'src'), 'scad');
copy(join(repo, 'stl'), 'stl');
for (const f of ['openscad.js', 'openscad.wasm', 'BUILDINFO.txt']) copy(join(wasm, f), `openscad/${f}`);
copy(join(wasm, 'fonts'), 'openscad/fonts');
copy(join(wasm, 'LICENSES'), 'openscad/LICENSES');
copy(join(repo, 'docs', 'img', 'og.jpg'), 'img/og.jpg');
if (existsSync(join(repo, 'docs', 'gallery'))) copy(join(repo, 'docs', 'gallery'), 'img/gallery');
// the hero film (the GIFs next to it are for the README only)
for (const f of ['hero.mp4', 'hero.webm', 'hero.webp'])
  if (existsSync(join(repo, 'docs', 'video', f))) copy(join(repo, 'docs', 'video', f), `video/${f}`);

console.log('static assets copied to web/public/');
