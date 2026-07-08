# FreePark BAB — Design v1

## Objectif
Web app / PWA mobile-first type « Waze du stationnement gratuit », centrée sur Biarritz, Anglet, Bayonne (BAB). L'utilisateur entre une adresse (ex : un restaurant à Biarritz) et voit immédiatement où commence la zone gratuite la plus proche, où se garer gratuitement **au moment choisi**, et le temps de marche.

## Architecture
- **App statique** (Vite + React + TypeScript), zéro backend. Déploiement Vercel.
- **Carte** : MapLibre GL JS + tuiles vectorielles OpenFreeMap (gratuit, sans clé).
- **Géocodage** : API Adresse de l'État (`api-adresse.data.gouv.fr`), autocomplétion.
- **Calculs géo** : Turf.js (point-in-polygon, distance aux bords de polygones).
- **Pipeline de données** (`scripts/build-data.mjs`, relançable) : télécharge les open data
  de Biarritz (zones payantes + zones bleues), Anglet (littoral), Bayonne, et les parkings
  gratuits OSM (Overpass, `amenity=parking` + `fee=no` sur la bbox BAB). Normalise en un
  `public/data/zones.geojson` unique. Les **horaires** sont encodés à la main par zone dans
  `scripts/schedules.config.mjs` (les champs horaires des open data sont hétérogènes).

## Modèle de données (propriétés de chaque feature)
- `id`, `commune`, `name`, `kind`: `paid` | `blue` | `free-parking`
- `schedule`: liste de règles `{ months: [1..12], days: [0..6], start: "09:00", end: "19:00" }`
- `tariffNote` (texte libre, ex « 1ère heure gratuite »), `source`

## Moteur horaires
`zoneStatusAt(zone, date)` → `free` | `paid` | `blue`, avec métadonnées pour les badges :
« Gratuit maintenant », « Payant jusqu'à 19h », « Gratuit à partir de 20h », « Zone bleue »,
« Payant à partir de 9h » (piège du lendemain matin). Une zone payante 9h–19h est gratuite à 20h.
Saisonnalité Anglet : payant mai→octobre uniquement.

## Suggestions
Candidats = parkings gratuits OSM + points échantillonnés le long des bords extérieurs des
polygones payants proches de la destination. Classement par temps de marche estimé
(haversine × 1,3 de facteur détour, 4,5 km/h). 3–5 résultats, badges de statut, tap → itinéraire
piéton Apple Plans / Google Maps.

## UI (façon Waze / Apple Maps)
- Carte plein écran ; recherche très visible en haut ; bouton « ma position ».
- Sélecteur de moment : « Maintenant » par défaut, ou date/heure (« samedi 20h »).
- Couches : zones payantes actives en rouge, zones bleues en bleu, parkings gratuits en vert.
- Panneau bas coulissant de suggestions (bottom sheet), badges clairs.
- Filtres : « gratuit maintenant uniquement », « moins de 10 min à pied », « éviter zones bleues ».
- Favoris (maison, restos, plages) en localStorage.
- États vides / loading / erreurs propres. Animations fluides. PWA installable (manifest + SW).

## Hors scope v1 (pistes v2)
Estimation de probabilité de trouver une place, contributions utilisateur (signalements),
mode soirée / mode plage dédiés, autres communes.

## Tests
Vitest sur le moteur horaires et le ranking. Vérification manuelle du flux complet.

## Limite assumée
« Gratuit » = hors zone payante/bleue connue ; ne garantit pas la stationnabilité d'une rue
(piéton, interdit). Les suggestions privilégient parkings OSM et bords de zones.
