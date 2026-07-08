/** Autocomplétion d'adresse via l'API Adresse de l'État (BAN) — gratuite, sans clé. */

export interface AddressHit {
  label: string;
  /** Contexte court, ex. « Biarritz » */
  city: string;
  /** [lon, lat] */
  coords: [number, number];
}

/** Centre approximatif du BAB pour biaiser les résultats. */
const BAB_CENTER = { lat: 43.48, lon: -1.52 };

export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const url = new URL('https://api-adresse.data.gouv.fr/search/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lat', String(BAB_CENTER.lat));
  url.searchParams.set('lon', String(BAB_CENTER.lon));

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Géocodage indisponible (HTTP ${res.status})`);
  const data = await res.json();

  return (data.features ?? []).map(
    (f: {
      properties: { label: string; city?: string; context?: string };
      geometry: { coordinates: [number, number] };
    }) => ({
      label: f.properties.label,
      city: f.properties.city ?? f.properties.context ?? '',
      coords: f.geometry.coordinates,
    }),
  );
}
