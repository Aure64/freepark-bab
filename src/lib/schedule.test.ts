import { describe, expect, it } from 'vitest';
import { zoneStatusAt } from './schedule';
import type { ScheduleRule, ZoneFeature } from './types';

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MON_SAT = [1, 2, 3, 4, 5, 6];

const makeZone = (kind: 'paid' | 'blue' | 'free-parking', schedule: ScheduleRule[]): ZoneFeature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
  properties: {
    id: 'test',
    commune: 'Test',
    name: 'Zone test',
    kind,
    zoneColor: 'Rouge',
    schedule,
    tariffNote: '',
    source: 'test',
  },
});

// Zone type Bayonne : lun-ven 9h-18h, sam 9h-14h
const bayonneZone = makeZone('paid', [
  { months: ALL_MONTHS, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
  { months: ALL_MONTHS, days: [6], start: '09:00', end: '14:00' },
]);

// Zone type Biarritz hors été : lun-sam 9h-12h30 et 14h-19h
const biarritzZone = makeZone('paid', [
  { months: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12], days: MON_SAT, start: '09:00', end: '12:30' },
  { months: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12], days: MON_SAT, start: '14:00', end: '19:00' },
  { months: [7, 8], days: [0, ...MON_SAT], start: '09:00', end: '20:00' },
]);

// Zone type Anglet littoral : mai→oct, 7j/7 9h-19h
const angletZone = makeZone('paid', [
  { months: [5, 6, 7, 8, 9, 10], days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '19:00' },
]);

describe('zoneStatusAt — le cas clé « resto à 20h »', () => {
  it('une zone payante 9h-19h est gratuite à 20h, avec avertissement pour le lendemain', () => {
    // Mardi 6 octobre 2026, 20h00 — Biarritz hors été
    const status = zoneStatusAt(biarritzZone, new Date(2026, 9, 6, 20, 0));
    expect(status.state).toBe('free');
    expect(status.label).toBe('Gratuit maintenant');
    expect(status.sublabel).toContain('demain à 9h');
  });

  it('la même zone est payante à 15h', () => {
    const status = zoneStatusAt(biarritzZone, new Date(2026, 9, 6, 15, 0));
    expect(status.state).toBe('paid');
    expect(status.label).toBe('Payant jusqu’à 19h');
    expect(status.sublabel).toContain('gratuit à partir de 19h');
  });

  it('pause méridienne : gratuit à 13h, payant à partir de 14h le même jour', () => {
    const status = zoneStatusAt(biarritzZone, new Date(2026, 9, 6, 13, 0));
    expect(status.state).toBe('free');
    expect(status.sublabel).toContain('à partir de 14h');
  });
});

describe('zoneStatusAt — jours et saisons', () => {
  it('dimanche gratuit à Bayonne (payant lundi 9h)', () => {
    // Dimanche 4 octobre 2026, 11h
    const status = zoneStatusAt(bayonneZone, new Date(2026, 9, 4, 11, 0));
    expect(status.state).toBe('free');
    expect(status.sublabel).toContain('demain à 9h');
  });

  it('samedi après 14h gratuit à Bayonne', () => {
    const status = zoneStatusAt(bayonneZone, new Date(2026, 9, 3, 15, 0));
    expect(status.state).toBe('free');
  });

  it('Anglet littoral gratuit en janvier même à 11h', () => {
    const status = zoneStatusAt(angletZone, new Date(2026, 0, 15, 11, 0));
    expect(status.state).toBe('free');
  });

  it('Anglet littoral payant un dimanche de juillet à 11h', () => {
    const status = zoneStatusAt(angletZone, new Date(2026, 6, 12, 11, 0));
    expect(status.state).toBe('paid');
  });

  it('Biarritz payant un dimanche de juillet (haute saison 7j/7) jusqu’à 20h', () => {
    const status = zoneStatusAt(biarritzZone, new Date(2026, 6, 12, 11, 0));
    expect(status.state).toBe('paid');
    expect(status.label).toBe('Payant jusqu’à 20h');
  });
});

describe('zoneStatusAt — zones bleues et parkings gratuits', () => {
  const blueZone = makeZone('blue', [
    { months: ALL_MONTHS, days: MON_SAT, start: '09:00', end: '19:00' },
  ]);

  it('zone bleue active en journée', () => {
    const status = zoneStatusAt(blueZone, new Date(2026, 9, 6, 11, 0));
    expect(status.state).toBe('blue');
    expect(status.label).toBe('Zone bleue');
    expect(status.sublabel).toContain('disque');
  });

  it('zone bleue libre le soir', () => {
    const status = zoneStatusAt(blueZone, new Date(2026, 9, 6, 21, 0));
    expect(status.state).toBe('free');
  });

  it('parking gratuit : toujours gratuit', () => {
    const parking = makeZone('free-parking', []);
    const status = zoneStatusAt(parking, new Date(2026, 6, 12, 11, 0));
    expect(status.state).toBe('free');
    expect(status.label).toBe('Gratuit');
  });
});
