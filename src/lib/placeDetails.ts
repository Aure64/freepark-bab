/** Détails d'un lieu à la volée : adresse la plus proche (BAN) + photo (Panoramax). */

export interface PlaceDetails {
  /** Rue la plus proche, ex. « Avenue de Verdun » */
  street: string | null;
  city: string | null;
  /** Vignette Panoramax (street view open source, licence ouverte) */
  photoUrl: string | null;
  /** Photo haute définition (page de la photo) */
  photoHdUrl: string | null;
}

export async function fetchPlaceDetails(
  coords: [number, number],
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  const [lon, lat] = coords;

  const reverse = fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}`, {
    signal,
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const props = data?.features?.[0]?.properties;
      return { street: props?.street ?? props?.name ?? null, city: props?.city ?? null };
    })
    .catch(() => ({ street: null, city: null }));

  const photo = fetch(
    `https://api.panoramax.xyz/api/search?place_position=${lon},${lat}&place_distance=0-60&limit=1`,
    { signal },
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const assets = data?.features?.[0]?.assets;
      return {
        photoUrl: assets?.thumb?.href ?? null,
        photoHdUrl: assets?.sd?.href ?? assets?.hd?.href ?? null,
      };
    })
    .catch(() => ({ photoUrl: null, photoHdUrl: null }));

  const [addr, pic] = await Promise.all([reverse, photo]);
  return { ...addr, ...pic };
}
