# Table des plats : valeurs à vérifier

Les valeurs nutritionnelles de `supabase/seed/foods.json` sont des **approximations** rédigées pour démarrer le projet.
Elles ne sont **pas officielles** et ne doivent pas être présentées comme telles dans l'app ni ailleurs.
Toutes les entrées ont `verified = false`.

## Source à utiliser

- **Table de composition des aliments d'Afrique de l'Ouest** (West African Food Composition Table), FAO / INFOODS, 2019.
  C'est la référence visée pour chaque ligne : prendre la valeur de l'aliment **tel que consommé** (cuit, préparé).
- À défaut (plat absent de la table), recalculer à partir d'une recette type pesée, en documentant la recette.

## Procédure pour valider une ligne

1. Trouver l'aliment dans la table FAO (ou établir la recette type).
2. Corriger `kcal_100g`, `proteines_100g`, `glucides_100g`, `lipides_100g` dans `supabase/seed/foods.json`.
3. Remplacer `source` par la référence exacte (ex. « FAO/INFOODS WAFCT 2019, code 01_045 »).
4. Passer `verified` à `true` et cocher la case ci-dessous.
5. Lancer `node scripts/seed-foods.mjs` (contrôle de cohérence + régénération de `supabase/seed.sql`), puis `npx supabase db push --include-seed`.

Les repères de portion (`louche`, `boule`, `assiette`…) sont aussi des estimations : à peser sur des portions réelles de Cotonou.

## Liste

### Féculents

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `riz_blanc` | Riz blanc cuit | 130 | 2.7 | 28.2 | 0.3 |
| ☐ | `riz_jollof` | Riz jollof / riz au gras | 170 | 3.2 | 26 | 6 |
| ☐ | `atassi` | Atassi (riz et haricots) | 150 | 5 | 27 | 2.2 |
| ☐ | `attieke` | Attiéké | 157 | 1 | 37 | 0.5 |
| ☐ | `pate_mais` | Pâte de maïs blanche (wɔ, owo) | 110 | 2.5 | 24 | 0.6 |
| ☐ | `amiwo` | Amiwo (pâte rouge) | 150 | 3 | 25 | 4.5 |
| ☐ | `akassa` | Akassa / agidi (pâte de maïs fermentée) | 80 | 1.5 | 18 | 0.3 |
| ☐ | `igname_pilee` | Igname pilée (foufou d'igname) | 130 | 1.5 | 31 | 0.2 |
| ☐ | `foufou_manioc` | Foufou de manioc | 155 | 0.8 | 37 | 0.3 |
| ☐ | `gari` | Gari sec (semoule de manioc) | 360 | 1.2 | 86 | 0.5 |
| ☐ | `eba` | Eba / piron (gari à l'eau chaude) | 150 | 0.5 | 36 | 0.2 |
| ☐ | `haricots_niebe` | Haricots niébé cuits | 116 | 7.7 | 21 | 0.5 |
| ☐ | `alloco` | Alloco (banane plantain frite) | 260 | 1.3 | 38 | 12 |
| ☐ | `plantain_bouilli` | Banane plantain bouillie | 123 | 0.8 | 31.2 | 0.2 |
| ☐ | `igname_bouillie` | Igname bouillie | 115 | 1.5 | 27.5 | 0.1 |
| ☐ | `igname_frite` | Igname frite | 230 | 2 | 32 | 10.5 |
| ☐ | `manioc_bouilli` | Manioc bouilli | 125 | 1 | 30 | 0.3 |
| ☐ | `pain` | Pain (baguette) | 270 | 9 | 55 | 1.5 |
| ☐ | `spaghetti` | Spaghetti cuits | 158 | 5.8 | 31 | 0.9 |
| ☐ | `couscous_mil` | Couscous de mil (thiéré) | 140 | 3.5 | 29 | 1 |
| ☐ | `bouillie_mil` | Bouillie de mil sucrée | 67 | 1.3 | 14 | 0.6 |
| ☐ | `bouillie_mais` | Bouillie de maïs sucrée (akassa délayé) | 60 | 1 | 13 | 0.4 |

### Plats complets

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `thieboudienne` | Thiéboudienne (riz au poisson) | 160 | 8 | 20 | 5.5 |
| ☐ | `poulet_dg` | Poulet DG | 190 | 10 | 15 | 10 |
| ☐ | `yassa_poulet` | Poulet yassa (sans riz) | 150 | 13 | 6 | 8 |
| ☐ | `degue` | Dèguè / thiakry (mil au lait caillé) | 150 | 4 | 24 | 4 |

### Sauces

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `sauce_graine` | Sauce graine (noix de palme) | 180 | 4 | 5 | 16 |
| ☐ | `sauce_arachide` | Sauce arachide (mafé) | 173 | 7 | 6 | 13.5 |
| ☐ | `sauce_tomate` | Sauce tomate à l'huile | 93 | 1.5 | 6 | 7 |
| ☐ | `sauce_feuilles` | Sauce feuilles (gboma, épinards) | 113 | 4 | 4 | 9 |
| ☐ | `sauce_gombo` | Sauce gombo | 70 | 2.5 | 5 | 4.5 |
| ☐ | `sauce_crincrin` | Sauce crincrin (corète) | 44 | 2.5 | 4 | 2 |
| ☐ | `sauce_pistache` | Sauce pistache / egusi | 200 | 9 | 5 | 16 |
| ☐ | `sauce_claire` | Sauce claire / soupe de poisson | 46 | 5 | 2.5 | 1.8 |
| ☐ | `ndole` | Ndolé | 150 | 9 | 5 | 10.5 |
| ☐ | `sauce_feuille_manioc` | Sauce feuilles de manioc (saka-saka) | 121 | 4 | 6 | 9 |

### Protéines

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `poulet_braise` | Poulet braisé | 208 | 25 | 0 | 12 |
| ☐ | `poulet_frit` | Poulet frit | 251 | 24 | 5 | 15 |
| ☐ | `poisson_braise` | Poisson braisé (tilapia, carpe) | 149 | 22 | 0 | 6.8 |
| ☐ | `poisson_frit` | Poisson frit | 218 | 20 | 3 | 14 |
| ☐ | `poisson_fume` | Poisson fumé | 280 | 45 | 0 | 11 |
| ☐ | `crevettes_sechees` | Crevettes séchées | 280 | 60 | 2 | 3 |
| ☐ | `viande_boeuf` | Viande de bœuf cuite | 221 | 26 | 0 | 13 |
| ☐ | `viande_chevre` | Viande de chèvre / mouton cuite | 140 | 27 | 0 | 3.5 |
| ☐ | `suya` | Suya / choukouya (brochette grillée) | 249 | 28 | 5 | 13 |
| ☐ | `oeuf_dur` | Œuf dur | 152 | 12.6 | 1.1 | 10.6 |
| ☐ | `omelette` | Omelette | 189 | 12 | 1.5 | 15 |
| ☐ | `wagashi` | Wagashi (fromage peul) | 202 | 16 | 3 | 14 |
| ☐ | `wagashi_frit` | Wagashi frit | 300 | 17 | 4 | 24 |
| ☐ | `fromage_soja` | Fromage de soja frit (tofu) | 280 | 17 | 9 | 20 |
| ☐ | `beignets_haricot` | Beignets de haricot (ata, akara) | 290 | 10 | 22 | 18 |

### Légumes

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `crudites` | Crudités (salade, tomate, oignon, sans sauce) | 20 | 1 | 3.5 | 0.2 |

### Fruits

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `avocat` | Avocat | 160 | 2 | 8.5 | 14.7 |
| ☐ | `banane_douce` | Banane douce | 89 | 1.1 | 22.8 | 0.3 |
| ☐ | `mangue` | Mangue | 60 | 0.8 | 15 | 0.4 |
| ☐ | `ananas` | Ananas | 50 | 0.5 | 13 | 0.1 |
| ☐ | `orange` | Orange | 47 | 0.9 | 11.8 | 0.1 |
| ☐ | `papaye` | Papaye | 43 | 0.5 | 9.8 | 0.3 |

### Matières grasses

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `huile_palme` | Huile de palme (rouge) | 884 | 0 | 0 | 100 |
| ☐ | `huile_vegetale` | Huile végétale (arachide, soja, tournesol) | 884 | 0 | 0 | 100 |
| ☐ | `mayonnaise` | Mayonnaise | 680 | 1 | 1 | 75 |

### En-cas

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `arachides_grillees` | Arachides grillées | 590 | 25 | 16 | 49 |
| ☐ | `beignet_farine` | Beignet de farine (botokoin, puff-puff) | 340 | 6 | 45 | 15 |
| ☐ | `chips_plantain` | Chips de plantain | 528 | 2 | 58 | 32 |

### Boissons

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `bissap` | Bissap sucré | 45 | 0 | 11 | 0 |
| ☐ | `jus_gingembre` | Jus de gingembre sucré | 50 | 0 | 12.5 | 0 |
| ☐ | `soda` | Soda sucré | 42 | 0 | 10.6 | 0 |

### Sucres

| ✔ | Clé | Libellé | kcal | P | G | L |
|---|---|---|---|---|---|---|
| ☐ | `lait_concentre` | Lait concentré sucré | 321 | 7.9 | 54.4 | 8.7 |
| ☐ | `sucre` | Sucre | 400 | 0 | 100 | 0 |

_Valeurs pour 100 g tel que consommé. P = protéines, G = glucides, L = lipides (g)._
