# Féculents : valeurs à relever dans la table FAO

Les 22 féculents de la table, avec leurs valeurs **actuelles — approximatives**. Remplis les
quatre dernières colonnes depuis la *West African Food Composition Table* (FAO/INFOODS, 2019),
puis renvoie le tableau. Les valeurs sont pour **100 g**.

Pas besoin de tout faire d'un coup : chaque ligne renvoyée est une ligne corrigée, et le plat
perd sa pastille « à confirmer » dans l'app.

## Les trois pièges

**Forme consommée, jamais la matière première.** Le riz cuit absorbe de l'eau : il fait environ
130 kcal/100 g, contre 360 pour le riz cru. Prendre la ligne crue triplerait les calories
affichées. Cherche *cooked*, *boiled*, *prepared*. Même chose pour le manioc, l'igname, le mil.

**Colonne « available carbohydrate »**, pas « total carbohydrate ». La seconde inclut les
fibres, qui n'apportent pratiquement pas de calories.

**Le gari est l'exception.** Il se consomme sec, donc sa ligne sèche est la bonne. L'eba, lui,
est du gari gonflé d'eau : c'est une autre ligne, environ deux fois moins calorique.

Si un plat est absent de la table — l'amiwo, l'atassi ou l'akassa peuvent l'être — laisse la
ligne vide et signale-le. On la reconstruira à partir de ses ingrédients, recette documentée.

## Le tableau

| clé | plat | kcal actuelles | **kcal FAO** | **protéines** | **glucides** | **lipides** | nom et code FAO |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `riz_blanc` | Riz blanc cuit | 130 |  |  |  |  |  |
| `riz_jollof` | Riz jollof / riz au gras | 170 |  |  |  |  |  |
| `atassi` | Atassi (riz et haricots) | 150 |  |  |  |  |  |
| `attieke` | Attiéké | 157 |  |  |  |  |  |
| `pate_mais` | Pâte de maïs blanche (wɔ, owo) | 110 |  |  |  |  |  |
| `amiwo` | Amiwo (pâte rouge) | 150 |  |  |  |  |  |
| `akassa` | Akassa / agidi (pâte de maïs fermentée) | 80 |  |  |  |  |  |
| `igname_pilee` | Igname pilée (foufou d'igname) | 130 |  |  |  |  |  |
| `foufou_manioc` | Foufou de manioc | 155 |  |  |  |  |  |
| `gari` | Gari sec (semoule de manioc) | 360 |  |  |  |  |  |
| `eba` | Eba / piron (gari à l'eau chaude) | 150 |  |  |  |  |  |
| `haricots_niebe` | Haricots niébé cuits | 116 |  |  |  |  |  |
| `alloco` | Alloco (banane plantain frite) | 260 |  |  |  |  |  |
| `plantain_bouilli` | Banane plantain bouillie | 123 |  |  |  |  |  |
| `igname_bouillie` | Igname bouillie | 115 |  |  |  |  |  |
| `igname_frite` | Igname frite | 230 |  |  |  |  |  |
| `manioc_bouilli` | Manioc bouilli | 125 |  |  |  |  |  |
| `pain` | Pain (baguette) | 270 |  |  |  |  |  |
| `spaghetti` | Spaghetti cuits | 158 |  |  |  |  |  |
| `couscous_mil` | Couscous de mil (thiéré) | 140 |  |  |  |  |  |
| `bouillie_mil` | Bouillie de mil sucrée | 67 |  |  |  |  |  |
| `bouillie_mais` | Bouillie de maïs sucrée (akassa délayé) | 60 |  |  |  |  |  |

## Ce qui se passe ensuite

Je mets à jour `supabase/seed/foods.json`, je passe `verified` à `true` et je remplace la
source par la référence FAO réelle. Des tests vérifient alors chaque ligne : cohérence entre
les kcal et les macros à 15 % près, bornes physiques, et refus d'une ligne marquée vérifiée
sans source. Une virgule déplacée ou deux chiffres transposés sont rattrapés avant d'arriver
dans l'app.
