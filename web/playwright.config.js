// End-to-end tests of the web generator, in a real browser against the built site (pnpm build first):
//   pnpm test:e2e            (locally PW_CHANNEL=msedge uses the installed Edge instead of a downloaded Chromium)
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 240_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    locale: 'en-US',
    channel: process.env.PW_CHANNEL || undefined,
    viewport: { width: 1280, height: 860 },
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
    // WebGL without a GPU (headless): the software renderer
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
