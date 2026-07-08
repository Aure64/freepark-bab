import type { ParkingTap } from './MapView';
import './ParkingCard.css';

interface ParkingCardProps {
  parking: ParkingTap;
  /** Temps de marche depuis la destination si une adresse est choisie */
  walkMinutes: number | null;
  onNavigate: () => void;
  onClose: () => void;
}

/** Fiche détail d'un parking gratuit tapé sur la carte. */
export function ParkingCard({ parking, walkMinutes, onNavigate, onClose }: ParkingCardProps) {
  return (
    <div className="parking-card" role="dialog" aria-label={parking.name}>
      <div className="parking-card__head">
        <span className="parking-card__icon" aria-hidden="true">P</span>
        <div className="parking-card__title">
          <h3>{parking.name}</h3>
          <p>
            Gratuit
            {parking.capacity && ` · ${parking.capacity} places`}
            {walkMinutes !== null && ` · ${walkMinutes} min à pied de votre destination`}
          </p>
        </div>
        <button className="parking-card__close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>
      <div className="parking-card__actions">
        <button className="parking-card__go" onClick={onNavigate}>
          Y aller en voiture
        </button>
      </div>
      <p className="parking-card__source">
        Source : OpenStreetMap — pas de comptage en temps réel des places libres.
      </p>
    </div>
  );
}
