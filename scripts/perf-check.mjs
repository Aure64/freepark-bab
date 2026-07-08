// Mesure de perf réelle sur l'URL passée en argument (défaut : prod).
// Usage : node scripts/perf-check.mjs [url]
import { chromium, devices } from 'playwright';

const URL = process.argv[2] ?? 'https://freepark-bab.vercel.app/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
const page = await ctx.newPage();

const t0 = Date.now();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
const domReady = Date.now() - t0;
await page.waitForSelector('.sheet__brand', { timeout: 20_000 });
const uiVisible = Date.now() - t0;
// La carte est « prête » quand MapLibre a peint son canvas
await page.waitForFunction(() => {
  const canvas = document.querySelector('.maplibregl-canvas');
  return canvas && canvas.width > 0;
}, { timeout: 20_000 });
const mapCanvas = Date.now() - t0;
await page.waitForTimeout(3000); // laisse les tuiles arriver

const metrics = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  const resources = performance.getEntriesByType('resource');
  const slow = resources
    .filter((r) => r.duration > 300)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 8)
    .map((r) => `${Math.round(r.duration)}ms ${r.name.split('/').slice(-1)[0].slice(0, 60)} (${Math.round((r.transferSize ?? 0) / 1024)}ko)`);
  return {
    ttfb: Math.round(nav.responseStart),
    fcp: Math.round(paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? -1),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
    loadEvent: Math.round(nav.loadEventEnd),
    nbRequests: resources.length,
    totalKo: Math.round(resources.reduce((s, r) => s + (r.transferSize ?? 0), 0) / 1024),
    slow,
  };
});

console.log(`URL: ${URL}`);
console.log(`domcontentloaded: ${domReady}ms | UI visible: ${uiVisible}ms | canvas carte: ${mapCanvas}ms`);
console.log(JSON.stringify(metrics, null, 2));
await browser.close();
