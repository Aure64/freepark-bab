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
  /** [lon, lat] */
  coords: [number, number];
  kind: 'address' | 'poi';
  /** Emoji d'illustration pour les POI */
  icon?: string;
}

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

/** Recherche fusionnée : lieux nommés d'abord, adresses ensuite, max 6 résultats. */
export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const [pois, addresses] = await Promise.all([
    searchPhoton(query, signal).catch(() => [] as AddressHit[]),
    searchBan(query, signal).catch(() => [] as AddressHit[]),
  ]);
  if (pois.length === 0 && addresses.length === 0)
    throw new Error('Recherche indisponible');

  // Dédoublonne les quasi-doublons (même libellé ou < ~30 m)
  const merged: AddressHit[] = [];
  for (const hit of [...pois, ...addresses]) {
    const dup = merged.some(
      (m) =>
        m.label.toLowerCase() === hit.label.toLowerCase() ||
        (Math.abs(m.coords[0] - hit.coords[0]) < 0.0003 &&
          Math.abs(m.coords[1] - hit.coords[1]) < 0.0003),
    );
    if (!dup) merged.push(hit);
    if (merged.length >= 6) break;
  }
  return merged;
}
