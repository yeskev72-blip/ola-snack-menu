# Design de l'app — onze planches

Reçu le 11 novembre 2026. Les planches `.dc.html` sont les sources du canevas ;
elles s'ouvrent dans Claude, pas seules dans un navigateur. `project/canvas.json`
donne leur disposition.

## Correspondance avec l'app existante

| Planche | Écran actuel | Écart |
|---|---|---|
| Fondations | `src/theme.ts` | palette et échelle typographique différentes |
| 1 · Objectif | `src/app/(onboarding)/goal.tsx` | habillage |
| 2 · Aujourd'hui | `src/app/(tabs)/index.tsx` | **protéines mises en avant avant les calories** |
| 3 · Scanner | `src/app/(tabs)/scan.tsx` | habillage |
| 4 · Résultat | `src/app/result.tsx` | **réglage « huile de cuisson » inexistant** |
| 5 · Détail et sources | `src/app/meal/[id].tsx` | **sources par aliment, signalement d'erreur** |
| 6 · Bilan de la semaine | `src/app/(tabs)/history.tsx` | **écran hebdomadaire, nouveau** |
| 7 · Plats locaux | `src/app/(tabs)/foods.tsx` | habillage, portions usuelles affichées |
| 8 · Premium | `src/app/premium.tsx` | **offre annuelle inexistante** |
| 9 · Coach : clients | — | **fonctionnalité entière à créer** |
| 10 · Coach : corriger | — | **fonctionnalité entière à créer** |

## Ce que le design suppose et que l'app a déjà

- 2 scans gratuits par jour, 30 en premium : conforme à `public.scan_quota()`.
- Les pastilles « Sourcé · FAO/INFOODS » et « Estimé · à vérifier » correspondent
  à la colonne `verified` de `public.foods`.
- Mobile Money via l'opérateur de paiement : déjà en place.

## Avertissement du designer, repris tel quel

Toutes les valeurs de calories, protéines et grammes des planches sont des
exemples. Elles ne doivent pas être recopiées dans la base : celle du dépôt est
dans `supabase/seed/foods.json`.
