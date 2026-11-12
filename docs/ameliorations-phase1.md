# Ce que la recherche Phase 1 dit d'améliorer dans Calbasse

Lecture des livrables Phase 1 (ICP, points de douleur et JTBD, solutions existantes) confrontée
au code actuel. Chaque point cite la douleur, sa fréquence dans les 20 entretiens, et l'endroit
exact du code concerné.

Les enregistrements WhatsApp des entretiens n'ont pas pu être écoutés ; l'analyse repose sur les
PDF de synthèse.

---

## 1. La cible de protéines ne dépend pas du poids du corps

**Douleur** : « ne sait pas combien de protéines il mange » — c'est la définition même de l'ICP
(« le sportif urbain de 18 à 25 ans… qui va à la salle au moins 3 fois par semaine pour prendre
de la masse »). Douleur « ne sait pas si on couvre ses besoins » : 10/20, urgence 4/5.

**Code** : `src/lib/calories.ts`

```ts
export const MACRO_SPLIT = { proteines: 0.25, glucides: 0.5, lipides: 0.25 } as const;
proteines: Math.round((kcal * MACRO_SPLIT.proteines) / 4)
```

La cible protéines est un pourcentage des calories. Elle ne regarde jamais le poids. Conséquences
chiffrées :

| Profil | Cible kcal | Protéines visées | g/kg |
|---|---|---|---|
| 70 kg, prise de masse, actif | 2 900 | 181 g | **2,6 g/kg** |
| 70 kg, maintien | 2 200 | 138 g | 2,0 g/kg |
| 90 kg, perte, sédentaire | 1 600 | 100 g | **1,1 g/kg** |

La fourchette usuelle en prise de masse est 1,6–2,2 g/kg. On demande donc trop à celui qui mange
beaucoup, et trop peu à celui qui sèche — exactement les deux profils de l'ICP.

**À faire** : dériver les protéines du poids (`poids_kg × 1,8` en prise, `× 2,0` en perte pour
préserver le muscle), puis répartir le reste des calories entre glucides et lipides. C'est une
modification locale de `macroTargets`, testable dans `calories.test.ts`.

---

## 2. L'écran du jour met les calories en premier, pas les protéines

**Douleur** : l'ICP est défini par les protéines. Le résultat mesurable de la Phase 1 est
« jauge consultée au moins une fois par jour ».

**Code** : `src/app/(tabs)/index.tsx` — le grand anneau (`Ring`, 112 px) affiche les kcal
restantes ; les protéines sont une barre secondaire. `src/app/(tabs)/history.tsx` — la moyenne
mise en avant est en kcal, la ligne de cible est en kcal, et « jours dans la cible » compte les
kcal. Les protéines n'obtiennent jamais de verdict, ni au jour ni à la semaine.

**À faire** : quand `objectif = 'prise'`, mettre les protéines dans l'anneau principal et les
calories en second ; dans l'historique, ajouter une moyenne protéines et compter les jours où la
cible protéines est atteinte.

---

## 3. Rien ne montre d'où vient un chiffre — c'est la seule douleur bloquante citée par 4 pros sur 4

**Douleur** : « doute sur la fiabilité des outils » — 10/20, urgence 4/5, **bloquante**, et
unanime chez les professionnels. L'analyse concurrentielle le confirme deux fois : « sources des
valeurs » est une colonne où tous les concurrents sauf un disent non, et le risque listé est
« une erreur visible casse la confiance (“ultra fiable” exigé) ».

**Code** : `src/lib/foodStatus.ts` + `src/components/FoodBadge.tsx` distinguent déjà vérifié et
estimé. Mais il n'existe aucun écran qui réponde à « pourquoi 480 kcal ? ». La planche 8 du
nouveau design prévoyait « Détail et sources » ; elle n'est pas implémentée.

**À faire, en priorité sur tout le reste** : l'écran détail d'un repas, listant par ingrédient les
grammes retenus, la valeur pour 100 g, sa source, et un bouton « signaler une erreur ». C'est le
seul différenciateur que les concurrents ne peuvent pas copier vite, et c'est ce qui débloque les
coachs.

---

## 4. Le « moins de 30 secondes » n'est mesuré nulle part

**Douleur** : « suivi trop lourd » 11/20 urgence 4/5 ; abandon des concurrents « en 5 jours à
3 semaines parce que c'est du travail ». Le résultat mesurable annoncé est **saisie < 30 s**.

**État** : rien ne chronomètre le parcours. Et avant le premier scan il y a cinq écrans
d'onboarding (`goal`, `body`, `measures`, `activity`, `target`).

**À faire** : mesurer le temps entre le déclencheur photo et le repas enregistré, et le vérifier
sur un vrai téléphone en 3G. Si l'on dépasse 30 s, c'est le chiffre qui pilote les arbitrages
suivants. Permettre aussi un premier scan avant l'onboarding (le mode invité existe, l'onboarding
le précède encore).

---

## 5. Un tiers de la photo envoyée ne sert à rien

**Douleur** : « langue, unités et data » — 4/20 seulement, mais classée **bloquante**, avec la
mention « peu de data ».

**Code** : `analyze-meal` reçoit `image_base64`. Le base64 ajoute 33 % d'octets à l'envoi, pour
rien. La photo est réduite à 1024 px de côté, qualité JPEG 0,7.

**À faire** : envoyer l'image en binaire plutôt qu'en base64 (−25 % de l'envoi, sans perte de
qualité), et offrir un « mode léger » à 768 px pour les forfaits serrés. Afficher aussi, une
fois, ce qu'un scan coûte en données : c'est rassurant et aucun concurrent ne le fait.

---

## 6. Le plat partagé n'est pas gérable

**Douleur** : « cuisine familiale » — 4/20, urgence 4/5. On mange dans un plat commun ; on ne sait
pas quelle part on a prise.

**État** : les portions se saisissent en repères locaux ou en grammes, mais il n'y a pas de
« j'ai pris un tiers du plat ».

**À faire** : un diviseur de portion sur l'écran résultat (÷2, ÷3, ÷4), à côté du réglage d'huile.
C'est peu de code et ça répond à une douleur urgente.

---

## 7. Le prix tient sur une seule personne — le coach est le vrai payeur

**Recherche** : « frein du prix » 5/20, bloquante. Un seul interviewé sur seize accepte clairement
2 000 FCFA/mois, et encore « si elle est vraiment précise ». L'ICP secondaire, le coach, paie
20 000 à 35 000 FCFA par mois et amène 12 à 40 utilisateurs avec lui.

Le mode coach a été mis de côté volontairement. Il faut savoir que c'est, d'après la recherche
elle-même, le segment qui paie et qui recrute : le prix grand public ne tiendra pas seul. Et le
point 3 (sources vérifiables) est le préalable à tout démarchage de coach.

---

## Ce qui est déjà bon et qu'il ne faut pas toucher

- **La table d'aliments locaux avec sources** : 69 aliments sur 71 vérifiés. C'est la défense
  annoncée dans l'analyse concurrentielle, et elle existe vraiment.
- **Le réglage d'huile de cuisson**, livré cette semaine : il répond directement à « huile et
  calories cachées » (11/20, urgence 4/5), la troisième douleur la plus urgente.
- **Français, FCFA, hors-ligne, mode invité** : quatre cases où tous les concurrents disent non.

---

## Ordre proposé

1. Écran « Détail et sources » (douleur bloquante, unanime chez les pros, différenciateur).
2. Cible protéines fondée sur le poids (bug de fond pour l'ICP, correction courte).
3. Protéines en premier sur l'écran du jour et dans l'historique.
4. Mesure du temps de saisie, puis ce qu'elle révèle.
5. Envoi binaire de la photo et mode léger.
6. Diviseur de portion pour le plat partagé.
