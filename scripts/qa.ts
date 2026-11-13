/**
 * QA pass: full-page screenshots of every route in both themes at 1440 and 390 wide, plus axe checks.
 * Needs the dev server (npm run dev) with the seeded demo garage. Output: qa/screens/*.png, qa/axe.json.
 *
 *   npx tsx scripts/qa.ts [routeFilter]
 */
import { chromium, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.QA_BASE ?? 'http://localhost:3000';
const filter = process.argv[2] ?? '';

async function main() {
  mkdirSync('qa/screens', { recursive: true });
  const vehicles = (await (await fetch(`${BASE}/api/vehicles`)).json()) as { vehicles: { id: string; label: string }[] };
  const vid = vehicles.vehicles.find((v) => /Mustang/.test(v.label))?.id ?? vehicles.vehicles[0]?.id;
  const routes: [string, string][] = [
    ['landing', '/'],
    ['appraise', '/appraise?vin=1FA6P8CF9K5123456'],
    ['report', '/report/sample'],
    ['garage', '/garage'],
    ['maintenance', '/garage/maintenance'],
    ['vehicle', `/garage/${vid}`],
    ['value', `/garage/${vid}/value`],
    ['sell', `/garage/${vid}/sell`],
    ['buy', '/buy'],
    ['market', '/market'],
    ['alerts', '/alerts'],
    ['history', '/history'],
    ['signin', '/sign-in'],
    ['notfound', '/no-such-page'],
  ];
  const browser = await chromium.launch();
  const axe: Record<string, { id: string; impact: string | null; help: string; nodes: number; sample: string }[]> = {};
  for (const theme of ['light', 'night'] as const) {
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await ctx.addInitScript((t) => localStorage.setItem('autoiq-theme', t), theme);
      const page: Page = await ctx.newPage();
      for (const [name, path] of routes) {
        if (filter && !name.includes(filter)) continue;
        const res = await page.goto(BASE + path, { waitUntil: 'load', timeout: 120_000 }).catch((e: Error) => {
          console.log(`  ${name}: ${e.message.split('\n')[0]}`);
          return null;
        });
        if (!res) continue;
        // Wait for client data: no skeletons left and the nav has resolved sign-in state.
        await page
          .waitForFunction(() => !document.querySelector('.skel') && !!document.querySelector('header a[href="/history"], header a[href^="/sign-in"]'), null, { timeout: 30_000 })
          .catch(() => console.log(`  ${name}: still loading after 30s`));
        await page.waitForTimeout(300);
        const tag = `${name}-${theme}-${width}`;
        await page.screenshot({ path: `qa/screens/${tag}.png`, fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (theme === 'light' || width === 1440) {
          const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
          axe[tag] = r.violations.map((v) => ({ id: v.id, impact: v.impact ?? null, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target.join(' ') ?? '' }));
        }
        console.log(`${tag} status=${res?.status()} hscroll=${overflow}px axe=${axe[tag]?.length ?? '-'}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  writeFileSync('qa/axe.json', JSON.stringify(axe, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
