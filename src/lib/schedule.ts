import type { ScheduleRule, ZoneFeature, ZoneStatus } from './types';

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const ruleMatchesDay = (rule: ScheduleRule, date: Date): boolean =>
  rule.months.includes(date.getMonth() + 1) && rule.days.includes(date.getDay());

/** La règle est-elle active à cet instant précis ? */
const ruleActiveAt = (rule: ScheduleRule, date: Date): boolean => {
  if (!ruleMatchesDay(rule, date)) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= toMinutes(rule.start) && minutes < toMinutes(rule.end);
};

const atTime = (base: Date, minutes: number): Date => {
  const d = new Date(base);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

/**
 * Fin de la fenêtre réglementée en cours : suit les règles chaînées
 * (ex. 9h-12h30 puis 14h-19h restent deux fenêtres distinctes — on retourne 12h30).
 */
function activeWindowEnd(rules: ScheduleRule[], date: Date): Date | null {
  let end: number | null = null;
  const minutes = date.getHours() * 60 + date.getMinutes();
  for (const rule of rules) {
    if (!ruleMatchesDay(rule, date)) continue;
    const s = toMinutes(rule.start);
    const e = toMinutes(rule.end);
    if (minutes >= s && minutes < e) end = Math.max(end ?? 0, e);
  }
  if (end === null) return null;
  // Étend si une autre règle démarre pile à la fin (fenêtres contiguës)
  let extended = true;
  while (extended) {
    extended = false;
    for (const rule of rules) {
      if (!ruleMatchesDay(rule, date)) continue;
      const s = toMinutes(rule.start);
      const e = toMinutes(rule.end);
      if (s <= end && e > end) {
        end = e;
        extended = true;
      }
    }
  }
  return atTime(date, end);
}

/** Prochain début de fenêtre réglementée dans les `horizonDays` jours à venir. */
function nextActiveStart(rules: ScheduleRule[], from: Date, horizonDays = 8): Date | null {
  if (rules.length === 0) return null;
  const fromMinutes = from.getHours() * 60 + from.getMinutes();
  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const day = new Date(from);
    day.setDate(day.getDate() + dayOffset);
    const starts = rules
      .filter((r) => ruleMatchesDay(r, day))
      .map((r) => toMinutes(r.start))
      .filter((s) => dayOffset > 0 || s > fromMinutes)
      .sort((a, b) => a - b);
    if (starts.length > 0) return atTime(day, starts[0]);
  }
  return null;
}

const formatHour = (d: Date): string =>
  d.getMinutes() === 0 ? `${d.getHours()}h` : `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isTomorrow = (d: Date, ref: Date): boolean => {
  const t = new Date(ref);
  t.setDate(t.getDate() + 1);
  return sameDay(d, t);
};

/** Décrit une échéance future de façon compacte : « à partir de 9h », « demain à 9h », « le 1er mai »… */
function describeStart(start: Date, ref: Date): string {
  if (sameDay(start, ref)) return `payant à partir de ${formatHour(start)}`;
  if (isTomorrow(start, ref)) return `payant demain à ${formatHour(start)}`;
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const diffDays = Math.round((start.getTime() - ref.getTime()) / 86_400_000);
  if (diffDays < 7) return `payant ${days[start.getDay()]} à ${formatHour(start)}`;
  return `payant à partir du ${start.getDate()}/${start.getMonth() + 1}`;
}

/** Statut d'une zone à l'instant `date`, avec libellés prêts pour les badges. */
export function zoneStatusAt(zone: ZoneFeature, date: Date): ZoneStatus {
  const { kind } = zone.properties;
  const schedule = zone.properties.schedule ?? [];

  if (kind === 'free-parking' || kind === 'street' || schedule.length === 0) {
    return {
      state: 'free',
      activeUntil: null,
      nextActiveStart: null,
      label: 'Gratuit',
      sublabel: 'parking gratuit',
    };
  }

  const activeNow = schedule.some((r) => ruleActiveAt(r, date));

  if (activeNow) {
    const until = activeWindowEnd(schedule, date);
    if (kind === 'blue') {
      return {
        state: 'blue',
        activeUntil: until,
        nextActiveStart: null,
        label: 'Zone bleue',
        sublabel: `disque obligatoire${until ? ` jusqu’à ${formatHour(until)}` : ''}`,
      };
    }
    return {
      state: 'paid',
      activeUntil: until,
      nextActiveStart: null,
      label: until ? `Payant jusqu’à ${formatHour(until)}` : 'Payant',
      sublabel: until ? `gratuit à partir de ${formatHour(until)}` : '',
    };
  }

  const next = nextActiveStart(schedule, date);
  const freeLabel = kind === 'blue' ? 'Libre (zone bleue inactive)' : 'Gratuit maintenant';
  return {
    state: 'free',
    activeUntil: null,
    nextActiveStart: next,
    label: freeLabel,
    sublabel: next ? describeStart(next, date) : 'gratuit en permanence',
  };
}
