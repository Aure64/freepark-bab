import { describe, expect, it } from 'vitest';
import { buildSuggestions, destinationContext } from './suggest';
import type { ZoneCollection, ZoneFeature } from './types';

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const ALWAYS_PAID = [{ months: ALL_MONTHS, days: ALL_DAYS, start: '00:00', end: '23:59' }];
const DAY_PAID = [{ months: ALL_MONTHS, days: ALL_DAYS, start: '09:00', end: '19:00' }];

// Petit quartier fictif autour de (0, 0) : 0.001° ≈ 111 m
const paidSquare = (id: string, schedule = DAY_PAID): ZoneFeature => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-0.003, -0.003],
        [0.003, -0.003],
        [0.003, 0.003],
        [-0.003, 0.003],
        [-0.003, -0.003],
      ],
    ],
  },
  properties: {
    id,
    commune: 'Testville',
    name: `Zone ${id}`,
    kind: 'paid',
    zoneColor: 'Rouge',
    schedule,
    tariffNote: '',
    source: 'test',
  },
});

const freeParking = (id: string, coords: [number, number]): ZoneFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: coords },
  properties: {
    id,
    commune: '',
    name: `Parking ${id}`,
    kind: 'free-parking',
    zoneColor: 'Verte',
    schedule: [],
    tariffNote: '',
    source: 'test',
  },
});

const collection = (features: ZoneFeature[]): ZoneCollection => ({
  type: 'FeatureCollection',
  features,
});

const DEST: [number, number] = [0, 0]; // au centre de la zone payante
const DAYTIME = new Date(2026, 9, 6, 15, 0);
const EVENING = new Date(2026, 9, 6, 21, 0);

describe('destinationContext', () => {
  it('détecte que la destination est dans une zone payante active', () => {
    const ctx = destinationContext(DEST, collection([paidSquare('A')]), DAYTIME);
    expect(ctx).not.toBeNull();
    expect(ctx!.status.state).toBe('paid');
  });

  it('la même destination est en zone libre le soir', () => {
    const ctx = destinationContext(DEST, collection([paidSquare('A')]), EVENING);
    expect(ctx!.status.state).toBe('free');
  });

  it('null hors de toute zone', () => {
    const ctx = destinationContext([0.1, 0.1], collection([paidSquare('A')]), DAYTIME);
    expect(ctx).toBeNull();
  });
});

describe('buildSuggestions', () => {
  it('propose le bord de la zone payante quand on est dedans en journée', () => {
    const suggestions = buildSuggestions(DEST, collection([paidSquare('A', ALWAYS_PAID)]), DAYTIME);
    expect(suggestions.length).toBeGreaterThan(0);
    const edge = suggestions.find((s) => s.kind === 'street-edge');
    expect(edge).toBeDefined();
    expect(edge!.status.state).toBe('free');
    // Le bord est à ~333-470 m du centre → quelques minutes à pied
    expect(edge!.walkMinutes).toBeGreaterThanOrEqual(4);
    expect(edge!.walkMinutes).toBeLessThanOrEqual(12);
  });

  it('classe les parkings gratuits par distance', () => {
    const zones = collection([
      paidSquare('A', ALWAYS_PAID),
      freeParking('proche', [0.005, 0]), // ~555 m
      freeParking('loin', [0.012, 0]), // ~1330 m
    ]);
    const suggestions = buildSuggestions(DEST, zones, DAYTIME);
    const parkings = suggestions.filter((s) => s.kind === 'parking');
    expect(parkings.map((p) => p.name)).toEqual(['Parking proche', 'Parking loin']);
  });

  it('le soir, la zone payante 9h-19h ne génère plus de « bord de zone »', () => {
    const suggestions = buildSuggestions(DEST, collection([paidSquare('A')]), EVENING);
    expect(suggestions.every((s) => s.kind !== 'street-edge')).toBe(true);
  });

  it('filtre « moins de 10 min à pied »', () => {
    const zones = collection([
      freeParking('proche', [0.005, 0]), // ~9-10 min
      freeParking('loin', [0.012, 0]), // ~23 min
    ]);
    const all = buildSuggestions(DEST, zones, DAYTIME);
    expect(all).toHaveLength(2);
    const filtered = buildSuggestions(DEST, zones, DAYTIME, {
      freeNowOnly: false,
      maxWalkMinutes: 12,
      avoidBlue: false,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Parking proche');
  });

  it('ignore les parkings au-delà du rayon de recherche', () => {
    const zones = collection([freeParking('tresloin', [0.05, 0])]); // ~5,5 km
    expect(buildSuggestions(DEST, zones, DAYTIME)).toHaveLength(0);
  });

  it('espace les suggestions d’au moins 150 m', () => {
    const zones = collection([
      freeParking('a', [0.005, 0]),
      freeParking('b', [0.0051, 0]), // ~11 m du précédent
    ]);
    expect(buildSuggestions(DEST, zones, DAYTIME)).toHaveLength(1);
  });

  it('zone bleue proposée avec badge, exclue avec avoidBlue', () => {
    const blue: ZoneFeature = {
      ...paidSquare('B'),
      properties: { ...paidSquare('B').properties, kind: 'blue', name: 'Zone bleue B' },
    };
    const withBlue = buildSuggestions([0.004, 0], collection([blue]), DAYTIME);
    expect(withBlue.some((s) => s.kind === 'blue-zone')).toBe(true);
    const without = buildSuggestions([0.004, 0], collection([blue]), DAYTIME, {
      freeNowOnly: false,
      maxWalkMinutes: null,
      avoidBlue: true,
    });
    expect(without.some((s) => s.kind === 'blue-zone')).toBe(false);
  });
});
