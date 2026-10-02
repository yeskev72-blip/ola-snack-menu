# Mission : guide de reconnaissance visuelle des plats d'Afrique de l'Ouest

## Contexte

Calbasse est une application qui photographie un repas et en estime les calories. Un modèle de
vision reçoit la photo et doit dire quel plat il voit, en choisissant une clé dans une liste.

**Le modèle se trompe sur les plats qui se ressemblent.** Exemples constatés au Bénin :

- du **télibo** (pâte d'igname, sombre) identifié comme « pâte de maïs » ;
- du **piron** (gari ébouillanté) identifié comme « pâte de maïs » ;
- une **sauce tomate** décrite seulement comme « sauce rouge ».

La cause est connue : le modèle ne reçoit aujourd'hui que le nom de chaque plat et ses synonymes.
**Rien sur son apparence.** Trois pâtes blanchâtres ou brunes lui sont indiscernables.

## Ce qu'on te demande

Pour chaque plat de la liste ci-dessous, produire une **signature visuelle** : ce qui permet de le
reconnaître sur une photo, et surtout ce qui le distingue des plats avec lesquels il est confondu.

Ce n'est **pas** un travail sur les calories ni sur la composition nutritionnelle. Uniquement
l'apparence.

## Format de sortie exigé

Un fichier Markdown, une section par plat, dans cet ordre exact et sans rien ajouter :

```
## <clé exacte>
- **aspect** : couleur, texture, brillance, grain, forme sous laquelle c'est servi. Deux phrases
  maximum, descriptives, sans adjectif inutile.
- **confusions** : les clés de la liste avec lesquelles ce plat est confondu, et pour chacune le
  signe qui les sépare. Format : `clé — ce qui distingue`. Une ligne par confusion.
- **accompagnement** : ce avec quoi il est servi d'habitude, quand c'est un indice utile. Sinon
  écrire « sans indice ».
- **noms régionaux** : autres noms et orthographes, par pays, séparés par des virgules. Ceux déjà
  listés plus bas n'ont pas besoin d'être répétés ; ajouter ceux qui manquent.
- **certitude** : `haute`, `moyenne` ou `basse`, selon la qualité de ce que tu as trouvé.
- **sources** : les URL consultées pour ce plat. Si tu n'as rien trouvé de fiable, écrire
  « aucune source » et mettre certitude `basse`.
```

## Règles de travail

**Les clés sont figées.** Utilise exactement celles de la liste, sans en inventer ni en renommer.
Si tu penses qu'un plat manque à la liste, mets-le dans une section finale « Plats absents »
plutôt que de l'ajouter comme s'il existait.

**Décris ce qu'on voit, pas ce qu'on sait.** « Pâte brun-gris, lisse et élastique, servie en boule
compacte » est utile. « Plat traditionnel béninois apprécié » ne l'est pas.

**Sois honnête sur ce que tu ignores.** Une signature inventée est pire que rien : elle fera
basculer le modèle vers une mauvaise réponse avec assurance. Préfère `certitude: basse` et une
description courte à une description riche et devinée. On a besoin de savoir quelles lignes se
méfier.

**Les confusions sont le cœur du travail.** Traite en priorité les familles où les plats se
ressemblent : les pâtes (igname, maïs, manioc, gari), les sauces rouges, les sauces vertes, les
fritures. Un plat sans sosie peut avoir une section courte.

**Priorité géographique** : Bénin, Togo, Côte d'Ivoire, Nigeria, Ghana, Sénégal. Les noms
régionaux comptent autant que l'aspect : un même plat change de nom tous les 200 km.

**Sources** : sites de cuisine ouest-africaine, blogs culinaires de la région, encyclopédies,
publications FAO. Cite les URL. Les photos sont une source légitime : si tu peux regarder des
images, décris ce que tu y vois réellement.

## La liste des plats

Les clés sont celles qu'utilise l'application. Les noms après « aussi : » sont les synonymes déjà
connus.

### boisson (3)
- `bissap` : Bissap sucré — aussi : jus d'oseille, zobo, foléré
- `jus_gingembre` : Jus de gingembre sucré — aussi : gingembre, ginger
- `soda` : Soda sucré — aussi : coca, fanta, sucrerie

### feculent (22)
- `riz_blanc` : Riz blanc cuit — aussi : riz nature, riz sauce
- `riz_jollof` : Riz jollof / riz au gras — aussi : jollof, riz au gras, riz gras
- `atassi` : Atassi (riz et haricots) — aussi : watchi, waakye, riz haricot
- `attieke` : Attiéké — aussi : atieke, acheke
- `pate_mais` : Pâte de maïs blanche (wɔ, owo) — aussi : wo, owo, pâte blanche, akoumé, tô, ugali
- `amiwo` : Amiwo (pâte rouge) — aussi : pâte rouge, djenkoumé
- `akassa` : Akassa / agidi (pâte de maïs fermentée) — aussi : agidi, eko, ablo
- `igname_pilee` : Igname pilée (foufou d'igname) — aussi : foufou, fufu, agou, pounded yam, télibo
- `foufou_manioc` : Foufou de manioc — aussi : fufu manioc, placali, kokonte
- `gari` : Gari sec (semoule de manioc) — aussi : garri, tapioca gari
- `eba` : Eba / piron (gari à l'eau chaude) — aussi : piron, eba
- `haricots_niebe` : Haricots niébé cuits — aussi : haricot, niébé, ayikoun, beans
- `alloco` : Alloco (banane plantain frite) — aussi : aloko, dodo, plantain frit
- `plantain_bouilli` : Banane plantain bouillie — aussi : plantain cuit, agbôkin
- `igname_bouillie` : Igname bouillie — aussi : igname cuite
- `igname_frite` : Igname frite — aussi : frites d'igname, dundun
- `manioc_bouilli` : Manioc bouilli — aussi : manioc cuit, bâton de manioc, chikwangue
- `pain` : Pain (baguette) — aussi : baguette, pain blanc
- `spaghetti` : Spaghetti cuits — aussi : pâtes, macaroni, spaghetti sautés
- `couscous_mil` : Couscous de mil (thiéré) — aussi : thiéré, cere, couscous
- `bouillie_mil` : Bouillie de mil sucrée — aussi : koko, hausa koko, bouillie, lakh, ogi
- `bouillie_mais` : Bouillie de maïs sucrée (akassa délayé) — aussi : koko maïs, pap, akamu

### fruit (6)
- `avocat` : Avocat — aussi : avocat
- `banane_douce` : Banane douce — aussi : banane
- `mangue` : Mangue — aussi : mango
- `ananas` : Ananas — aussi : ananas
- `orange` : Orange — aussi : orange
- `papaye` : Papaye — aussi : papaye

### legume (1)
- `crudites` : Crudités (salade, tomate, oignon, sans sauce) — aussi : salade, tomate oignon

### matiere_grasse (3)
- `huile_palme` : Huile de palme (rouge) — aussi : zomi, huile rouge
- `huile_vegetale` : Huile végétale (arachide, soja, tournesol) — aussi : huile, huile d'arachide
- `mayonnaise` : Mayonnaise — aussi : mayo

### plat_complet (4)
- `thieboudienne` : Thiéboudienne (riz au poisson) — aussi : ceebu jën, tieb, riz au poisson
- `poulet_dg` : Poulet DG — aussi : poulet directeur général
- `yassa_poulet` : Poulet yassa (sans riz) — aussi : yassa
- `degue` : Dèguè / thiakry (mil au lait caillé) — aussi : dèguè, thiakry, dégué

### proteine (15)
- `poulet_braise` : Poulet braisé — aussi : poulet grillé, poulet bicyclette braisé, choukouya poulet
- `poulet_frit` : Poulet frit — aussi : poulet sauté
- `poisson_braise` : Poisson braisé (tilapia, carpe) — aussi : poisson grillé, tilapia braisé, carpe braisée
- `poisson_frit` : Poisson frit — aussi : friture de poisson, fritures, chinchard frit
- `poisson_fume` : Poisson fumé — aussi : poisson sec, kpanla fumé, akpavi
- `crevettes_sechees` : Crevettes séchées — aussi : crevettes, ablo crevette
- `viande_boeuf` : Viande de bœuf cuite — aussi : boeuf, viande, bœuf sauce
- `viande_chevre` : Viande de chèvre / mouton cuite — aussi : chèvre, mouton, cabri, agneau
- `suya` : Suya / choukouya (brochette grillée) — aussi : choukouya, brochette, kilichi, dibi
- `oeuf_dur` : Œuf dur — aussi : oeuf, œuf bouilli
- `omelette` : Omelette — aussi : oeuf frit, omelette pain
- `wagashi` : Wagashi (fromage peul) — aussi : wagasi, fromage peul, waragashi
- `wagashi_frit` : Wagashi frit — aussi : fromage peul frit
- `fromage_soja` : Fromage de soja frit (tofu) — aussi : tofu, soja frit, fromage de soja
- `beignets_haricot` : Beignets de haricot (ata, akara) — aussi : ata, akara, accra, klaklou haricot

### sauce (10)
- `sauce_graine` : Sauce graine (noix de palme) — aussi : banga, sauce palmiste, abenkwan
- `sauce_arachide` : Sauce arachide (mafé) — aussi : mafé, maafe, groundnut soup, azindessi
- `sauce_tomate` : Sauce tomate à l'huile — aussi : sauce rouge, stew, sauce tomate
- `sauce_feuilles` : Sauce feuilles (gboma, épinards) — aussi : gboma dessi, sauce feuille, efo riro, sauce épinard
- `sauce_gombo` : Sauce gombo — aussi : gombo, okra, févi, fetri
- `sauce_crincrin` : Sauce crincrin (corète) — aussi : crincrin, ewedu, adémè
- `sauce_pistache` : Sauce pistache / egusi — aussi : egusi, agoussi, sauce pistache
- `sauce_claire` : Sauce claire / soupe de poisson — aussi : pepper soup, light soup, sauce claire
- `ndole` : Ndolé — aussi : ndole
- `sauce_feuille_manioc` : Sauce feuilles de manioc (saka-saka) — aussi : saka saka, pondu, pondou, sauce feuille manioc

### snack (3)
- `arachides_grillees` : Arachides grillées — aussi : cacahuètes, arachides, kouli-kouli
- `beignet_farine` : Beignet de farine (botokoin, puff-puff) — aussi : botokoin, puff puff, gaou, beignet
- `chips_plantain` : Chips de plantain — aussi : chips banane, plantain chips

### sucre (2)
- `lait_concentre` : Lait concentré sucré — aussi : lait concentré, lait sucré
- `sucre` : Sucre — aussi : sucre en poudre, morceau de sucre

## Vérification avant de rendre

- Autant de sections `##` que de clés de la liste, pas une de plus.
- Aucune clé inventée.
- Chaque section a les six champs, dans l'ordre.
- Les clés citées dans « confusions » existent dans la liste.
- Les plats des familles qui se ressemblent (pâtes, sauces rouges, sauces vertes) ont au moins une
  confusion documentée. S'ils n'en ont aucune, c'est que le travail n'est pas fait.
