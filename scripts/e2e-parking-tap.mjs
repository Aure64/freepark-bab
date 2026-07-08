// Vérifie la fiche parking : tap sur un point vert → carte détail → Y aller → chooser.
import { chromium, devices } from 'playwright';

const OUT = process.env.OUT ?? '/tmp';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

await page.goto('http://localhost:5199/');
await page.waitForTimeout(4000);

// Centre la carte sur un parking connu puis clique dessus via l'API MapLibre
const clicked = await page.evaluate(async () => {
  const res = await fetch('/data/zones.geojson');
  const data = await res.json();
  const parking = data.features.find(
    (f) => f.properties.kind === 'free-parking' && f.properties.capacity,
  ) ?? data.features.find((f) => f.properties.kind === 'free-parking');
  if (!parking) return null;
  const coords = parking.geometry.coordinates;
  // La carte est le premier canvas maplibre ; on récupère l'instance via le container
  const container = document.querySelector('.map-view');
  const map = container && container.querySelector('.maplibregl-canvas') ? window.__map : null;
  return { coords, name: parking.properties.name, hasMapGlobal: !!map };
});
console.log('parking cible:', JSON.stringify(clicked));

// Centre la carte sur le parking via l'instance exposée, puis clique au pixel projeté
const px = await page.evaluate(async (coords) => {
  const map = window.__freeparkMap;
  if (!map || !coords) return null;
  map.jumpTo({ center: coords, zoom: 16 });
  await new Promise((r) => setTimeout(r, 800));
  const p = map.project(coords);
  const rect = map.getCanvas().getBoundingClientRect();
  const hits = map.queryRenderedFeatures(p, { layers: ['parkings'] });
  const anyHits = map.queryRenderedFeatures(p).map((f) => f.layer.id).slice(0, 5);
  return { x: rect.left + p.x, y: rect.top + p.y, parkingHits: hits.length, layersAtPoint: anyHits };
}, clicked?.coords ?? null);
console.log('pixel projeté:', JSON.stringify(px));

let cardVisible = false;
if (px) {
  await page.mouse.click(px.x, px.y);
  await page.waitForTimeout(500);
  cardVisible = await page.locator('.parking-card').isVisible().catch(() => false);
}
console.log('fiche parking ouverte:', cardVisible);
if (cardVisible) {
  console.log('titre:', await page.locator('.parking-card h3').textContent());
  console.log('détail:', await page.locator('.parking-card__text p').textContent());
  await page.screenshot({ path: `${OUT}/07-fiche-parking.png` });
  await page.locator('.parking-card__go').click();
  await page.waitForTimeout(600);
  const chooserVisible = await page.locator('.navchooser').isVisible().catch(() => false);
  console.log('chooser navigation:', chooserVisible);
  if (chooserVisible) {
    await page.screenshot({ path: `${OUT}/08-nav-chooser.png` });
    console.log('apps:', await page.locator('.navchooser__app').allTextContents());
  }
}
console.log('JS errors:', errors.length ? errors : 'aucune');
await browser.close();
