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

**Fait le 12 novembre 2026.** Mesuré sur les profils ci-dessus : 70 kg en prise passe de 2,9 à
1,8 g/kg, 90 kg en perte de 1,2 à 2,0 g/kg. Un plafond à 45 % des calories garde de quoi manger
autre chose quand le poids est élevé et la cible basse. Sans poids ni objectif — profil
incomplet — l'ancienne répartition en pourcentage s'applique telle quelle.

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

**Fait le 12 novembre 2026.** `src/lib/focus.ts` décide du chiffre mis en avant ; l'écran du jour
et l'historique le lisent tous les deux, pour ne pas juger la semaine sur un effort que la journée
ne mesure pas.

Les deux chiffres ne se lisent pas dans le même sens, et les écrans le montrent : un budget de
calories se décompte (« 864 kcal restantes », rouge au dépassement), une ration de protéines se
cumule (« 150 g · cible atteinte », vert). Une journée compte comme tenue à ± 10 % pour les
calories, mais dès 95 % de la cible pour les protéines — en manger plus n'a jamais été un écart.

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

**Instrumenté le 12 novembre 2026.** Chaque repas enregistré à partir d'une photo fraîche dépose
dans `public.scan_timings` la durée totale (de la photo choisie au repas enregistré) et celle de
trois étapes : préparation de la photo, analyse, relecture. S'y ajoutent le nombre d'essais, la
plateforme et le réseau. À lire dans le SQL Editor :

```sql
select * from public.scan_timings_daily order by day desc;
```

Limites à connaître en lisant les chiffres : le chronomètre part quand l'appareil photo rend
l'image, pas au déclencheur (ce temps-là appartient au système) ; un enregistrement fait sans
réseau n'envoie pas sa mesure ; sur le web le réseau est une classe de débit, pas la technologie.
Le premier scan avant l'onboarding reste à faire.

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

1. ~~Écran « Détail et sources »~~ — fait le 12 novembre 2026 : provenance par aliment,
   mention du réglage d'huile, et signalement d'une valeur (`public.food_reports`).
2. ~~Cible protéines fondée sur le poids~~ — fait le 12 novembre 2026 : `PROTEIN_PER_KG`
   (2,0 en perte, 1,8 en prise, 1,6 en maintien), plafonnée à 45 % des calories ; glucides et
   lipides se partagent le reste, et les parts affichées se lisent sur les grammes retenus.
3. ~~Protéines en premier sur l'écran du jour et dans l'historique~~ — fait le 12 novembre 2026 :
   `primaryMetric` met les protéines en grand quand l'objectif est la prise de masse, les
   calories passant en carte ; l'historique suit le même chiffre (moyenne, ligne de cible,
   journées tenues).
4. ~~Mesure du temps de saisie~~ — instrumentée le 12 novembre 2026 (`public.scan_timings`).
   Reste à lire ce qu'elle révèle après quelques jours d'usage réel, et le premier scan avant
   l'onboarding, qui n'est pas fait.
5. Envoi binaire de la photo et mode léger.
6. Diviseur de portion pour le plat partagé.
