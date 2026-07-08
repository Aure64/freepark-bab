import { NAV_APPS, type NavApp } from '../lib/navigation';
import './NavChooser.css';

interface NavChooserProps {
  /** Nom du spot vers lequel on navigue (null = simple choix de préférence) */
  targetName: string | null;
  onPick: (app: NavApp) => void;
  onClose: () => void;
}

/** Feuille de choix de l'app de navigation (Waze / Google Maps / Plans). */
export function NavChooser({ targetName, onPick, onClose }: NavChooserProps) {
  return (
    <div className="navchooser" role="dialog" aria-label="Choisir l’app de navigation">
      <div className="navchooser__backdrop" onClick={onClose} />
      <div className="navchooser__panel">
        <p className="navchooser__title">
          {targetName ? `Itinéraire voiture vers ${targetName}` : 'App de navigation'}
        </p>
        {NAV_APPS.map((app) => (
          <button key={app.id} className="navchooser__app" onClick={() => onPick(app.id)}>
            {app.label}
          </button>
        ))}
        <p className="navchooser__note">Votre choix est mémorisé — modifiable en bas de page.</p>
      </div>
    </div>
  );
}
