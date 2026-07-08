/** Enchaînement vers l'app de navigation : FreePark choisit le spot, Waze/Maps conduit. */

export type NavApp = 'waze' | 'google' | 'apple';

export const NAV_APPS: { id: NavApp; label: string }[] = [
  { id: 'waze', label: 'Waze' },
  { id: 'google', label: 'Google Maps' },
  { id: 'apple', label: 'Plans' },
];

/** Itinéraire VOITURE vers le spot de stationnement [lon, lat]. */
export function drivingUrl(app: NavApp, coords: [number, number]): string {
  const [lon, lat] = coords;
  switch (app) {
    case 'waze':
      return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  }
}

const KEY = 'freepark.navapp.v1';

export function loadNavPref(): NavApp | null {
  const raw = localStorage.getItem(KEY);
  return raw === 'waze' || raw === 'google' || raw === 'apple' ? raw : null;
}

export function saveNavPref(app: NavApp): void {
  localStorage.setItem(KEY, app);
}
