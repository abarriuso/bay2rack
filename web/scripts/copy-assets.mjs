// Copies everything the site serves as static files into web/public/ (generated, not committed):
//   scad/      the OpenSCAD model (src/) - the browser renders it
//   stl/       the pre-built STLs and their catalogue (stl/index.json)
//   openscad/  OpenSCAD compiled to WebAssembly (+ fonts and licence texts) from node_modules
import { cpSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
// the film has no sound: its one caption says so and what it shows
writeFileSync(join(pub, 'video', 'hero.vtt'), `WEBVTT

00:00.000 --> 00:30.000
[No sound] An old beige PC opens: inside is a modern server, and its 5.25" bays become a rack.
`);

// Cloudflare Pages headers: the hashed bundles never change; OpenSCAD only with a new release (a week, then checked
// again in the background); the film and the images a day; the model and the STLs keep the default, so a push shows
// up at once. Every page: no framing by other sites, no MIME sniffing, HTTPS only.
writeFileSync(join(pub, '_headers'), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/openscad/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=2592000
/video/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
/img/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
`);

// for search engines and AI agents: what to crawl, the one page there is, and a plain summary of the project
const SITE = 'https://bay2rack.pages.dev/';
const GH = 'https://github.com/abarriuso/bay2rack';
writeFileSync(join(pub, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: ${SITE}sitemap.xml
`);
writeFileSync(join(pub, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>
</urlset>
`);
writeFileSync(join(pub, 'llms.txt'), `# bay2rack

> Turns the 5.25" drive bays of an old PC case into a 6" mini rack for a homelab, with 3D-printed parts. The web
> generator at ${SITE} configures the adapter (bays, front, what goes in every rack unit, patch panel ports, screws),
> shows it mounted in a real PC case in 3D and downloads a kit (.zip) with every STL, the bill of materials and print
> settings. It runs OpenSCAD compiled to WebAssembly in the browser. Licence: CC BY-NC-SA 4.0.

## Docs

- [README](${GH}/blob/main/README.md): what it is, the rack modules, the parameters
- [Build guide](${GH}/blob/main/docs/BUILD.md): what to buy, print settings, test pieces, assembly, wiring
- [Fitting your case](${GH}/blob/main/docs/CASES.md): measuring the bays and choosing the front
- [Pre-built STLs](${GH}/blob/main/stl/README.md): the ready-made pieces

## Source

- [OpenSCAD model](${GH}/blob/main/src/bay2rack.scad): every parameter, with its description
- [Web generator](${GH}/tree/main/web): Vite, three.js and openscad-wasm
`);

console.log('static assets copied to web/public/');
