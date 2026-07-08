import { useEffect, useState } from 'react';
import type { ZoneCollection } from '../lib/types';

type ZonesState =
  | { status: 'loading' }
  | { status: 'ready'; zones: ZoneCollection }
  | { status: 'error'; message: string };

/** Charge le GeoJSON de zones embarqué (généré par scripts/build-data.mjs). */
export function useZones(): ZonesState {
  const [state, setState] = useState<ZonesState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // index.html lance le fetch dès le parsing du HTML ; on le récupère si présent
    const preloaded = (window as { __zonesPromise?: Promise<ZoneCollection> }).__zonesPromise;
    (
      preloaded ??
      fetch(`${import.meta.env.BASE_URL}data/zones.geojson`).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
    )
      .then((zones: ZoneCollection) => {
        if (!cancelled) setState({ status: 'ready', zones });
      })
      .catch((err: Error) => {
        if (!cancelled)
          setState({
            status: 'error',
            message: `Impossible de charger les zones de stationnement (${err.message}).`,
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
