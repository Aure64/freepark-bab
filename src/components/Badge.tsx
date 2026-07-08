import type { ZoneState } from '../lib/types';
import './Badge.css';

interface BadgeProps {
  state: ZoneState;
  children: React.ReactNode;
}

/** Badge de statut tarifaire : vert = gratuit, rouge = payant, bleu = zone bleue. */
export function Badge({ state, children }: BadgeProps) {
  return <span className={`badge badge--${state}`}>{children}</span>;
}
