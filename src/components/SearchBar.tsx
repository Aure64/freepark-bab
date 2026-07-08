import { useEffect, useRef, useState } from 'react';
import { searchAddress, type AddressHit } from '../lib/geocode';
import type { Favorite } from '../lib/favorites';
import './SearchBar.css';

interface SearchBarProps {
  favorites: Favorite[];
  onPick: (hit: AddressHit) => void;
  onLocate: () => void;
  locating: boolean;
}

export function SearchBar({ favorites, onPick, onLocate, locating }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Autocomplétion débouncée
  useEffect(() => {
    setError(null);
    if (query.trim().length < 3) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      searchAddress(query, controller.signal)
        .then(setHits)
        .catch((err: Error) => {
          if (err.name !== 'AbortError') setError('Recherche indisponible — réessayez.');
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Ferme la liste au tap extérieur
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const pick = (hit: AddressHit) => {
    setQuery(hit.label);
    setOpen(false);
    onPick(hit);
  };

  const showFavorites = open && query.trim().length < 3 && favorites.length > 0;
  const showHits = open && hits.length > 0 && query.trim().length >= 3;

  return (
    <div className="search" ref={rootRef}>
      <div className="search__bar">
        <svg className="search__icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          inputMode="search"
          placeholder="Où allez-vous ?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          aria-label="Adresse de destination"
        />
        {query && (
          <button
            className="search__clear"
            aria-label="Effacer"
            onClick={() => {
              setQuery('');
              setHits([]);
            }}
          >
            ✕
          </button>
        )}
        <button
          className={`search__locate${locating ? ' search__locate--busy' : ''}`}
          onClick={onLocate}
          aria-label="Utiliser ma position"
          title="Ma position"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M10 2v2.1A6 6 0 0 1 15.9 10H18v0-0M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      </div>

      {(showFavorites || showHits || error) && (
        <div className="search__panel" role="listbox">
          {error && <p className="search__error">{error}</p>}
          {showFavorites && (
            <>
              <p className="search__panel-title">Favoris</p>
              {favorites.map((f) => (
                <button
                  key={f.id}
                  className="search__row"
                  role="option"
                  aria-selected="false"
                  onClick={() => pick({ label: f.address, city: '', coords: f.coords })}
                >
                  <span className="search__row-star" aria-hidden="true">★</span>
                  <span>
                    <strong>{f.label}</strong>
                    <small>{f.address}</small>
                  </span>
                </button>
              ))}
            </>
          )}
          {showHits &&
            hits.map((h) => (
              <button
                key={`${h.label}${h.coords.join(',')}`}
                className="search__row"
                role="option"
                aria-selected="false"
                onClick={() => pick(h)}
              >
                <span className="search__row-pin" aria-hidden="true" />
                <span>
                  <strong>{h.label}</strong>
                  {h.city && <small>{h.city}</small>}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
