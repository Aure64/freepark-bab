import type { ParkingTap } from './MapView';
import './ParkingCard.css';

interface ParkingCardProps {
  parking: ParkingTap;
  /** Temps de marche depuis la destination si une adresse est choisie */
  walkMinutes: number | null;
  onNavigate: () => void;
  onClose: () => void;
}

/** Mini-fiche d'un parking gratuit tapé sur la carte — une ligne, légère. */
export function ParkingCard({ parking, walkMinutes, onNavigate, onClose }: ParkingCardProps) {
  const meta = [
    'Gratuit',
    parking.capacity && `${parking.capacity} places`,
    walkMinutes !== null && `${walkMinutes} min à pied`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="parking-card" role="dialog" aria-label={parking.name}>
      <span className="parking-card__icon" aria-hidden="true">P</span>
      <div className="parking-card__text">
        <h3>{parking.name}</h3>
        <p>{meta}</p>
      </div>
      <button className="parking-card__go" onClick={onNavigate}>
        Y aller
      </button>
      <button className="parking-card__close" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
    </div>
  );
}
