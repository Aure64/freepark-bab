---
name: verify
description: Vérifier FreePark BAB en conditions réelles (dev server + Playwright iPhone)
---

# Vérifier FreePark BAB

## Lancer
```bash
npx vite --port 5199 &   # serveur dev
node scripts/e2e-drive.mjs   # pilote l'app en viewport iPhone 13, capture des screenshots
```
Le script utilise le devDep `playwright` (chromium-headless-shell doit être installé :
`npx playwright install chromium-headless-shell`). Il écrit les captures dans le
scratchpad (constante `OUT` en tête de script — adapter au besoin).

## Flux à vérifier
1. Accueil : sheet de bienvenue + légende, carte BAB avec zones colorées.
2. Recherche « place clemenceau biarritz » → autocomplétion BAN → sélection.
3. Statut destination : « Rues autour : Payant jusqu'à 20h » en journée d'été.
4. Sélecteur de moment → samedi 20h30 : « Gratuit maintenant · payant demain à 9h »
   + encart « Garez-vous sur place ».
5. Filtres (gratuit uniquement, < 10 min) réduisent la liste.
6. Console : aucune erreur JS.

## Pièges connus
- Le script doit être DANS le projet pour résoudre `playwright` (pas dans /tmp).
- Réseau requis : tuiles OpenFreeMap + API Adresse (api-adresse.data.gouv.fr).
- Les polygones open data épousent les rues : une adresse tombe souvent ENTRE les
  polygones → c'est le fallback « nearby » de destinationContext qui fournit le contexte.
