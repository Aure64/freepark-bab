/**
 * Autocomplétion de destination :
 *  - adresses via l'API Adresse de l'État (BAN) — la référence pour les adresses FR ;
 *  - lieux (restaurants, bars, plages, hôtels…) via Photon (géocodeur OpenStreetMap,
 *    gratuit, sans clé).
 */

export interface AddressHit {
  label: string;
  /** Contexte : rue, ville, type de lieu */
  city: string;
  /** [lon, lat] — null pour un résultat Google à résoudre via resolveHit() */
  coords: [number, number] | null;
  kind: 'address' | 'poi';
  /** Emoji d'illustration pour les POI */
  icon?: string;
  /** Place ID Google (résolution des coordonnées à la sélection) */
  placeId?: string;
}

/** Clé Google Places optionnelle : si présente, autocomplétion « comme Google Maps ». */
const GOOGLE_KEY: string | undefined = import.meta.env.VITE_GOOGLE_PLACES_KEY;

/** Centre approximatif du BAB pour biaiser les résultats. */
const BAB_CENTER = { lat: 43.48, lon: -1.52 };
/** Pays basque élargi : filtre des résultats Photon (minLon,minLat,maxLon,maxLat). */
const BBOX = '-1.95,43.2,-1.05,43.75';

const POI_LABELS: Record<string, [string, string]> = {
  restaurant: ['Restaurant', '🍽️'],
  cafe: ['Café', '☕'],
  bar: ['Bar', '🍸'],
  pub: ['Pub', '🍺'],
  fast_food: ['Fast-food', '🍔'],
  ice_cream: ['Glacier', '🍦'],
  bakery: ['Boulangerie', '🥖'],
  hotel: ['Hôtel', '🛏️'],
  guest_house: ['Chambre d’hôtes', '🛏️'],
  camp_site: ['Camping', '⛺'],
  beach: ['Plage', '🏖️'],
  beach_resort: ['Plage', '🏖️'],
  supermarket: ['Supermarché', '🛒'],
  pharmacy: ['Pharmacie', '💊'],
  cinema: ['Cinéma', '🎬'],
  casino: ['Casino', '🎰'],
  nightclub: ['Boîte de nuit', '🎶'],
  attraction: ['Lieu touristique', '📸'],
  museum: ['Musée', '🖼️'],
  stadium: ['Stade', '🏟️'],
  golf_course: ['Golf', '⛳'],
  surf: ['Spot de surf', '🏄'],
  games: ['Jeux', '🎲'],
  toys: ['Jouets', '🧸'],
  clothes: ['Vêtements', '👕'],
  hairdresser: ['Coiffeur', '💈'],
  bank: ['Banque', '🏦'],
  fuel: ['Station-service', '⛽'],
  charging_station: ['Borne de recharge', '🔌'],
};

function poiLabel(osmValue: string | undefined): [string, string] {
  if (!osmValue) return ['Lieu', '📍'];
  return (
    POI_LABELS[osmValue] ?? [
      osmValue.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()),
      '📍',
    ]
  );
}

async function searchBan(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const url = new URL('https://api-adresse.data.gouv.fr/search/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '4');
  url.searchParams.set('lat', String(BAB_CENTER.lat));
  url.searchParams.set('lon', String(BAB_CENTER.lon));
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`BAN HTTP ${res.status}`);
  const data = await res.json();
  return (data.features ?? []).map(
    (f: {
      properties: { label: string; city?: string; context?: string };
      geometry: { coordinates: [number, number] };
    }): AddressHit => ({
      label: f.properties.label,
      city: f.properties.city ?? f.properties.context ?? '',
      coords: f.geometry.coordinates,
      kind: 'address',
    }),
  );
}

async function searchPhoton(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lang', 'fr');
  url.searchParams.set('lat', String(BAB_CENTER.lat));
  url.searchParams.set('lon', String(BAB_CENTER.lon));
  url.searchParams.set('bbox', BBOX);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  const data = await res.json();
  return (data.features ?? [])
    .filter(
      (f: { properties: { name?: string; osm_key?: string } }) =>
        // On ne garde que les vrais lieux nommés — les adresses, la BAN les fait mieux
        f.properties.name && f.properties.osm_key !== 'place' && f.properties.osm_key !== 'highway',
    )
    .map(
      (f: {
        properties: { name: string; osm_value?: string; street?: string; city?: string };
        geometry: { coordinates: [number, number] };
      }): AddressHit => {
        const [typeLabel, icon] = poiLabel(f.properties.osm_value);
        const where = [f.properties.street, f.properties.city].filter(Boolean).join(', ');
        return {
          label: f.properties.name,
          city: [typeLabel, where].filter(Boolean).join(' · '),
          coords: f.geometry.coordinates,
          kind: 'poi',
          icon,
        };
      },
    );
}

/** Autocomplétion Google Places (New) — activée seulement si une clé est configurée. */
async function searchGoogle(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY! },
    body: JSON.stringify({
      input: query,
      languageCode: 'fr',
      regionCode: 'FR',
      locationBias: {
        circle: { center: { latitude: 43.48, longitude: -1.52 }, radius: 30_000 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  interface Prediction {
    placeId: string;
    text?: { text: string };
    structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
  }
  const data: { suggestions?: { placePrediction?: Prediction }[] } = await res.json();
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is Prediction => Boolean(p))
    .map((p) => ({
      label: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      city: p.structuredFormat?.secondaryText?.text ?? '',
      coords: null,
      kind: 'poi' as const,
      icon: '📍',
      placeId: p.placeId,
    }));
}

/** Résout les coordonnées d'un hit (Place Details Google si nécessaire). */
export async function resolveHit(hit: AddressHit): Promise<[number, number]> {
  if (hit.coords) return hit.coords;
  const res = await fetch(`https://places.googleapis.com/v1/places/${hit.placeId}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY!, 'X-Goog-FieldMask': 'location' },
  });
  if (!res.ok) throw new Error(`Google details HTTP ${res.status}`);
  const data = await res.json();
  return [data.location.longitude, data.location.latitude];
}

/** Recherche fusionnée : lieux nommés d'abord, adresses ensuite, max 6 résultats. */
export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  // Avec une clé Google : autocomplétion Google (POI + adresses monde entier),
  // complétée par la BAN (gratuite) pour les adresses françaises.
  // null = la source a échoué ; [] = elle a répondu « aucun résultat » (pas pareil !)
  const [pois, addresses] = await Promise.all([
    GOOGLE_KEY
      ? searchGoogle(query, signal).catch(() => null)
      : searchPhoton(query, signal).catch(() => null),
    searchBan(query, signal).catch(() => null),
  ]);
  // Une requête annulée (nouvelle frappe) ne doit pas s'afficher comme une panne
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  // Panne seulement si LES DEUX sources ont échoué ; zéro résultat = liste vide
  if (pois === null && addresses === null) throw new Error('Recherche indisponible');

  // Dédoublonne les quasi-doublons (même libellé ou < ~30 m)
  const merged: AddressHit[] = [];
  for (const hit of [...(pois ?? []), ...(addresses ?? [])]) {
    const dup = merged.some(
      (m) =>
        m.label.toLowerCase() === hit.label.toLowerCase() ||
        (m.coords !== null &&
          hit.coords !== null &&
          Math.abs(m.coords[0] - hit.coords[0]) < 0.0003 &&
          Math.abs(m.coords[1] - hit.coords[1]) < 0.0003),
    );
    if (!dup) merged.push(hit);
    if (merged.length >= 6) break;
  }
  return merged;
}
