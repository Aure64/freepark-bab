// Règles horaires de stationnement par commune / zone tarifaire.
// Encodées à la main depuis les sites officiels (les open data ne portent pas les horaires).
// Sources :
//  - Biarritz : https://www.biarritz.fr/cadre-de-vie-bizi-ingurunea/stationnement/mode-demploi
//  - Bayonne  : https://www.bayonne.fr/jhabite-a-bayonne/me-deplacer/stationnement/tarifs-de-stationnement
//  - Anglet   : https://anglet-opendatapaysbasque.opendatasoft.com (payant 1er mai → 31 oct)
//
// Modèle de règle : { months: [1..12], days: [0..6] (0 = dimanche), start: 'HH:MM', end: 'HH:MM' }
// Une zone est payante à l'instant T si AU MOINS une règle matche.

/** Lun→Sam */
const MON_SAT = [1, 2, 3, 4, 5, 6];
/** Tous les jours */
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Biarritz basse/moyenne saison : lun→sam 9h-12h30 et 14h-19h (jours fériés inclus) */
const biarritzOffPeak = (months) => [
  { months, days: MON_SAT, start: '09:00', end: '12:30' },
  { months, days: MON_SAT, start: '14:00', end: '19:00' },
];
/** Biarritz haute saison (juil-août) : 7j/7 9h-20h */
const biarritzSummer = [{ months: [7, 8], days: ALL_DAYS, start: '09:00', end: '20:00' }];

export const SCHEDULES = {
  biarritz: {
    // Zones rouge & orange : payantes toute l'année
    Rouge: {
      rules: [...biarritzOffPeak([1, 2, 3, 4, 5, 6, 9, 10, 11, 12]), ...biarritzSummer],
      tariffNote: '1ʳᵉ heure gratuite (1×/jour). Payant juil-août 7j/7 9h-20h, sinon lun-sam 9h-12h30 / 14h-19h.',
    },
    Orange: {
      rules: [...biarritzOffPeak([1, 2, 3, 4, 5, 6, 9, 10, 11, 12]), ...biarritzSummer],
      tariffNote: '1ʳᵉ heure gratuite (1×/jour). Payant juil-août 7j/7 9h-20h, sinon lun-sam 9h-12h30 / 14h-19h.',
    },
    // Zone verte : moyenne saison avr→juin + sept→mi-nov (approx. : nov complet, prudence) + été
    Verte: {
      rules: [...biarritzOffPeak([4, 5, 6, 9, 10, 11]), ...biarritzSummer],
      tariffNote: '1ʳᵉ heure gratuite (1×/jour). Gratuit déc-mars. Payant avr-juin & sept-mi-nov lun-sam, juil-août 7j/7 9h-20h.',
    },
    // Zone jaune (littoral sud) : saison mai→sept (approx. horaires alignés sur les autres zones)
    Jaune: {
      rules: [
        ...biarritzOffPeak([5, 6, 9]),
        ...biarritzSummer,
      ],
      tariffNote: '1ʳᵉ heure gratuite (1×/jour). Payant en saison (mai-sept), gratuit le reste de l’année.',
    },
    // Zones bleues : disque obligatoire, durée limitée (lun-sam en journée)
    Bleue: {
      rules: [{ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], days: MON_SAT, start: '09:00', end: '19:00' }],
      tariffNote: 'Gratuit avec disque, durée limitée (1h30). Libre le soir et le dimanche.',
    },
  },

  anglet: {
    // Littoral : payant du 1er mai au 31 octobre, 7j/7 9h-19h
    'Stationnement courte durée': {
      rules: [{ months: [5, 6, 7, 8, 9, 10], days: ALL_DAYS, start: '09:00', end: '19:00' }],
      tariffNote: 'Payant mai→oct 9h-19h (courte durée). Gratuit novembre→avril et le soir.',
    },
    'Stationnement longue durée': {
      rules: [{ months: [5, 6, 7, 8, 9, 10], days: ALL_DAYS, start: '09:00', end: '19:00' }],
      tariffNote: 'Payant mai→oct 9h-19h (tarif longue durée). Gratuit novembre→avril et le soir.',
    },
  },

  bayonne: {
    // Toutes zones voirie : lun-ven 9h-18h, sam 9h-14h. Dimanche gratuit.
    default: {
      rules: [
        { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
        { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], days: [6], start: '09:00', end: '14:00' },
      ],
      tariffNote: '30 min gratuites/jour via PayByPhone ou EasyPark. Gratuit dès 18h (14h le samedi) et le dimanche.',
    },
  },
};
