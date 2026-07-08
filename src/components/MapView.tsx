import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { zoneStatusAt } from '../lib/schedule';
import type { Suggestion, ZoneCollection, ZoneFeature } from '../lib/types';
import './MapView.css';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
/** Vue initiale : centre du BAB */
const INITIAL = { center: [-1.52, 43.48] as [number, number], zoom: 12 };

interface MapViewProps {
  zones: ZoneCollection | null;
  when: Date;
  destination: [number, number] | null;
  suggestions: Suggestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMapReady?: (map: MLMap) => void;
}

/** Applique l'état horaire de chaque zone en feature-state (pilote les couleurs). */
function applyStatuses(map: MLMap, zones: ZoneCollection, when: Date) {
  for (const f of zones.features as ZoneFeature[]) {
    if (f.properties.kind !== 'paid' && f.properties.kind !== 'blue') continue;
    const status = zoneStatusAt(f, when);
    map.setFeatureState({ source: 'zones', id: f.properties.id }, { state: status.state });
  }
}

export function MapView({
  zones,
  when,
  destination,
  suggestions,
  selectedId,
  onSelect,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const loadedRef = useRef(false);
  const destMarkerRef = useRef<Marker | null>(null);
  const suggestionMarkersRef = useRef<Marker[]>([]);

  // Init carte (une seule fois)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL.center,
      zoom: INITIAL.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // Suivi GPS continu façon Waze : point bleu + cap + recentrage, pensé conduite.
    // maximumAge 15 s = position quasi instantanée si l'OS en a une récente.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
    });
    map.addControl(geolocate, 'bottom-right');

    map.on('load', () => {
      loadedRef.current = true;
      onMapReady?.(map);
    });
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Source + couches de zones
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zones) return;

    const setup = () => {
      if (map.getSource('zones')) return;
      map.addSource('zones', { type: 'geojson', data: zones, promoteId: 'id' });

      const stateColor = (paid: string, blue: string, free: string) =>
        [
          'match',
          ['coalesce', ['feature-state', 'state'], 'free'],
          'paid',
          paid,
          'blue',
          blue,
          free,
        ] as maplibregl.ExpressionSpecification;

      const regulatedFilter = [
        'in',
        ['get', 'kind'],
        ['literal', ['paid', 'blue']],
      ] as maplibregl.ExpressionSpecification;

      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones',
        filter: regulatedFilter,
        paint: {
          'fill-color': stateColor('#c94f38', '#4a7fc0', '#3d9970'),
          'fill-opacity': [
            'match',
            ['coalesce', ['feature-state', 'state'], 'free'],
            'free',
            0.1,
            0.28,
          ] as maplibregl.ExpressionSpecification,
        },
      });
      map.addLayer({
        id: 'zones-line',
        type: 'line',
        source: 'zones',
        filter: regulatedFilter,
        paint: {
          'line-color': stateColor('#b03a24', '#3a6ba8', '#2f8560'),
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 16, 1.8],
          'line-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'parkings',
        type: 'circle',
        source: 'zones',
        filter: ['==', ['get', 'kind'], 'free-parking'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 15, 6, 17, 9],
          'circle-color': '#2f8560',
          'circle-stroke-color': '#f7f5ef',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      });

      applyStatuses(map, zones, when);
    };

    if (loadedRef.current) setup();
    else map.once('load', setup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  // Recalcule les couleurs quand le moment choisi change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zones || !map.getSource('zones')) return;
    applyStatuses(map, zones, when);
  }, [zones, when]);

  // Marqueur destination
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
    if (!destination) return;

    const el = document.createElement('div');
    el.className = 'dest-marker';
    el.innerHTML = '<div class="dest-marker__pin"></div><div class="dest-marker__dot"></div>';
    destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(destination)
      .addTo(map);
  }, [destination]);

  // Marqueurs de suggestions (numérotés)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    suggestionMarkersRef.current.forEach((m) => m.remove());
    suggestionMarkersRef.current = [];

    suggestions.forEach((s, i) => {
      const el = document.createElement('button');
      el.className = `sugg-marker sugg-marker--${s.status.state}${
        s.id === selectedId ? ' sugg-marker--selected' : ''
      }`;
      el.textContent = String(i + 1);
      el.setAttribute('aria-label', `Suggestion ${i + 1} : ${s.name}`);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(s.id);
      });
      suggestionMarkersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(s.coords).addTo(map),
      );
    });
  }, [suggestions, selectedId, onSelect]);

  // Cadrage : destination + suggestions
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !destination) return;
    if (suggestions.length === 0) {
      map.easeTo({ center: destination, zoom: 15.2, duration: 700 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds(destination, destination);
    suggestions.forEach((s) => bounds.extend(s.coords));
    map.fitBounds(bounds, {
      padding: { top: 130, bottom: 320, left: 48, right: 48 },
      maxZoom: 16,
      duration: 700,
    });
  }, [destination, suggestions]);

  return <div ref={containerRef} className="map-view" />;
}
