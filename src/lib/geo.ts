/** Distance haversine en mètres entre deux points [lon, lat]. */
export function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Facteur de détour voirie appliqué au vol d'oiseau. */
const DETOUR_FACTOR = 1.3;
/** Vitesse de marche : 4,5 km/h = 75 m/min. */
const WALK_METERS_PER_MINUTE = 75;

/** Distance de marche estimée (mètres, avec détour). */
export const walkMeters = (a: [number, number], b: [number, number]): number =>
  haversineMeters(a, b) * DETOUR_FACTOR;

/** Temps de marche estimé en minutes (arrondi sup, min 1). */
export const walkMinutes = (meters: number): number =>
  Math.max(1, Math.round(meters / WALK_METERS_PER_MINUTE));
