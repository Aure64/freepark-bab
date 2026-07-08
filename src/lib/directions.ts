/** Ouvre l'itinéraire piéton dans l'app de cartes de la plateforme. */

const isApplePlatform = (): boolean =>
  /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

/** URL d'itinéraire piéton vers [lon, lat] (Apple Plans sur iOS, sinon Google Maps). */
export function walkingDirectionsUrl(coords: [number, number]): string {
  const [lon, lat] = coords;
  return isApplePlatform()
    ? `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
}
