/** Règle horaire : la zone est payante/réglementée si mois, jour et plage horaire matchent. */
export interface ScheduleRule {
  /** Mois concernés, 1 = janvier … 12 = décembre */
  months: number[];
  /** Jours concernés, 0 = dimanche … 6 = samedi */
  days: number[];
  /** Heure de début "HH:MM" (incluse) */
  start: string;
  /** Heure de fin "HH:MM" (exclue) */
  end: string;
}

export type ZoneKind = 'paid' | 'blue' | 'free-parking' | 'street';

export interface ZoneProperties {
  id: string;
  name: string;
  kind: ZoneKind;
  /** Absents sur les points « street » (propriétés minimales pour alléger le fichier) */
  commune?: string;
  zoneColor?: string;
  schedule?: ScheduleRule[];
  tariffNote?: string;
  source?: string;
  capacity?: string | null;
}

export type ZoneFeature = GeoJSON.Feature<GeoJSON.Geometry, ZoneProperties>;
export type ZoneCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, ZoneProperties>;

/** État d'une zone à un instant donné. */
export type ZoneState = 'free' | 'paid' | 'blue';

export interface ZoneStatus {
  state: ZoneState;
  /** Fin de la fenêtre réglementée en cours (si state = paid/blue) */
  activeUntil: Date | null;
  /** Prochaine fenêtre réglementée (si state = free) */
  nextActiveStart: Date | null;
  /** Badge principal, ex. « Gratuit maintenant », « Payant jusqu’à 19h » */
  label: string;
  /** Précision, ex. « payant à partir de 9h demain » */
  sublabel: string;
}

export type SuggestionKind = 'parking' | 'street' | 'street-edge' | 'blue-zone';

export interface Suggestion {
  id: string;
  name: string;
  commune: string;
  /** [lon, lat] */
  coords: [number, number];
  walkMeters: number;
  walkMinutes: number;
  status: ZoneStatus;
  kind: SuggestionKind;
  tariffNote: string;
}

export interface SuggestionFilters {
  freeNowOnly: boolean;
  maxWalkMinutes: number | null;
  avoidBlue: boolean;
}
