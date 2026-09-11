# Ola'Snack — menu numérique

Version numérique du menu papier d'**Ola'Snack** (Haie-Vive, Cotonou — Bénin),
saisie à partir du dépliant 3 volets fourni en PDF.

Site statique, sans dépendance ni étape de build : HTML, CSS et JavaScript
natifs, alimentés par un seul fichier de données.

## Ce que fait le site

- **67 articles** répartis en **10 rubriques**, avec descriptions et prix.
- **32 photos** extraites du menu d'origine ; les articles sans photo affichent
  une vignette neutre pour garder l'alignement.
- **Recherche instantanée** par plat, rubrique ou ingrédient, insensible aux
  accents (« cesar » trouve « Salade César »).
- **Navigation par rubrique** collante, avec surlignage de la rubrique visible.
- **Prix R / M** (regular / mega) affichés séparément pour les sandwichs et
  les burgers, chacun commandable indépendamment.
- **Panier** qui compose un récapitulatif et l'ouvre dans **WhatsApp** sur le
  numéro MOOV du restaurant.
- Responsive (testé à 390 px), thème clair/sombre automatique, et une feuille
  d'impression qui masque les éléments interactifs.

## Lancer en local

Le site charge `data/menu.json` via `fetch`, il faut donc un serveur HTTP
(l'ouverture directe du fichier `index.html` est bloquée par le navigateur) :

```sh
python3 -m http.server 8000
# puis http://localhost:8000
```

Pour mettre en ligne, publier le dossier tel quel (GitHub Pages, Netlify,
n'importe quel hébergement statique) : il n'y a rien à compiler.

## Structure

```
index.html            page unique
assets/css/styles.css mise en forme
assets/js/app.js      rendu, recherche, panier
data/menu.json        toutes les données du menu  ← seul fichier à modifier
assets/img/           photos extraites du PDF
source/               le menu PDF d'origine
tools/verify.py       compare data/menu.json au PDF
```

## Modifier le menu

Tout se trouve dans `data/menu.json` ; la page se met à jour toute seule.
Un article a soit un prix unique, soit des prix par taille :

```jsonc
{ "id": "taboule", "name": "Taboulé", "description": "persil, menthe…",
  "price": 5000, "image": null }

{ "id": "taouk", "name": "Taouk", "description": "brochette de poulet…",
  "prices": { "R": 2500, "M": 4000 }, "image": "assets/img/taouk.jpg" }
```

Champs annexes : `priceAlt` (second prix affiché), `unconfirmed: true`
(ajoute le badge « à confirmer »), `note` et `image` au niveau d'une rubrique.
Les coordonnées et le numéro WhatsApp sont dans l'objet `restaurant`.

## Fidélité au menu d'origine

`tools/verify.py` relit le PDF et vérifie que chaque nom, description et prix
de `data/menu.json` s'y retrouve, que les images référencées existent, et que
le nombre de prix saisis est égal au nombre de prix du PDF :

```sh
pip install pypdf && python3 tools/verify.py
# 67 articles / 93 prix vérifiés
# ✓ noms, descriptions, prix et images concordent avec le menu source
```

Points à faire confirmer par le restaurant — ils viennent du document source,
pas de la saisie :

- **Grillades** : le PDF donne deux valeurs selon la photo
  (demi poulet 5000 F ou 6000 F ; poulet entier 9000 F ou 10 000 F). Les deux
  sont affichées avec un badge « à confirmer ».
- **Manakish saj** : rubrique reconstituée à partir de deux photos
  partiellement différentes du menu.
- Le PDF ne contient **aucun horaire d'ouverture ni zone de livraison** ;
  ils ne figurent donc pas sur le site.

Quatre photos du PDF (Double Cheese Burger, Le Titan, et les bandeaux
Grillades et Kneffe) mesurent moins de 40 px de côté et ont été écartées :
trop petites pour être affichées proprement. Ces articles utilisent la
vignette neutre. Les remplacer par de vraies photos ne demande que de déposer
un fichier dans `assets/img/` et de renseigner `image` dans le JSON.
