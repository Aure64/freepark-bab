// Pipeline de données FreePark BAB.
// Télécharge les open data (Biarritz, Anglet, Bayonne) + parkings gratuits OSM,
// normalise le tout en un GeoJSON unique : public/data/zones.geojson
//
// Usage : node scripts/build-data.mjs [--offline]
//   --offline : n'essaie pas de télécharger, utilise uniquement le cache data/raw/

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEDULES } from './schedules.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'public', 'data', 'zones.geojson');
const OFFLINE = process.argv.includes('--offline');

const SOURCES = {
  biarritz_payant:
    'https://data.biarritz.fr/api/explore/v2.1/catalog/datasets/stationnement_payant/exports/geojson',
  biarritz_bleue:
    'https://data.biarritz.fr/api/explore/v2.1/catalog/datasets/bleue/exports/geojson',
  anglet_littoral:
    'https://anglet-opendatapaysbasque.opendatasoft.com/api/explore/v2.1/catalog/datasets/localisation-des-stationnements-payants-sur-le-littoral/exports/geojson',
  bayonne_zones: 'https://www.bayonne.fr/fileadmin/open-data/geojson/auto_zones.geojson',
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
// Parkings publics gratuits, bbox BAB (sud, ouest, nord, est)
const OVERPASS_QUERY =
  '[out:json][timeout:60];(nwr["amenity"="parking"]["fee"="no"]["access"!="private"](43.42,-1.60,43.54,-1.42););out center;';

// Rues où l'on peut a priori se garer : résidentielles et petites rues, en excluant
// le piéton, le privé et l'interdit aux véhicules. Les sens interdits ne changent rien
// au stationnement (c'est l'app de navigation qui les gère pour y aller).
const OVERPASS_STREETS_QUERY =
  '[out:json][timeout:90];(' +
  'way["highway"~"^(residential|unclassified|living_street)$"]' +
  '["area"!="yes"]["access"!~"^(private|no)$"]["motor_vehicle"!~"^(private|no)$"]' +
  '(43.42,-1.60,43.54,-1.42);' +
  ');out geom;';

/** Télécharge une source avec fallback sur le cache data/raw/. */
async function loadSource(key, url) {
  const cachePath = join(RAW, `${key}.geojson`);
  if (!OFFLINE) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.features) throw new Error('pas un FeatureCollection');
      mkdirSync(RAW, { recursive: true });
      writeFileSync(cachePath, JSON.stringify(data));
      console.log(`✓ ${key} : ${data.features.length} features (téléchargé)`);
      return data;
    } catch (err) {
      console.warn(`⚠ ${key} : téléchargement échoué (${err.message}), essai cache…`);
    }
  }
  if (existsSync(cachePath)) {
    const data = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log(`✓ ${key} : ${data.features.length} features (cache)`);
    return data;
  }
  throw new Error(`${key} : ni téléchargement ni cache disponible`);
}

/** Requête Overpass générique avec fallback miroirs + cache. */
async function overpass(query, cacheKey) {
  const cachePath = join(RAW, `${cacheKey}.json`);
  if (!OFFLINE) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'FreeParkBAB/1.0 (prototype open data; contact: l.birdie75@gmail.com)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        mkdirSync(RAW, { recursive: true });
        writeFileSync(cachePath, JSON.stringify(data));
        console.log(`✓ OSM ${cacheKey} : ${data.elements.length} éléments (${new URL(endpoint).host})`);
        return data.elements;
      } catch (err) {
        console.warn(`⚠ Overpass ${new URL(endpoint).host} (${cacheKey}) : ${err.message}`);
      }
    }
  }
  if (existsSync(cachePath)) {
    const data = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log(`✓ OSM ${cacheKey} : ${data.elements.length} éléments (cache)`);
    return data.elements;
  }
  console.warn(`⚠ OSM ${cacheKey} : indisponible (ni réseau ni cache)`);
  return [];
}

/** Parkings gratuits OSM via Overpass (facultatif : renvoie [] si tout échoue). */
async function loadOsmParkings() {
  const cachePath = join(RAW, 'osm_parkings.json');
  if (!OFFLINE) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'FreeParkBAB/1.0 (prototype open data; contact: l.birdie75@gmail.com)',
          },
          body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
          signal: AbortSignal.timeout(90_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        mkdirSync(RAW, { recursive: true });
        writeFileSync(cachePath, JSON.stringify(data));
        console.log(`✓ OSM : ${data.elements.length} parkings gratuits (${new URL(endpoint).host})`);
        return data.elements;
      } catch (err) {
        console.warn(`⚠ Overpass ${new URL(endpoint).host} : ${err.message}`);
      }
    }
  }
  if (existsSync(cachePath)) {
    const data = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log(`✓ OSM : ${data.elements.length} parkings gratuits (cache)`);
    return data.elements;
  }
  console.warn('⚠ OSM : aucun parking gratuit disponible (ni réseau ni cache)');
  return [];
}

/** Arrondit les coordonnées à 6 décimales (~11 cm) — les sources en ont 10. */
function roundCoords(value) {
  if (typeof value === 'number') return Math.round(value * 1e6) / 1e6;
  if (Array.isArray(value)) return value.map(roundCoords);
  return value;
}

const haversine = (a, b) => {
  const R = 6_371_000;
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b[1] - a[1]) / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Espacement des points candidats le long des rues (m). */
const STREET_SAMPLE_M = 100;
/** Cellule de grille ~1,1 km pour filtrer les rues proches des zones réglementées. */
const GRID = 0.01;

const cellKey = (lon, lat) => `${Math.round(lon / GRID)}:${Math.round(lat / GRID)}`;

/**
 * Échantillonne des points stationnables le long des rues OSM, en ne gardant que
 * ceux à ~1 km d'une zone réglementée (ailleurs, tout est gratuit de toute façon).
 */
function sampleStreets(streetWays, regulatedFeatures) {
  const nearCells = new Set();
  for (const f of regulatedFeatures) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys)
      for (const [lon, lat] of poly[0]) {
        const cx = Math.round(lon / GRID);
        const cy = Math.round(lat / GRID);
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++) nearCells.add(`${cx + dx}:${cy + dy}`);
      }
  }

  const points = [];
  for (const way of streetWays) {
    if (!way.geometry || way.geometry.length < 2) continue;
    const name = way.tags?.name ?? 'Petite rue';
    let acc = Infinity; // force un point au premier nœud
    let prev = null;
    for (const node of way.geometry) {
      const cur = [node.lon, node.lat];
      if (prev) acc += haversine(prev, cur);
      prev = cur;
      if (acc < STREET_SAMPLE_M) continue;
      acc = 0;
      if (!nearCells.has(cellKey(cur[0], cur[1]))) continue;
      points.push({ coords: cur, name });
    }
  }
  return points;
}

const feature = (geometry, props) => ({
  type: 'Feature',
  geometry: { ...geometry, coordinates: roundCoords(geometry.coordinates) },
  properties: props,
});

function normalize({ biarritzPayant, biarritzBleue, anglet, bayonne, osmParkings, osmStreets }) {
  const features = [];
  let seq = 0;
  const nid = (prefix) => `${prefix}-${seq++}`;

  for (const f of biarritzPayant.features) {
    const zone = f.properties.zone_tarifaire; // Rouge | Orange | Verte | Jaune
    const sched = SCHEDULES.biarritz[zone];
    if (!sched) {
      console.warn(`⚠ Biarritz : zone tarifaire inconnue "${zone}", ignorée`);
      continue;
    }
    features.push(
      feature(f.geometry, {
        id: nid('bia'),
        commune: 'Biarritz',
        name: `Zone ${zone.toLowerCase()} · Biarritz`,
        kind: 'paid',
        zoneColor: zone,
        schedule: sched.rules,
        tariffNote: sched.tariffNote,
        source: 'data.biarritz.fr',
      }),
    );
  }

  for (const f of biarritzBleue.features) {
    const sched = SCHEDULES.biarritz.Bleue;
    features.push(
      feature(f.geometry, {
        id: nid('bia-bleu'),
        commune: 'Biarritz',
        name: 'Zone bleue · Biarritz',
        kind: 'blue',
        zoneColor: 'Bleue',
        schedule: sched.rules,
        tariffNote: sched.tariffNote,
        source: 'data.biarritz.fr',
      }),
    );
  }

  for (const f of anglet.features) {
    const type = f.properties.type; // courte / longue durée
    const sched = SCHEDULES.anglet[type];
    if (!sched) {
      console.warn(`⚠ Anglet : type inconnu "${type}", ignoré`);
      continue;
    }
    features.push(
      feature(f.geometry, {
        id: nid('ang'),
        commune: 'Anglet',
        name: `Littoral ${type === 'Stationnement courte durée' ? 'courte durée' : 'longue durée'} · Anglet`,
        kind: 'paid',
        zoneColor: f.properties.couleur_ ?? 'Rouge',
        schedule: sched.rules,
        tariffNote: sched.tariffNote,
        source: 'anglet-opendatapaysbasque.opendatasoft.com',
      }),
    );
  }

  for (const f of bayonne.features) {
    const sched = SCHEDULES.bayonne.default;
    features.push(
      feature(f.geometry, {
        id: nid('bay'),
        commune: 'Bayonne',
        name: `${f.properties.nom} · Bayonne`,
        kind: 'paid',
        zoneColor: 'Rouge',
        schedule: sched.rules,
        tariffNote: sched.tariffNote,
        source: 'bayonne.fr (data.gouv.fr)',
      }),
    );
  }

  for (const el of osmParkings) {
    const lat = el.center?.lat ?? el.lat;
    const lon = el.center?.lon ?? el.lon;
    if (lat == null || lon == null) continue;
    // On ne garde que les parkings en surface ou non précisés (pas les souterrains privés etc.)
    const parkingType = el.tags?.parking;
    if (parkingType && !['surface', 'street_side', 'lane'].includes(parkingType)) continue;
    features.push(
      feature(
        { type: 'Point', coordinates: [lon, lat] },
        {
          id: nid('osm'),
          commune: '',
          name: el.tags?.name || 'Parking gratuit',
          kind: 'free-parking',
          zoneColor: 'Verte',
          schedule: [],
          tariffNote: 'Parking gratuit (source OpenStreetMap)',
          source: `openstreetmap.org (${el.type}/${el.id})`,
          capacity: el.tags?.capacity ?? null,
        },
      ),
    );
  }

  // Points stationnables le long des vraies rues (uniquement près des zones réglementées)
  const regulated = features.filter((f) => f.properties.kind !== 'free-parking');
  for (const p of sampleStreets(osmStreets, regulated)) {
    features.push(
      feature(
        { type: 'Point', coordinates: p.coords },
        // Propriétés minimales : ces points sont ~90 % du fichier
        { id: nid('st'), name: p.name, kind: 'street' },
      ),
    );
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Nomme les parkings anonymes par leur rue via le géocodage inverse EN LOT de la BAN
 * (une seule requête CSV pour tous) : « Parking gratuit » → « Parking · Avenue de Verdun ».
 */
async function nameParkings(features) {
  const anonymous = features.filter(
    (f) => f.properties.kind === 'free-parking' && f.properties.name === 'Parking gratuit',
  );
  if (anonymous.length === 0 || OFFLINE) return;
  const csv =
    'lon,lat\n' +
    anonymous.map((f) => f.geometry.coordinates.join(',')).join('\n');
  try {
    const form = new FormData();
    form.append('data', new Blob([csv], { type: 'text/csv' }), 'parkings.csv');
    form.append('columns', 'lon');
    form.append('columns', 'lat');
    const res = await fetch('https://api-adresse.data.gouv.fr/reverse/csv/', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const lines = (await res.text()).split('\n');
    const header = lines[0].split(',');
    const iStreet = header.indexOf('result_street');
    const iName = header.indexOf('result_name');
    const iCity = header.indexOf('result_city');
    let named = 0;
    // Les lignes sont renvoyées dans l'ordre d'envoi
    anonymous.forEach((f, i) => {
      const cols = lines[i + 1]?.split(',');
      if (!cols) return;
      const street = cols[iStreet] || cols[iName];
      if (street) {
        f.properties.name = `Parking · ${street}`;
        named++;
      }
      if (cols[iCity]) f.properties.commune = cols[iCity];
    });
    console.log(`✓ BAN reverse : ${named}/${anonymous.length} parkings nommés par leur rue`);
  } catch (err) {
    console.warn(`⚠ BAN reverse : ${err.message} (les parkings gardent leur nom générique)`);
  }
}

const [biarritzPayant, biarritzBleue, anglet, bayonne, osmParkings, osmStreets] = await Promise.all([
  loadSource('biarritz_payant', SOURCES.biarritz_payant),
  loadSource('biarritz_bleue', SOURCES.biarritz_bleue),
  loadSource('anglet_littoral', SOURCES.anglet_littoral),
  loadSource('bayonne_zones', SOURCES.bayonne_zones),
  loadOsmParkings(),
  overpass(OVERPASS_STREETS_QUERY, 'osm_streets'),
]);

const out = normalize({ biarritzPayant, biarritzBleue, anglet, bayonne, osmParkings, osmStreets });
await nameParkings(out.features);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
const counts = out.features.reduce((acc, f) => ((acc[f.properties.kind] = (acc[f.properties.kind] ?? 0) + 1), acc), {});
console.log(`\n→ ${OUT}`);
console.log(`  ${out.features.length} zones :`, counts);
