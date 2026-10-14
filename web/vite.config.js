import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.scad': 'text/plain', '.json': 'application/json', '.stl': 'model/stl', '.md': 'text/markdown' };

// In dev, serve the model and the STLs straight from the repo so edits show up on reload
// (the build copies them into public/ with scripts/copy-assets.mjs).
const liveRepoFiles = () => ({
  name: 'bay2rack-live-files',
  configureServer(server) {
    for (const [url, dir] of [['/scad/', 'src'], ['/stl/', 'stl']]) {
      server.middlewares.use(url, (req, res, next) => {
        const file = normalize(join(repo, dir, decodeURIComponent(req.url.split('?')[0])));
        if (!file.startsWith(join(repo, dir)) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(file).pipe(res);
      });
    }
  },
});

// Relative base so the build works on any path (GitHub Pages serves it under /bay2rack/).
export default defineConfig({
  base: './',
  plugins: [liveRepoFiles()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  worker: { format: 'es' },
});
