import { useEffect, useState } from 'react';
import type { ZoneCollection, ZoneFeature } from '../lib/types';

type ZonesState =
  | { status: 'loading' }
  | { status: 'ready'; zones: ZoneCollection }
  | { status: 'error'; message: string };

/** Format compact des rues généré par le pipeline : [nom, lon, lat]. */
type CompactStreet = [string, number, number];

const streetFeature = ([name, lon, lat]: CompactStreet, i: number): ZoneFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { id: `st-${i}`, name, kind: 'street' },
});

const fetchJson = (path: string) =>
  fetch(`${import.meta.env.BASE_URL}${path}`).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

/**
 * Charge les zones en deux temps : le cœur (zones payantes/bleues, parkings — ce qui
 * peint la carte) tout de suite, puis les ~4 400 points de rues en différé — l'app est
 * utilisable dès le premier fichier, les suggestions s'affinent quand les rues arrivent.
 */
export function useZones(): ZonesState {
  const [state, setState] = useState<ZonesState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // index.html lance ces fetchs dès le parsing du HTML ; on les récupère si présents
    const w = window as {
      __zonesPromise?: Promise<ZoneCollection>;
      __streetsPromise?: Promise<CompactStreet[]>;
    };
    const corePromise = w.__zonesPromise ?? fetchJson('data/zones.geojson');
    const streetsPromise = w.__streetsPromise ?? fetchJson('data/streets.json');

    corePromise
      .then((core: ZoneCollection) => {
        if (cancelled) return;
        setState({ status: 'ready', zones: core });
        // Les rues arrivent quand elles arrivent — jamais bloquant, jamais fatal
        streetsPromise
          .then((streets: CompactStreet[]) => {
            if (cancelled) return;
            setState({
              status: 'ready',
              zones: { ...core, features: [...core.features, ...streets.map(streetFeature)] },
            });
          })
          .catch(() => {});
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
