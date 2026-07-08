import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { zoneStatusAt } from './schedule';
import { haversineMeters, walkMeters, walkMinutes } from './geo';
import type {
  Suggestion,
  SuggestionFilters,
  ZoneCollection,
  ZoneFeature,
  ZoneStatus,
} from './types';

/** Rayon de recherche des candidats autour de la destination (m, vol d'oiseau). */
const SEARCH_RADIUS_M = 1_500;
/** Rayon dans lequel on considère les polygones pour l'échantillonnage de bords (m). */
const EDGE_ZONE_RADIUS_M = 1_200;
/** Espacement minimal entre deux suggestions retenues (m). */
const MIN_SEPARATION_M = 150;
/** Nombre max de suggestions. */
const MAX_SUGGESTIONS = 5;

export const DEFAULT_FILTERS: SuggestionFilters = {
  freeNowOnly: false,
  maxWalkMinutes: null,
  avoidBlue: false,
};

const isPolygonal = (f: ZoneFeature): boolean =>
  f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon';

/** Anneaux extérieurs d'un polygone / multipolygone. */
function outerRings(f: ZoneFeature): [number, number][][] {
  if (f.geometry.type === 'Polygon') return [f.geometry.coordinates[0] as [number, number][]];
  if (f.geometry.type === 'MultiPolygon')
    return f.geometry.coordinates.map((poly) => poly[0] as [number, number][]);
  return [];
}

function pointInZone(
  coords: [number, number],
  zone: ZoneFeature,
  opts: { ignoreBoundary?: boolean } = {},
): boolean {
  if (!isPolygonal(zone)) return false;
  return booleanPointInPolygon(point(coords), zone as GeoJSON.Feature<GeoJSON.Polygon>, opts);
}

/** Distance min (m) entre un point et les sommets des anneaux d'une zone. */
function distanceToZone(coords: [number, number], zone: ZoneFeature): number {
  let min = Infinity;
  for (const ring of outerRings(zone)) {
    for (const vertex of ring) {
      const d = haversineMeters(coords, vertex as [number, number]);
      if (d < min) min = d;
    }
  }
  return min;
}

/** Au-delà de cette distance, l'adresse est considérée hors contexte réglementé (m). */
const NEARBY_ZONE_RADIUS_M = 150;

/**
 * Contexte réglementaire de la destination.
 * Les polygones open data épousent les rues : une adresse (bâtiment, place) tombe
 * souvent ENTRE les polygones — d'où le fallback « zone la plus proche » qui permet
 * de garder l'avertissement « payant à partir de 9h » au cœur d'un quartier payant.
 */
export function destinationContext(
  dest: [number, number],
  zones: ZoneCollection,
  when: Date,
): { zone: ZoneFeature; status: ZoneStatus; nearby: boolean } | null {
  const regulated = (zones.features as ZoneFeature[]).filter(
    (z) => z.properties.kind !== 'free-parking' && isPolygonal(z),
  );

  for (const zone of regulated) {
    if (pointInZone(dest, zone)) return { zone, status: zoneStatusAt(zone, when), nearby: false };
  }

  let closest: { zone: ZoneFeature; d: number } | null = null;
  for (const zone of regulated) {
    const d = distanceToZone(dest, zone);
    if (d <= NEARBY_ZONE_RADIUS_M && (!closest || d < closest.d)) closest = { zone, d };
  }
  if (closest)
    return { zone: closest.zone, status: zoneStatusAt(closest.zone, when), nearby: true };
  return null;
}

interface Candidate {
  suggestion: Suggestion;
  distance: number;
}

function makeSuggestion(
  id: string,
  name: string,
  commune: string,
  coords: [number, number],
  dest: [number, number],
  status: ZoneStatus,
  kind: Suggestion['kind'],
  tariffNote: string,
): Candidate {
  const meters = walkMeters(dest, coords);
  return {
    distance: haversineMeters(dest, coords),
    suggestion: {
      id,
      name,
      commune,
      coords,
      walkMeters: Math.round(meters),
      walkMinutes: walkMinutes(meters),
      status,
      kind,
      tariffNote,
    },
  };
}

/**
 * Suggestions de stationnement classées par temps de marche :
 *  1. parkings gratuits OSM proches ;
 *  2. points « bord de zone » : sommets des polygones réglementés actifs qui ne tombent
 *     dans aucune autre zone active (= la rue d'en face est gratuite) ;
 *  3. bords de zones bleues actives (gratuit avec disque), sauf filtre contraire.
 */
export function buildSuggestions(
  dest: [number, number],
  zones: ZoneCollection,
  when: Date,
  filters: SuggestionFilters = DEFAULT_FILTERS,
): Suggestion[] {
  const features = zones.features as ZoneFeature[];
  const candidates: Candidate[] = [];

  const activePolygons = features.filter(
    (f) =>
      f.properties.kind !== 'free-parking' &&
      isPolygonal(f) &&
      zoneStatusAt(f, when).state !== 'free',
  );
  // ignoreBoundary : un sommet du polygone est SUR sa frontière, c'est-à-dire à la
  // limite de la zone — c'est précisément là que la rue d'en face devient gratuite.
  const inAnyActiveZone = (coords: [number, number]): boolean =>
    activePolygons.some((z) => pointInZone(coords, z, { ignoreBoundary: true }));

  // 1. Parkings gratuits OSM
  for (const f of features) {
    if (f.properties.kind !== 'free-parking' || f.geometry.type !== 'Point') continue;
    const coords = f.geometry.coordinates as [number, number];
    if (haversineMeters(dest, coords) > SEARCH_RADIUS_M) continue;
    candidates.push(
      makeSuggestion(
        f.properties.id,
        f.properties.name,
        f.properties.commune ?? '',
        coords,
        dest,
        zoneStatusAt(f, when),
        'parking',
        f.properties.tariffNote ?? '',
      ),
    );
  }

  // 2. Rues stationnables (points OSM nommés) hors zone réglementée active.
  // Une rue DANS une zone inactive au moment choisi hérite du statut de la zone
  // (→ « Gratuit maintenant · payant demain à 9h »).
  const regulatedPolygons = features.filter(
    (f) => (f.properties.kind === 'paid' || f.properties.kind === 'blue') && isPolygonal(f),
  );
  let nearbyStreetCount = 0;
  for (const f of features) {
    if (f.properties.kind !== 'street' || f.geometry.type !== 'Point') continue;
    const coords = f.geometry.coordinates as [number, number];
    if (haversineMeters(dest, coords) > SEARCH_RADIUS_M) continue;
    const container = regulatedPolygons.find((z) =>
      pointInZone(coords, z, { ignoreBoundary: true }),
    );
    const status = container
      ? zoneStatusAt(container, when)
      : ({
          state: 'free',
          activeUntil: null,
          nextActiveStart: null,
          label: 'Gratuit',
          sublabel: 'rue non réglementée',
        } as ZoneStatus);
    if (status.state !== 'free') continue;
    nearbyStreetCount++;
    candidates.push(
      makeSuggestion(
        f.properties.id,
        f.properties.name,
        container?.properties.commune ?? '',
        coords,
        dest,
        status,
        'street',
        container?.properties.tariffNote ?? 'Vérifiez la signalisation sur place.',
      ),
    );
  }

  // 3. Bords de zones réglementées actives — secours si peu de rues OSM dans le coin,
  //    + zones bleues (on se gare DEDANS avec disque, donc toujours proposées)
  for (const zone of activePolygons) {
    const status = zoneStatusAt(zone, when);
    const isBlue = status.state === 'blue';
    if (isBlue && filters.avoidBlue) continue;
    // Les rues nommées couvrent déjà les abords des zones payantes : les sommets de
    // polygones ne servent que là où OSM est pauvre
    if (!isBlue && nearbyStreetCount >= 2) continue;

    for (const ring of outerRings(zone)) {
      // Échantillonne ~1 sommet sur N pour rester sous ~40 points par anneau
      const step = Math.max(1, Math.floor(ring.length / 40));
      let best: { coords: [number, number]; d: number } | null = null;
      for (let i = 0; i < ring.length; i += step) {
        const coords = ring[i] as [number, number];
        const d = haversineMeters(dest, coords);
        if (d > EDGE_ZONE_RADIUS_M) continue;
        if (isBlue) {
          // Zone bleue : on se gare DANS la zone (avec disque) → le bord suffit
          if (!best || d < best.d) best = { coords, d };
        } else {
          // Zone payante : le point doit être hors de toute zone active
          if (inAnyActiveZone(coords)) continue;
          if (!best || d < best.d) best = { coords, d };
        }
      }
      if (best) {
        candidates.push(
          isBlue
            ? makeSuggestion(
                `${zone.properties.id}-blue-edge`,
                `${zone.properties.name} (disque)`,
                zone.properties.commune ?? '',
                best.coords,
                dest,
                status,
                'blue-zone',
                zone.properties.tariffNote ?? '',
              )
            : makeSuggestion(
                `${zone.properties.id}-edge`,
                `Rue gratuite · limite zone ${(zone.properties.zoneColor ?? '').toLowerCase()}`,
                zone.properties.commune ?? '',
                best.coords,
                dest,
                {
                  state: 'free',
                  activeUntil: null,
                  nextActiveStart: null,
                  label: 'Gratuit',
                  sublabel: 'juste après la limite de zone payante',
                },
                'street-edge',
                'Rue hors zone payante — vérifier la signalisation sur place.',
              ),
        );
      }
    }
  }

  // Filtres + tri + espacement minimal
  let filtered = candidates;
  if (filters.freeNowOnly) filtered = filtered.filter((c) => c.suggestion.status.state === 'free');
  if (filters.avoidBlue) filtered = filtered.filter((c) => c.suggestion.kind !== 'blue-zone');
  if (filters.maxWalkMinutes != null)
    filtered = filtered.filter((c) => c.suggestion.walkMinutes <= filters.maxWalkMinutes!);

  filtered.sort((a, b) => a.distance - b.distance);

  const kept: Candidate[] = [];
  for (const c of filtered) {
    if (kept.length >= MAX_SUGGESTIONS) break;
    const tooClose = kept.some(
      (k) => haversineMeters(k.suggestion.coords, c.suggestion.coords) < MIN_SEPARATION_M,
    );
    if (!tooClose) kept.push(c);
  }

  return kept.map((c) => c.suggestion);
}
