import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { dict } from './src/strings.js';
import { EXAMPLES } from './src/examples.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.scad': 'text/plain', '.json': 'application/json', '.stl': 'model/stl', '.md': 'text/markdown', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4', '.webm': 'video/webm' };

// In dev, serve the model and the STLs straight from the repo so edits show up on reload
// (the build copies them into public/ with scripts/copy-assets.mjs).
const liveRepoFiles = () => ({
  name: 'bay2rack-live-files',
  configureServer(server) {
    for (const [url, dir] of [['/scad/', 'src'], ['/stl/', 'stl'], ['/img/gallery/', 'docs/gallery'], ['/video/', 'docs/video']]) {
      server.middlewares.use(url, (req, res, next) => {
        const file = normalize(join(repo, dir, decodeURIComponent(req.url.split('?')[0])));
        if (!file.startsWith(join(repo, dir)) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(file).pipe(res);
      });
    }
    // dev only: the page can save captures (gallery shots, GIF frames) into docs/
    server.middlewares.use('/__save', (req, res) => {
      const rel = new URL(req.url, 'http://x').searchParams.get('path') ?? '';
      const file = normalize(join(repo, 'docs', rel));
      if (req.method !== 'POST' || !file.startsWith(join(repo, 'docs'))) { res.statusCode = 400; res.end(); return; }
      const parts = [];
      req.on('data', (c) => parts.push(c));
      req.on('end', () => {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, Buffer.concat(parts));
        res.end('ok');
      });
    });
  },
});

// The English texts written into index.html at build time (applyI18n puts them in at run time too): search engines
// and the first paint get the words, and the page does not jump when the script fills them in.
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const staticTexts = () => ({
  name: 'bay2rack-static-texts',
  transformIndexHtml: (html) => html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)(<\/\2>)/g,
    (m, open, tag, key, close) => (dict.en[key] != null ? open + esc(dict.en[key]).replace(/\{\w+\}/g, '') + close : m)),
});

// After the build: /es/ (the same page with the Spanish texts in it, for search engines and links) and /m/<build>/
// for each ready-made build (its name, text and picture for link previews, then straight into the configurator).
const SITE = 'https://bay2rack.pages.dev/';
const attr = (x) => esc(x).replace(/"/g, '&quot;');
function spanish(html) {
  const es = dict.es;
  return html
    .replace('<html lang="en"', '<html lang="es"')
    .replace(/(<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g,
      (m, open, tag, key, old, close) => (es[key] != null ? open + esc(es[key]).replace(/\{\w+\}/g, '') + close : m))
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(es.page_title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${attr(es.page_desc)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${attr(es.page_title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${attr(es.page_desc)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}es/`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${SITE}es/`)
    // one folder down: the relative addresses go up one
    .replace(/\b(src|href|poster)="(?!https?:|#|data:|mailto:|\/)([^"]*)"/g, '$1="../$2"');
}
function sharePage(k) {
  const en = dict.en;
  const hash = '#' + new URLSearchParams(Object.entries(EXAMPLES[k]).map(([a, b]) => [a, String(b)])).toString();
  const img = existsSync(join(repo, 'docs', 'gallery', `${k}-og.jpg`)) ? `img/gallery/${k}-og.jpg` : 'img/og.jpg';
  const title = `${en['ex_' + k]} · bay2rack`;
  const to = `../../${hash}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="robots" content="noindex">
  <meta name="description" content="${attr(en['ex_' + k + '_tip'])}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${attr(title)}">
  <meta property="og:description" content="${attr(en['ex_' + k + '_tip'])}">
  <meta property="og:image" content="${SITE}${img}">
  <meta property="og:url" content="${SITE}m/${k}/">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${SITE}">
  <meta http-equiv="refresh" content="0; url=${attr(to)}">
  <script>location.replace(${JSON.stringify(to)});</script>
</head>
<body><p><a href="${attr(to)}">${esc(title)}</a></p></body>
</html>
`;
}
const extraPages = () => {
  let outDir = 'dist';
  return {
    name: 'bay2rack-pages',
    apply: 'build',
    configResolved: (c) => { outDir = c.build.outDir; },
    closeBundle() {
      const dir = join(dirname(fileURLToPath(import.meta.url)), outDir);
      mkdirSync(join(dir, 'es'), { recursive: true });
      writeFileSync(join(dir, 'es', 'index.html'), spanish(readFileSync(join(dir, 'index.html'), 'utf8')));
      for (const k of Object.keys(EXAMPLES)) {
        mkdirSync(join(dir, 'm', k), { recursive: true });
        writeFileSync(join(dir, 'm', k, 'index.html'), sharePage(k));
      }
    },
  };
};

// Relative base so the build works on any path (GitHub Pages serves it under /bay2rack/).
export default defineConfig({
  base: './',
  plugins: [liveRepoFiles(), staticTexts(), extraPages()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, sourcemap: true },
  worker: { format: 'es' },
});
