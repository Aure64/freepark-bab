import { useEffect, useState } from 'react';
import { fetchPlaceDetails, type PlaceDetails } from '../lib/placeDetails';
import type { ParkingTap } from './MapView';
import './ParkingCard.css';

interface ParkingCardProps {
  parking: ParkingTap;
  /** Temps de marche depuis la destination si une adresse est choisie */
  walkMinutes: number | null;
  onNavigate: () => void;
  onClose: () => void;
}

const GENERIC_NAME = 'Parking gratuit';

/** Mini-fiche d'un parking gratuit : nom résolu par adresse, photo Panoramax, Y aller. */
export function ParkingCard({ parking, walkMinutes, onNavigate, onClose }: ParkingCardProps) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);

  useEffect(() => {
    setDetails(null);
    const controller = new AbortController();
    fetchPlaceDetails(parking.coords, controller.signal).then(setDetails).catch(() => {});
    return () => controller.abort();
  }, [parking.id, parking.coords]);

  // Nom : celui d'OSM s'il existe, sinon la rue la plus proche (BAN)
  const title =
    parking.name !== GENERIC_NAME
      ? parking.name
      : details?.street
        ? `Parking · ${details.street}`
        : GENERIC_NAME;

  const meta = [
    'Gratuit',
    parking.capacity && `${parking.capacity} places`,
    walkMinutes !== null && `${walkMinutes} min à pied`,
    !walkMinutes && details?.city,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="parking-card" role="dialog" aria-label={title}>
      {details === null ? (
        <span className="parking-card__photo parking-card__photo--loading" aria-hidden="true" />
      ) : details.photoUrl ? (
        <a
          className="parking-card__photo"
          href={details.photoHdUrl ?? details.photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Voir la photo du lieu (Panoramax)"
        >
          <img src={details.photoUrl} alt={`Photo du lieu — ${title}`} loading="lazy" />
        </a>
      ) : (
        <span className="parking-card__icon" aria-hidden="true">P</span>
      )}
      <div className="parking-card__text">
        <h3>{title}</h3>
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
