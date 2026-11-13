// Makes the first look's build ahead: the film builds it in the 3D view the moment the view is there, without the
// engine (11 MB of WebAssembly, then the render). It renders it with the site's own engine, in a browser, against the
// dev server, and writes docs/scroll/first.json (the settings it was made for, a sum of the model's source, its log)
// and docs/scroll/first.3mf. Run it again whenever the model (src/*.scad) or the first look's settings change - the
// site is built without a build made for another model (copy-assets.mjs), and a test says so.
//   pnpm dev            (in another terminal)
//   node scripts/first-render.mjs [http://localhost:5173/]
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { modelSum } from './scad-sum.mjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'scroll');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage();
await page.goto(url);
await page.waitForFunction(() => !!window.__b2r?.S?.scadSum, null, { timeout: 60_000 });
const r = await page.evaluate(async () => {
  const E = await import('/src/engine.js');
  const { S } = window.__b2r;
  await E.startEngine();
  for (let i = 0; i < 600 && S.engine !== 'ready'; i++) await new Promise((ok) => setTimeout(ok, 100));
  if (S.engine !== 'ready') throw new Error('the engine did not start');
  const values = { ...S.values };
  const defs = E.definesFor(values);
  defs.push('web_scene=true');
  const res = await E.runJob(defs, 'out.3mf');
  if (!res.ok) throw new Error(res.logs.join('\n'));
  let bin = '';
  for (let i = 0; i < res.data.length; i += 0x8000) bin += String.fromCharCode(...res.data.subarray(i, i + 0x8000));
  return { key: 'out.3mf\n' + defs.join('\n'), scad: S.scadSum, logs: res.logs, ms: Math.round(res.ms), data: btoa(bin) };
});
writeFileSync(join(out, 'first.3mf'), Buffer.from(r.data, 'base64'));
const model = modelSum(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src'));
writeFileSync(join(out, 'first.json'), JSON.stringify({ key: r.key, scad: r.scad, model, ms: r.ms, file: 'first.3mf', logs: r.logs }) + '\n');
console.log(`first.3mf ${(Buffer.from(r.data, 'base64').length / 1024).toFixed(0)} KB, rendered in ${r.ms} ms, model ${r.scad}`);
await browser.close();
