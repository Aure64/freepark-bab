import { chromium, devices } from 'playwright';

const OUT = '/tmp/claude-1000/-home-aurelien-geoloc-places-gratuites/838dd34d-3509-4419-903b-75b8e442835d/scratchpad';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto('http://localhost:5199/');
await page.waitForTimeout(4500); // tuiles + geojson
await page.screenshot({ path: `${OUT}/01-accueil.png` });

// Recherche : resto au centre de Biarritz
await page.fill('input[type="search"]', 'place clemenceau biarritz');
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/02-autocomplete.png` });
const rows = page.locator('.search__row');
console.log('autocomplete rows:', await rows.count());
await rows.first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/03-resultats-maintenant.png` });

// Contenu des suggestions
const names = await page.locator('.row__name').allTextContents();
const badges = await page.locator('.row .badge').allTextContents();
const walks = await page.locator('.row__walk').allTextContents();
console.log('suggestions:', JSON.stringify(names, null, 1));
console.log('badges:', JSON.stringify(badges));
console.log('walk:', JSON.stringify(walks));
const destBadge = await page.locator('.sheet__dest-status').textContent();
console.log('dest status:', destBadge);

// Ouvre la sheet en grand
await page.locator('.sheet__grip-zone').click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/04-sheet-ouverte.png` });

// Mode soirée : samedi 20h30 (11 juillet 2026)
await page.evaluate(() => {
  const input = document.querySelector('.time__input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '2026-07-11T20:30');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/05-samedi-20h30.png` });
console.log('dest status soir:', await page.locator('.sheet__dest-status').textContent());
console.log('badges soir:', JSON.stringify(await page.locator('.row .badge').allTextContents()));

// Probe : filtre < 10 min + gratuit uniquement
await page.locator('.filter', { hasText: 'Gratuit uniquement' }).click();
await page.locator('.filter', { hasText: '10 min' }).click();
await page.waitForTimeout(1200);
console.log('après filtres:', JSON.stringify(await page.locator('.row__name').allTextContents()));
await page.screenshot({ path: `${OUT}/06-filtres.png` });

// Probe : recherche pourrie
await page.fill('input[type="search"]', 'zzzzzzz nulle part xyz');
await page.waitForTimeout(1500);
console.log('rows recherche pourrie:', await page.locator('.search__row').count());

// Probe : retour "Maintenant"
await page.locator('.time__chip', { hasText: 'Maintenant' }).click();
await page.waitForTimeout(800);

console.log('JS errors:', errors.length ? errors : 'aucune');
await browser.close();
