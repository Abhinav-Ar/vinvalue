// DATABASE_URL=pglite:./.data/pglite npm run dev, then npx tsx scripts/qa-car3d.ts
import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base = process.env.QA_BASE ?? 'http://localhost:3000';
const output = process.env.QA_OUT ?? 'qa/car';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const theme of ['light', 'night'])
    for (const width of [1440, 390]) {
      const tag = theme + '-' + width;
      if (!tag.includes(process.argv[2] ?? '')) continue;
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      await ctx.addInitScript((theme) => localStorage.setItem('autoiq-theme', theme), theme);
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(base, { timeout: 120000 });
      const viewer = page.locator('[data-ready=true]');
      await viewer.waitFor({ timeout: 90000 });
      const art = page.locator('[class*="heroArt"]').first();
      const travel = await art.evaluate((el) => ({
        y: el.parentElement!.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(el).top),
        travel: el.parentElement!.offsetHeight - (el as HTMLElement).offsetHeight,
      }));
      for (const state of ['assembled', 'exploded']) {
        await page.evaluate(
          (y) => scrollTo({ top: y, behavior: 'instant' }),
          travel.y + travel.travel * (state === 'assembled' ? 0 : 0.86),
        );
        await expect(viewer).toHaveAttribute('data-step', state === 'assembled' ? '0' : '3');
        for (const look of ['x-ray', 'solid']) {
          await page
            .getByRole('button', { name: look === 'solid' ? 'Solid' : 'X-ray', exact: true })
            .evaluate((el) => (el as HTMLElement).click());
          await page.mouse.move(0, 0);
          await page.waitForTimeout(800);
          await page.screenshot({ style: 'nextjs-portal { display: none !important }', path: `${output}/${tag}-${state}-${look}.png` });
        }
      }
      const canvas = viewer.locator('canvas');
      const bounds = await canvas.boundingBox();
      if (!bounds) throw Error('Missing canvas');
      const cx = bounds.x + bounds.width * 0.5,
        cy = bounds.y + bounds.height * 0.45;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 45, cy + 8, { steps: 5 });
      await page.mouse.up();
      await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
      await page.getByRole('button', { name: 'Reset view' }).click();
      await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), travel.y);
      await expect(viewer).toHaveAttribute('data-step', '0');
      await page.waitForTimeout(600);
      const rest = await canvas.boundingBox();
      if (!rest) throw Error('Missing assembled model');
      await page.mouse.click(rest.x + rest.width * 0.5, rest.y + rest.height * 0.5);
      await expect(viewer.locator('[aria-live]')).toContainText('Body');
      if (width === 1440) {
        await page.getByRole('button', { name: 'Reset view' }).click();
        await page.getByRole('button', { name: 'X-ray', exact: true }).click();
        await viewer.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.mouse.move(0, 0);
        await viewer.focus();
        await viewer.press('ArrowRight');
        await viewer.press('ArrowDown');
        await page.waitForTimeout(1200);
        // Re-render at plate scale so the detail crops contain native resolution linework.
        const detail = await page.addStyleTag({ content: `
          [data-ready=true] { position:fixed !important; top:0; left:0; width:1440px !important; z-index:100; background:var(--paper); }
          [data-ready=true] > svg, nextjs-portal {visibility:hidden}
        ` });
        await page.waitForTimeout(500);
        const box = await canvas.boundingBox();
        if (!box) throw Error('Missing detail view');
        for (const [name, x, y, w, h] of [
          ['front-quarter', .08, .26, .65, .60], ['wheel', .29, .57, .20, .32],
        ] as const) {
          await page.screenshot({ clip: { x: box.x + box.width*x, y: box.y + box.height*y,
            width: box.width*w, height: box.height*h }, path: `${output}/${theme}-${name}.png` });
        }
        await detail.evaluate(el => el.parentNode?.removeChild(el));
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(canvas).toHaveCount(0);
      expect(errors).toEqual([]);
      await ctx.close();
      console.log(tag);
    }
} finally {
  await browser.close();
}
