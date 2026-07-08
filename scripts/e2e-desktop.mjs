// Vérifie la mise en page desktop façon Google Maps + visibilité des zones bleues.
import { chromium } from 'playwright';

const OUT = process.env.OUT ?? '/tmp';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

await page.goto('http://localhost:5199/');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/10-desktop-accueil.png` });

// Recherche → panneau latéral gauche avec résultats
await page.fill('input[type="search"]', 'place clemenceau biarritz');
await page.waitForTimeout(1600);
await page.locator('.search__row').first().click();
await page.waitForTimeout(2800);
await page.screenshot({ path: `${OUT}/11-desktop-resultats.png` });

const sheetBox = await page.locator('.sheet').boundingBox();
console.log('panneau:', JSON.stringify(sheetBox));
console.log('suggestions:', JSON.stringify(await page.locator('.row__name').allTextContents()));

// Zoom sur le centre de Biarritz pour vérifier les zones bleues (toujours visibles)
await page.evaluate(() => {
  window.__freeparkMap.jumpTo({ center: [-1.556, 43.4715], zoom: 15.5 });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/12-desktop-zones-bleues.png` });

console.log('JS errors:', errors.length ? errors : 'aucune');
await browser.close();
