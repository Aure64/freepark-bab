import { useCallback, useEffect, useMemo, useState } from 'react';
import '@fontsource-variable/bricolage-grotesque';
import { MapView } from './components/MapView';
import { SearchBar } from './components/SearchBar';
import { SuggestionsSheet } from './components/SuggestionsSheet';
import { TimeSelector } from './components/TimeSelector';
import { loadFavorites, saveFavorites, type Favorite } from './lib/favorites';
import { buildSuggestions, destinationContext, DEFAULT_FILTERS } from './lib/suggest';
import type { AddressHit } from './lib/geocode';
import type { SuggestionFilters } from './lib/types';
import { useZones } from './hooks/useZones';
import './App.css';

interface Destination {
  label: string;
  coords: [number, number];
}

export default function App() {
  const zonesState = useZones();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [when, setWhen] = useState<Date | null>(null); // null = maintenant
  const [filters, setFilters] = useState<SuggestionFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>(loadFavorites);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // « Maintenant » vivant : re-tick chaque minute pour que les badges restent justes
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const effectiveWhen = when ?? nowTick;

  const zones = zonesState.status === 'ready' ? zonesState.zones : null;

  const destContext = useMemo(() => {
    if (!zones || !destination) return null;
    return destinationContext(destination.coords, zones, effectiveWhen);
  }, [zones, destination, effectiveWhen]);

  const suggestions = useMemo(() => {
    if (!zones || !destination) return [];
    return buildSuggestions(destination.coords, zones, effectiveWhen, filters);
  }, [zones, destination, effectiveWhen, filters]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (zonesState.status === 'error') showToast(zonesState.message);
  }, [zonesState, showToast]);

  const handlePick = useCallback((hit: AddressHit) => {
    setDestination({ label: hit.label, coords: hit.coords });
    setSelectedId(null);
  }, []);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Géolocalisation non disponible sur cet appareil.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setDestination({
          label: 'Ma position',
          coords: [pos.coords.longitude, pos.coords.latitude],
        });
        setSelectedId(null);
      },
      () => {
        setLocating(false);
        showToast('Position refusée ou introuvable — cherchez une adresse.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [showToast]);

  const isFavorite = useMemo(
    () =>
      destination !== null &&
      favorites.some(
        (f) => f.coords[0] === destination.coords[0] && f.coords[1] === destination.coords[1],
      ),
    [favorites, destination],
  );

  const toggleFavorite = useCallback(() => {
    if (!destination) return;
    setFavorites((prev) => {
      const next = isFavorite
        ? prev.filter(
            (f) => f.coords[0] !== destination.coords[0] || f.coords[1] !== destination.coords[1],
          )
        : [
            ...prev,
            {
              id: `fav-${destination.coords.join(',')}`,
              label: destination.label.split(',')[0],
              address: destination.label,
              coords: destination.coords,
            },
          ];
      saveFavorites(next);
      return next;
    });
  }, [destination, isFavorite]);

  return (
    <div className="app">
      <MapView
        zones={zones}
        when={effectiveWhen}
        destination={destination?.coords ?? null}
        suggestions={suggestions}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <SearchBar
        favorites={favorites}
        onPick={handlePick}
        onLocate={handleLocate}
        locating={locating}
      />

      <TimeSelector when={when} onChange={setWhen} />

      <SuggestionsSheet
        destinationLabel={destination?.label ?? null}
        destinationStatus={destContext?.status ?? null}
        destinationNearby={destContext?.nearby ?? false}
        suggestions={suggestions}
        filters={filters}
        onFiltersChange={setFilters}
        selectedId={selectedId}
        onSelect={setSelectedId}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        computing={zonesState.status === 'loading' && destination !== null}
      />

      {toast && (
        <div className="toast" role="alert">
          {toast}
        </div>
      )}
    </div>
  );
}
