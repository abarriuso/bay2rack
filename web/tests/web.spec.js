// The web generator in a browser: the page, the Spanish page, the share pages, the editor with real OpenSCAD renders,
// the piece view, undo, short links and the kit. Each one guards something that broke once.
import { test, expect, devices } from '@playwright/test';

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
    const f = document.querySelector('#film');
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, f.offsetTop + (f.offsetHeight - innerHeight) * 0.45);
  });
  await expect(page.locator('.beat.on h2')).toHaveText(/Every unit/);
  await expect(page.locator('.beat.on')).toHaveCount(1);
  expect(errors).toEqual([]);
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
      const wide = [...document.querySelectorAll('.beat h1, .beat h2, .band h2, .build h2, .foot-mark')]
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
