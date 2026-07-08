/** Favoris (maison, restos, plages…) en localStorage. */

export interface Favorite {
  id: string;
  label: string;
  /** Adresse complète affichée en sous-titre */
  address: string;
  /** [lon, lat] */
  coords: [number, number];
}

const KEY = 'freepark.favorites.v1';

export function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Favorite[]) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: Favorite[]): void {
  localStorage.setItem(KEY, JSON.stringify(favorites));
}
