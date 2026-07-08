import { useRef, useState } from 'react';
import { walkingDirectionsUrl } from '../lib/directions';
import type { Suggestion, SuggestionFilters, ZoneStatus } from '../lib/types';
import { Badge } from './Badge';
import './SuggestionsSheet.css';

interface SuggestionsSheetProps {
  destinationLabel: string | null;
  destinationStatus: ZoneStatus | null;
  suggestions: Suggestion[];
  filters: SuggestionFilters;
  onFiltersChange: (f: SuggestionFilters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  computing: boolean;
}

type SheetPosition = 'peek' | 'open';

const WALK_ICON = (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="row__walk-icon">
    <circle cx="8.6" cy="2.6" r="1.6" fill="currentColor" />
    <path
      d="M8.4 5.2 6 6.6l-1 3M8.4 5.2l1.4 3 2.4 1M8.4 5.2 7.6 9.4l1.8 2.4-.6 3M7.6 9.4l-2.4 2.2-.8 2.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function SuggestionsSheet({
  destinationLabel,
  destinationStatus,
  suggestions,
  filters,
  onFiltersChange,
  selectedId,
  onSelect,
  isFavorite,
  onToggleFavorite,
  computing,
}: SuggestionsSheetProps) {
  const [position, setPosition] = useState<SheetPosition>('peek');
  const dragStart = useRef<{ y: number; position: SheetPosition } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { y: e.clientY, position };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const delta = e.clientY - start.y;
    if (delta < -40) setPosition('open');
    else if (delta > 40) setPosition('peek');
  };

  const hasSearch = destinationLabel !== null;

  return (
    <section
      className={`sheet sheet--${position}${hasSearch ? '' : ' sheet--welcome'}`}
      aria-label="Suggestions de stationnement"
    >
      <div
        className="sheet__grip-zone"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={() => setPosition(position === 'peek' ? 'open' : 'peek')}
      >
        <div className="sheet__grip" aria-hidden="true" />
      </div>

      {!hasSearch ? (
        <div className="sheet__welcome">
          <h1 className="sheet__brand">
            FreePark <span>BAB</span>
          </h1>
          <p className="sheet__tagline">
            Le stationnement gratuit à Biarritz, Anglet et Bayonne — selon l’heure où vous y allez.
          </p>
          <ul className="sheet__legend">
            <li><i className="dot dot--paid" /> Payant au moment choisi</li>
            <li><i className="dot dot--blue" /> Zone bleue (disque)</li>
            <li><i className="dot dot--free" /> Parking gratuit</li>
          </ul>
          <p className="sheet__hint">Cherchez une adresse pour voir où vous garer gratuitement.</p>
        </div>
      ) : (
        <div className="sheet__content">
          <header className="sheet__dest">
            <div className="sheet__dest-text">
              <h2>{destinationLabel}</h2>
              {destinationStatus && (
                <p className="sheet__dest-status">
                  <Badge state={destinationStatus.state}>{destinationStatus.label}</Badge>
                  {destinationStatus.sublabel && <span>{destinationStatus.sublabel}</span>}
                </p>
              )}
              {!destinationStatus && (
                <p className="sheet__dest-status">
                  <Badge state="free">Adresse en zone non réglementée</Badge>
                </p>
              )}
            </div>
            <button
              className={`sheet__fav${isFavorite ? ' sheet__fav--on' : ''}`}
              onClick={onToggleFavorite}
              aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={isFavorite}
            >
              {isFavorite ? '★' : '☆'}
            </button>
          </header>

          <div className="sheet__filters" role="group" aria-label="Filtres">
            <button
              className={`filter${filters.freeNowOnly ? ' filter--on' : ''}`}
              aria-pressed={filters.freeNowOnly}
              onClick={() => onFiltersChange({ ...filters, freeNowOnly: !filters.freeNowOnly })}
            >
              Gratuit uniquement
            </button>
            <button
              className={`filter${filters.maxWalkMinutes !== null ? ' filter--on' : ''}`}
              aria-pressed={filters.maxWalkMinutes !== null}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  maxWalkMinutes: filters.maxWalkMinutes === null ? 10 : null,
                })
              }
            >
              &lt; 10 min à pied
            </button>
            <button
              className={`filter${filters.avoidBlue ? ' filter--on' : ''}`}
              aria-pressed={filters.avoidBlue}
              onClick={() => onFiltersChange({ ...filters, avoidBlue: !filters.avoidBlue })}
            >
              Éviter zones bleues
            </button>
          </div>

          {computing ? (
            <div className="sheet__skeletons" aria-label="Calcul en cours">
              {[0, 1, 2].map((i) => (
                <div className="skeleton-row" key={i} style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="sheet__empty">
              <p className="sheet__empty-title">Rien dans ce rayon avec ces filtres.</p>
              <p className="sheet__empty-body">
                Élargissez les filtres — ou bonne nouvelle : si aucune zone payante n’apparaît en
                rouge autour de votre destination, la rue y est probablement gratuite.
              </p>
            </div>
          ) : (
            <ol className="sheet__list">
              {suggestions.map((s, i) => (
                <li key={s.id}>
                  <div
                    className={`row${s.id === selectedId ? ' row--selected' : ''}`}
                    onClick={() => onSelect(s.id)}
                  >
                    <span className={`row__num row__num--${s.status.state}`}>{i + 1}</span>
                    <div className="row__body">
                      <p className="row__name">{s.name}</p>
                      <p className="row__meta">
                        <Badge state={s.status.state}>{s.status.label}</Badge>
                        {s.status.sublabel && <span className="row__sub">{s.status.sublabel}</span>}
                      </p>
                    </div>
                    <div className="row__right">
                      <span className="row__walk">
                        {WALK_ICON}
                        {s.walkMinutes} min
                      </span>
                      <a
                        className="row__go"
                        href={walkingDirectionsUrl(s.coords)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Itinéraire à pied vers ${s.name}`}
                      >
                        Y aller
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <p className="sheet__disclaimer">
            Données : open data Biarritz · Anglet · Bayonne · OpenStreetMap. Vérifiez toujours la
            signalisation sur place.
          </p>
        </div>
      )}
    </section>
  );
}
