import { defineConfig } from 'vite';

// Relative base so the build works on any path (GitHub Pages serves it under /bay2rack/).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  worker: { format: 'es' },
});
