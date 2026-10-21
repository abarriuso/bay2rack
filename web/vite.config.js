import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { dict } from './src/strings.js';

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

// Relative base so the build works on any path (GitHub Pages serves it under /bay2rack/).
export default defineConfig({
  base: './',
  plugins: [liveRepoFiles(), staticTexts()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, sourcemap: true },
  worker: { format: 'es' },
});
