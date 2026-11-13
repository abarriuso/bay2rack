// The web generator in a browser: the page, the Spanish page, the share pages, the editor with real OpenSCAD renders,
// the piece view, undo, short links and the kit. Each one guards something that broke once.
import { test, expect, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { modelSum } from '../scripts/scad-sum.mjs';

// the engine is ready and the last render is shown ("Rendered in 1.2 s")
const rendered = (page) => expect(page.locator('#status')).toHaveText(/Rendered in|Generado en/);
// errors in the console (a failed resource of the dev tools aside)
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test('the page has its words before any script, and the files search engines read', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('into a 6" mini rack with 3D-printed parts');
  expect(html).toContain('hreflang="es"');
  expect(html).toContain('"@type": "SoftwareApplication"');
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/es/');
  expect((await request.get('/manifest.webmanifest')).ok()).toBeTruthy();
  expect((await request.get('/sw.js')).ok()).toBeTruthy();
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Bay2Rack');
  expect(errors).toEqual([]);
});

test('/es/ is Spanish, its scripts and images load from one folder up', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/es/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('.lead')).toHaveText(/Convierte las bahías/);
  await expect(page.locator('#steps .step h4').first()).toHaveText(/¿Qué quieres poner/);
  expect(errors).toEqual([]);
});

test('the film follows the scroll: each text comes in at its frames', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('#film')).toHaveClass(/live/);
  await expect(page.locator('.beat.on h1')).toHaveText('Bay2Rack');
  await page.evaluate(() => {
    const f = document.querySelector('#film'), st = f.querySelector('.film-stage');
    document.documentElement.style.scrollBehavior = 'auto';
    // (the film's own stretch: its length less the coda's, where the stage closes and the PC is built)
    const span = f.offsetHeight - st.offsetHeight - f.querySelector('.film-coda').offsetHeight - f.querySelector('.film-assemble').offsetHeight;
    window.scrollTo(0, f.offsetTop + span * 0.52);
  });
  await expect(page.locator('.beat.on h2')).toHaveText(/Every unit/);
  await expect(page.locator('.beat.on')).toHaveCount(1);
  expect(errors).toEqual([]);
});

// The big frames (1600 px, one for every frame of the film: 21 MB) are asked for around the scroll position only: a
// visitor who never scrolls the film gets a first stretch of them, one who does gets the ones on the way. From the
// second text on, a key skips the film.
test('a film nobody scrolls stays light, and can be skipped', async ({ page }) => {
  const fine = new Set();
  page.on('request', (r) => { if (/\/scroll\/\w+\/1600\//.test(r.url())) fine.add(r.url()); });
  await page.goto('/');
  await expect(page.locator('#film')).toHaveClass(/live/);
  await page.waitForTimeout(2500);
  expect(fine.size).toBeGreaterThan(0);
  expect(fine.size).toBeLessThan(60);
  expect([...fine][0]).toMatch(/\.webp\?v=\w+$/);          // (under the film's version: kept long, new after an encode)
  await expect(page.locator('.film-skip')).toBeHidden();
  await page.evaluate(() => {
    const f = document.querySelector('#film');
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, f.offsetTop + (f.offsetHeight - innerHeight) * 0.45);
  });
  await expect(page.locator('#film')).toHaveClass(/rolling/);
  await expect.poll(() => fine.size).toBeGreaterThan(60);
  expect(fine.size).toBeLessThan(400);
  await page.locator('.film-skip').click();
  await expect(page.locator('#film')).toHaveClass(/merged/);
  await expect(page.locator('#configurator')).toBeInViewport({ ratio: 0.9 });
});

// a phone: an iPhone's screen and touch (in Chromium: Safari itself only on a real one). The big headings once ran off
// the side, and the film once drew at four times the pixels its frames have.
test.describe('on a phone', () => {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices['iPhone 14'];
  test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });
  test('nothing is wider than the screen, the film plays and its first text shows', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('#film')).toHaveClass(/live/);
    await expect(page.locator('.beat.on h1')).toHaveText('Bay2Rack');
    await expect(page.locator('.beat.on h1')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.beat.on .cta .btn').first()).toBeInViewport({ ratio: 1 });
    // the canvas is no bigger than the phone's frames (960 x 540) need
    const canvas = await page.locator('#filmCanvas').evaluate((c) => c.width * c.height);
    expect(canvas).toBeLessThanOrEqual(1100 * 1100);
    const overflow = () => page.evaluate(() => {
      const wide = [...document.querySelectorAll('.beat h1, .beat h2, .band h2, .build h2:not(.build-head h2), .foot-mark')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent);
      return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, wide };
    });
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: viewport.height });
      expect(await overflow(), `${width} px`).toEqual({ page: 0, wide: [] });
    }
    expect(errors).toEqual([]);
  });
});

// the end of the film: its coda closes the picture into the shape of the configurator, which lies right under it -
// its 3D view where the coda's window is - and takes over there; back up, the film is on top again
test('the film ends inside the configurator', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('#film')).toHaveClass(/live/);
  await page.evaluate(() => {
    const f = document.querySelector('#film'), st = document.querySelector('.film-stage');
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, f.offsetTop + f.offsetHeight - st.offsetHeight - parseFloat(getComputedStyle(st).top) - 4);
  });
  await expect(page.locator('#film')).toHaveClass(/closing/);
  await expect.poll(() => page.locator('.film-stage').evaluate((s) => +s.style.getPropertyValue('--k'))).toBeGreaterThan(0.99);
  await expect(page.locator('.beat.on h2')).toHaveText(/Now, yours/);
  // the 3D view lies exactly where the coda's window is, at the moment the stage lets go
  const at = await page.evaluate(() => {
    const f = document.querySelector('#film'), st = document.querySelector('.film-stage');
    window.scrollTo(0, f.getBoundingClientRect().top + scrollY + f.offsetHeight - st.offsetHeight - parseFloat(getComputedStyle(st).top) - 1);
    const w = document.querySelector('.film-window').getBoundingClientRect(), v = document.querySelector('.viewer').getBoundingClientRect();
    return [w.left - v.left, w.top - v.top, w.width - v.width, w.height - v.height].map((x) => Math.abs(x) <= 2);
  });
  expect(at).toEqual([true, true, true, true]);
  await expect(page.locator('#film')).not.toHaveClass(/merged/);
  await page.locator('.beat.on .cta .btn').click();
  await expect(page.locator('#film')).toHaveClass(/merged/);
  await expect(page.locator('#configurator')).toBeInViewport({ ratio: 0.9 });
  await expect(page.locator('#configurator')).toBeFocused();
  await expect(page.locator('#status')).toHaveClass(/\bok\b/, { timeout: 60_000 });
  // back up into the film: the stage is on top again
  await page.evaluate(() => window.scrollBy(0, -600));   // (a wheel over the 3D view zooms it)
  await expect(page.locator('#film')).not.toHaveClass(/merged/);
  expect(errors).toEqual([]);
});

// after the coda, the scroll builds the PC from the film's table in the 3D view itself: its canvas is on the stage
// while it is built, home in the configurator where the stage lets go, and back on the stage up again
test('the scroll builds the PC from the film table, into the configurator', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('#film')).toHaveClass(/live/);
  const to = (k) => page.evaluate((k) => {
    const f = document.querySelector('#film'), st = f.querySelector('.film-stage');
    const all = f.offsetHeight - st.offsetHeight, close = f.querySelector('.film-coda').offsetHeight, asm = f.querySelector('.film-assemble').offsetHeight;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, f.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(st).top) + all - asm + k * asm);
  }, k);
  const home = () => page.evaluate(() => document.querySelector('canvas:not(.film-canvas)')?.parentElement?.className ?? '');
  // (down through the film: the engine starts on the way)
  for (const k of [-8, -6, -4, -2, -1]) await to(k);
  await to(0);
  await expect(page.locator('#film')).toHaveClass(/live3d/, { timeout: 60_000 });
  await to(0.5);
  await expect.poll(home).toBe('film-3d on');
  await expect(page.locator('.film-3d')).toHaveCSS('opacity', '1');
  const long = await page.evaluate(() => document.querySelector('.film-assemble').offsetHeight);
  await to(1.01);
  await expect(page.locator('#film')).toHaveClass(/merged/);
  await expect.poll(home).toBe('view');
  await expect(page.locator('.film-3d canvas')).toHaveCount(0);
  // in the configurator, at rest, the stretch that built it gets short - the view does not move - and back up from it
  // the PC comes apart on the stage again, over that little scroll
  const at = await page.evaluate(() => document.querySelector('#view').getBoundingClientRect().top);
  await expect(page.locator('#film')).toHaveClass(/built/);
  await expect.poll(() => page.evaluate(() => document.querySelector('.film-assemble').offsetHeight)).toBeLessThan(long * 0.6);
  expect(Math.abs(await page.evaluate(() => document.querySelector('#view').getBoundingClientRect().top) - at)).toBeLessThan(1);
  await to(0.5);
  await expect(page.locator('#film')).not.toHaveClass(/merged/);
  await expect.poll(home).toBe('film-3d on');
  await to(1.01);
  await expect.poll(home).toBe('view');
  expect(errors).toEqual([]);
});

// the film's build is made ahead (scripts/first-render.mjs) for this very model: the PC is built on the table with no
// engine at all - and a model changed since is caught here, not by a visitor
test('the film builds the PC made ahead, before the engine', async ({ page }) => {
  const errors = watchErrors(page);
  const made = await page.request.get('/scad/first.json');
  expect(made.ok(), 'no build made ahead for this model: run node scripts/first-render.mjs').toBe(true);
  expect((await made.json()).model).toBe(modelSum(fileURLToPath(new URL('../../src', import.meta.url))));
  await page.route('**/openscad/**', (r) => r.abort());
  await page.goto('/');
  await expect(page.locator('#film')).toHaveClass(/live/);
  await page.evaluate(() => {
    const f = document.querySelector('#film'), st = f.querySelector('.film-stage');
    const all = f.offsetHeight - st.offsetHeight, asm = f.querySelector('.film-assemble').offsetHeight;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, f.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(st).top) + all - asm);
  });
  await expect(page.locator('#film')).toHaveClass(/live3d/, { timeout: 60_000 });
  expect(errors.filter((e) => !/openscad|Failed to load resource|engine/i.test(e))).toEqual([]);
});

// a zoom of the page (or a window made narrower) changes how tall everything in the film is: the place in the film
// is kept, not the scrollY (it once jumped to another moment)
test('the film keeps its place when the window changes size', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#film')).toHaveClass(/live/);
  await page.evaluate(() => {
    const f = document.querySelector('#film'), st = f.querySelector('.film-stage');
    document.documentElement.style.scrollBehavior = 'auto';
    // (the film's own stretch: its length less the coda's, where the stage closes and the PC is built)
    const span = f.offsetHeight - st.offsetHeight - f.querySelector('.film-coda').offsetHeight - f.querySelector('.film-assemble').offsetHeight;
    window.scrollTo(0, f.offsetTop + span * 0.52);
  });
  await expect(page.locator('.beat.on h2')).toHaveText(/Every unit/);
  const progress = () => page.locator('#filmBar').evaluate((b) => +(b.style.transform.match(/scaleX\(([\d.]+)\)/)?.[1] ?? 0));
  // (the picture glides after the scroll: the place is read once it has settled)
  let seen = -1;
  await expect.poll(async () => { const p = await progress(), still = p > 0.3 && p === seen; seen = p; return still; }, { intervals: [400] }).toBe(true);
  const before = seen;
  await page.setViewportSize({ width: 1000, height: 560 });    // (as a zoom does: the svh of the film change too)
  await expect.poll(async () => Math.abs((await progress()) - before)).toBeLessThan(0.02);
  await expect(page.locator('.beat.on h2')).toHaveText(/Every unit/);
});

// the blueprint and the explode: on, off, and nothing breaks
test('the blueprint draws the build with its sizes, the explode takes it apart and back', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#bays=4');
  await rendered(page);
  const bp = page.getByRole('button', { name: /^Blueprint/ });
  await bp.click();
  await expect(bp).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.vx-title')).toContainText(/4/);
  await bp.click();
  await expect(bp).toHaveAttribute('aria-pressed', 'false');
  const ex = page.getByRole('button', { name: /^Take the build apart/ });
  await ex.click();
  await expect(ex).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.vx-range')).toHaveValue('100');
  await ex.click();
  await expect(ex).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.vx-range')).toHaveValue('0');
  expect(errors).toEqual([]);
});

// "Share": the link, and a picture of the build made for it, ready to save
test('the share dialog makes a picture of the build', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#bays=4');
  await rendered(page);
  await page.locator('#share').click();
  const dialog = page.locator('dialog.sf-share');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.sf-url')).toHaveValue(/bays=4|\/s\//);
  await expect(dialog.locator('.sf-img')).toBeVisible({ timeout: 15_000 });
  expect(await dialog.locator('.sf-img').evaluate((im) => im.naturalWidth)).toBeGreaterThan(600);
  await expect(dialog.locator('.sf-save')).not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a share page sends you to its build', async ({ page }) => {
  await page.goto('/m/router/');
  await page.waitForURL(/#.*rack_modules=/);
  await expect(page.locator('#steps')).toContainText('JetKVM');
});

test('two patch panels keep their own ports, and the piece view keeps the piece', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#bays=4&rack_modules=patch,patch,label');
  await rendered(page);
  const trays = page.locator('#steps .tray-ports');
  await expect(trays).toHaveCount(2);
  await trays.nth(1).locator('summary').click();
  await trays.nth(1).locator('.port-name').first().fill('My NAS');
  await trays.nth(1).locator('.port-name').first().press('Tab');
  await expect(page).toHaveURL(/rack_modules=patch,patch:rj45m=My_NAS/);
  // the label module says its own text
  const text = page.locator('#steps .rows .label-text');
  await text.fill('Rack two');
  await text.press('Tab');
  await expect(page).toHaveURL(/label:Rack_two/);
  // piece by piece: the second patch panel stays chosen (it fell back to the switch once)
  await page.getByRole('button', { name: 'Piece by piece' }).click();
  const pick = page.locator('select.piece-select');
  const second = await pick.locator('option', { hasText: 'Patch panel 2' }).getAttribute('value');
  await pick.selectOption(second);
  await rendered(page);
  await expect(pick.locator('option:checked')).toHaveText(/Patch panel 2/);
  await expect(page).toHaveURL(/module_type=patch:rj45m=My_NAS/);
  expect(errors).toEqual([]);
});

test('undo and redo', async ({ page }) => {
  await page.goto('/#bays=4');
  await rendered(page);
  await page.locator('.seg-btn', { hasText: /^5$/ }).first().click();
  await expect(page).toHaveURL(/bays=5/);
  await page.locator('#undo').click();
  await expect(page).not.toHaveURL(/bays=5/);
  await page.locator('#redo').click();
  await expect(page).toHaveURL(/bays=5/);
});

test('a short link opens the same build', async ({ page, context }) => {
  await page.goto('/#bays=5&rack_modules=uswflex,ms105g,ux,patch&ks_names=WAN,LAN,NAS&label_text=MY%20LAB');
  await rendered(page);
  await page.locator('#share').click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  const other = await context.newPage();
  await other.goto(url);
  await expect(other).toHaveURL(/ks_names=WAN,LAN,NAS/);
  await expect(other).toHaveURL(/rack_modules=uswflex,ms105g,ux,patch/);
});

test('the 3D view turns with the keyboard and says what it shows', async ({ page }) => {
  await page.goto('/#bays=4');
  await rendered(page);
  const canvas = page.locator('#view canvas');
  await expect(canvas).toHaveAttribute('aria-label', /3D view.*4 bays/);
  await canvas.focus();
  await canvas.press('ArrowLeft');
  await canvas.press('+');
});

test('the kit downloads with every piece', async ({ page }) => {
  test.setTimeout(480_000);
  await page.goto('/#bays=4');
  await rendered(page);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 420_000 }), page.locator('#kitBar').click()]);
  expect(download.suggestedFilename()).toMatch(/^bay2rack-kit-4bay\.zip$/);
  await expect(page.locator('#status')).toHaveText(/Kit ready: \d+ files/);
});
