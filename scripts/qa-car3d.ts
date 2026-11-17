// 3D car pass with motion allowed: hero at rest, pinned scroll explode, drag to turn, click to select.
// Needs the dev server. Output: qa/car/*.png.   npx tsx scripts/qa-car3d.ts [light|night|1440|390]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = process.env.QA_BASE ?? 'http://localhost:3000';
const only = process.argv[2] ?? '';
(async () => {
  mkdirSync('qa/car', { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const theme of ['light', 'night']) for (const width of [1440, 390]) {
    const tag = `${theme}-${width}`;
    if (only && !tag.includes(only)) continue;
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => localStorage.setItem('autoiq-theme', t), theme);
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/THREE.Clock|GL Driver/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
    await page.waitForSelector('canvas', { timeout: 60000 }).catch(() => errs.push('no canvas'));
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `qa/car/hero-${tag}.png` });

    // Pinned scroll: track travel is the padding below the art.
    const travel = await page.evaluate(() => { const art = document.querySelector('[class*="heroArt"]') as HTMLElement; const tr = art.parentElement!; return { y: tr.getBoundingClientRect().top + scrollY, t: tr.offsetHeight - art.offsetHeight, top: parseFloat(getComputedStyle(art).top) || 0 }; });
    const steps: string[] = [];
    for (const [i, raw] of [[1, 0.25], [2, 0.5], [3, 0.85]] as const) {
      await page.evaluate(({ y, t, top, r }) => window.scrollTo(0, y - top + t * r), { ...travel, r: raw });
      await page.waitForTimeout(600);
      steps.push(await page.evaluate(() => (document.querySelector('[data-step]') as HTMLElement).dataset.step ?? '?'));
      await page.screenshot({ path: `qa/car/scroll${i}-${tag}.png` });
    }
    await page.evaluate(({ y, top }) => window.scrollTo(0, y - top), travel);
    await page.waitForTimeout(500);

    // Drag to turn, then click the engine area and read the part card.
    const c = await page.locator('canvas').first().boundingBox();
    let card = '';
    if (c) {
      const cx = c.x + c.width * 0.5, cy = c.y + c.height * 0.5;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 160, cy + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `qa/car/turned-${tag}.png` });
      await page.getByRole('button', { name: 'Reset view' }).click().catch(() => errs.push('no reset button'));
      await page.waitForTimeout(700);
      // Engine sits at SVG x ~345, y ~ 330-80 => frame y (y+60)/540.
      await page.mouse.click(c.x + c.width * (345 / 1000), c.y + c.height * ((330 - 85 + 60) / 540));
      await page.waitForTimeout(600);
      card = (await page.locator('[aria-live="polite"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
      await page.screenshot({ path: `qa/car/selected-${tag}.png` });
    }
    // Solid look: resting view, turned, pulled apart, and a part selected.
    let solidCard = '';
    if (c) {
      await page.getByRole('button', { name: 'Reset view' }).click().catch(() => {});
      await page.getByRole('button', { name: 'Solid', exact: true }).click().catch(() => errs.push('no Solid button'));
      await page.waitForTimeout(900);
      await page.screenshot({ path: `qa/car/solid-${tag}.png` });
      const cx = c.x + c.width * 0.5, cy = c.y + c.height * 0.5;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 220, cy + 70, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `qa/car/solid-turned-${tag}.png` });
      await page.getByRole('button', { name: 'Reset view' }).click().catch(() => {});
      await page.waitForTimeout(700);
      // Front wheel (SVG 233, 261).
      await page.mouse.click(c.x + c.width * (233 / 1000), c.y + c.height * ((261 + 60) / 540));
      await page.waitForTimeout(600);
      solidCard = (await page.locator('[aria-live="polite"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
      await page.screenshot({ path: `qa/car/solid-selected-${tag}.png` });
      await page.evaluate(({ y, t, top }) => window.scrollTo(0, y - top + t * 0.85), travel);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `qa/car/solid-scroll3-${tag}.png` });
    }
    console.log(tag, 'solid card:', solidCard.slice(0, 60));
    const hs = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(tag, 'steps', steps.join(','), 'hscroll', hs, 'card:', card.slice(0, 80), errs.length ? '\n  ' + errs.join('\n  ') : '');
    await ctx.close();
  }
  await browser.close();
})();
