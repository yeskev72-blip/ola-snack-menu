# Comptes Instagram et TikTok de Calbasse

Tout ce qu'il faut pour ouvrir les deux comptes. Les textes sont prêts à copier,
et tiennent dans les limites de chaque plateforme (Instagram 150 caractères,
TikTok 80). Recompter après toute modification : au-delà, la fin est coupée.

## Photo de profil

Trois versions, toutes en 1080 × 1080. Les deux plateformes recadrent en cercle :
rien d'important ne doit toucher les coins.

| Fichier | Quand l'utiliser |
| --- | --- |
| `photo-profil-B-terracotta.png` | **Par défaut.** Le fond coloré détache la vignette du blanc de l'interface, et la calebasse reste lisible jusqu'à 40 px. |
| `photo-profil-A-creme.png` | Reprend exactement l'icône de l'app. Son fond crème se fond dans les interfaces claires. |
| `photo-profil-C-avec-nom.png` | Pour une bannière ou une vignette de vidéo, pas pour la photo de profil : le nom devient illisible en petit. |

`photo-profil.html` est la source. Pour régénérer après un changement de couleur :
ouvrir le fichier dans un navigateur et faire une capture de chaque carré.

## Nom affiché

Le champ « nom » est indexé par la recherche des deux plateformes, pas le pseudo.
Il doit donc contenir les mots que les gens tapent — mais il est **limité à 30 caractères
des deux côtés**, et au-delà la fin est coupée sans avertissement.

Le même des deux côtés, 27 caractères :

```
Calbasse · Calories Afrique
```

Il garde les deux mots qui comptent pour la recherche, « calories » et « Afrique », avec
trois caractères de marge. Autres possibilités tenant dans la limite, à recompter après
toute modification :

| Nom | Caractères |
| --- | --- |
| `Calbasse · Calories Afrique` | 27 |
| `Calbasse · Calories en photo` | 28 |
| `Calbasse · Calories des plats` | 29 |
| `Calbasse · Calories du maquis` | 29 |
| `Calbasse · Calories africaines` | 30, sans marge |

## Pseudo

Le même des deux côtés, par ordre de préférence :
`calbasse.app`, `calbasse_app`, `calbasseapp`, `calbasse.ci`.

## Bio

### Instagram (150 caractères)

Avec le lien dans le champ prévu (recommandé) — 148 caractères :

```
Tes calories en une photo 📸
Attiéké, riz gras, alloco, sauce graine : l'app connaît nos plats.
Installation gratuite ⬇️  Un souci ? Écris-moi en DM.
```

Variante sans lien, distribution par message — 146 caractères :

```
Tes calories en une photo 📸
Attiéké, riz gras, alloco, sauce graine : l'app connaît nos plats.
✉️ Écris-moi en DM pour recevoir l'appli (gratuit).
```

Champ *Lien* : `https://calbasse.netlify.app/apk`

### TikTok (80 caractères)

Avec lien — 64 caractères :

```
Tes calories en une photo. Nos plats reconnus.
Appli gratuite ⬇️
```

Sans lien — 65 caractères :

```
Tes calories en une photo.
Écris-moi en DM pour l'appli (gratuit)
```

Le champ *Site web* de TikTok n'apparaît que sur un compte Business. Passer le
compte en Business dès l'ouverture (Paramètres → Gérer le compte → Passer à un
compte Business), sinon le lien reste en texte non cliquable.

## Réglages à faire à l'ouverture

- Compte **professionnel / Business** des deux côtés : c'est ce qui donne accès
  aux statistiques et au champ lien de TikTok.
- Instagram : renseigner la catégorie *Application mobile* et l'adresse de
  contact `ruvemes@gmail.com`.
- Épingler le trailer (`marketing/calbasse-trailer.mp4`) en premier post.
- Instagram, story à la une « Installer » : la capture des trois étapes de
  l'installation, gardée en permanence sur le profil.

## À ne pas écrire

L'app estime des calories à partir d'une photo ; elle ne soigne pas et ne fait
pas maigrir. Une promesse de perte de poids chiffrée est fausse, et les deux
plateformes restreignent la portée des comptes qui en font.
