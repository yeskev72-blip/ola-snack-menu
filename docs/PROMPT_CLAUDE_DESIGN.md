# Prompt pour Claude Design : refonte de Calbasse

À copier tel quel dans Claude Design.

---

Tu es designer produit mobile senior. Refais entièrement le design de **Calbasse**, une application Android de suivi
des calories par photo, pensée pour l'Afrique francophone (Bénin, Côte d'Ivoire, Sénégal, Cameroun…).

## Référence de style

Inspire-toi de l'**expérience et du langage visuel de Cal AI** (l'app de comptage de calories par photo), sans
copier son logo, son nom, ses illustrations ni ses textes :

- interface très épurée, beaucoup d'espace blanc, fond clair presque blanc ;
- **gros chiffres en gras** comme élément principal (calories restantes, grammes) ;
- **cartes blanches à coins très arrondis** (20 à 24 px) avec une ombre douce, sans bordure visible ;
- **anneaux de progression circulaires** pour les calories et pour chaque macronutriment ;
- boutons principaux **pleins, en forme de pilule**, contrastés, pleine largeur en bas d'écran ;
- barre d'onglets en bas avec un **bouton central flottant « + / scanner »** plus grand que les autres ;
- en haut de l'accueil, un **sélecteur de jours de la semaine** (pastilles, le jour courant mis en avant) ;
- onboarding **une question par écran**, grandes cartes d'options, barre de progression fine en haut ;
- liste des repas du jour sous forme de cartes avec la **photo du plat** à gauche, nom, heure, calories et macros ;
- typographie sans empattement moderne et géométrique, très lisible, avec une hiérarchie forte.

## Identité Calbasse (à garder)

- **Nom** : Calbasse (jeu de mots avec « calebasse »). **Logo** : une calebasse vue de dessus, en cercles concentriques
  (bord brun #9C4A1E, bord intérieur #D9A55B, intérieur #F3D9A4, petit reflet clair). Tu peux le moderniser ou le
  simplifier, mais il doit rester une calebasse.
- **Couleurs** : garde une **touche chaude et terreuse** qui rappelle la calebasse comme couleur d'accent (brun
  #9C4A1E, ocre #C98A0B, crème #FBF6EE). Le style reste globalement clair et minimal, comme Cal AI : l'accent sert pour
  les éléments clés (bouton scanner, anneau de calories, états actifs), pas partout.
- **Macros** : trois couleurs distinctes et accessibles pour protéines, glucides et lipides, avec une icône par macro.
- **Ton** : chaleureux, simple, tutoiement, français d'Afrique de l'Ouest naturel (« Qu'y a-t-il dans ce plat ? »).

## Contraintes impératives

- **Android d'abord**, téléphones d'entrée de gamme (écran 360 × 800 dp), usage souvent en plein soleil : **contraste
  élevé** (WCAG AA minimum), texte de base 16 à 17 px, **cibles tactiles de 48 dp minimum** (56 pour les boutons).
- **Tout en français.** Nombres au format français : virgule décimale (« 52,3 kcal »), espace pour les milliers
  (« 2 000 FCFA »).
- Contenu **local** dans les maquettes : attiéké, pâte de maïs, amiwo, sauce graine, sauce arachide, poisson braisé,
  alloco, riz gras, igname pilée ; unités locales (louche, boule, bol, morceau) en plus des grammes.
- Mode clair prioritaire ; propose un mode sombre en option.
- L'app est construite en **React Native (Expo)** : composants simples et réalisables, pas d'effets impossibles
  (flou lourd, dégradés complexes partout). Icônes d'une seule famille cohérente (trait arrondi).

## Écrans à dessiner

1. **Accueil / connexion** : bienvenue (logo, promesse, « Commencer en invité », « J'ai un compte »),
   connexion, inscription, saisie du **code à 6 ou 8 chiffres** reçu par e-mail.
2. **Onboarding (3 à 5 écrans)** : objectif (perdre, maintenir, prendre du poids), sexe, âge, taille, poids,
   niveau d'activité, puis écran « Ta cible : 2 100 kcal / jour » avec répartition des macros, modifiable.
3. **Journal (accueil)** : sélecteur de jours, grande carte « calories restantes » avec anneau, trois petites cartes
   macros avec anneaux (protéines, glucides, lipides : restant ou consommé), liste des repas du jour par type
   (petit-déjeuner, déjeuner, dîner, en-cas) avec photo, et un **message hors ligne** discret si pas de réseau.
4. **Scanner** : prise de photo plein écran avec cadre de visée, bouton galerie, champ facultatif « Qu'y a-t-il dans
   ce plat ? », compteur « Scans restants aujourd'hui : 2 », état « Analyse en cours… » soigné (animation, pas un
   simple spinner), états d'erreur (pas de réseau, service saturé, quota atteint avec proposition Premium).
5. **Résultat du scan** : photo du plat en haut, total des calories en gros, macros, liste des aliments détectés
   (nom, quantité en grammes ou en repères locaux, calories), badge « estimé » pour un aliment hors table,
   **fourchette** (« 650 à 780 kcal ») quand l'IA est peu sûre, questions de clarification sous forme de puces
   (« Sauce à l'huile de palme ou à la tomate ? »), boutons « Ajouter un aliment » et « Enregistrer ».
6. **Modifier un aliment** : nom, quantité avec boutons − / +, bascule grammes ↔ repères locaux (louche, boule…),
   calories recalculées en direct.
7. **Choisir un aliment** : recherche et liste des plats locaux (nom, kcal pour 100 g).
8. **Historique** : graphique en barres sur 7 et 30 jours avec la ligne de cible, moyenne, détail d'une journée.
9. **Détail d'un repas** et **détail d'une journée**.
10. **Profil** : prénom, e-mail, carte « Abonnement » (Gratuit : 2 scans par jour / Premium jusqu'au 25/10/2026 /
    Premium permanent), infos corporelles, objectif et cible, partage des photos (interrupteur), langue, se
    déconnecter, supprimer le compte (zone de danger).
11. **Premium (paywall)** : bénéfices (30 scans par jour au lieu de 2), choix **Mensuel 2 000 FCFA / mois** ou
    **Annuel 20 000 FCFA / an** (l'annuel mis en avant, « 2 mois offerts »), choix du **pays** (Bénin, Côte d'Ivoire,
    Sénégal, Cameroun…), prénom, nom, numéro mobile money avec indicatif, bouton « Payer », mention « Paiement
    sécurisé par CinetPay — mobile money ou carte, sans renouvellement automatique », état « J'ai payé : actualiser ».
12. **États transverses** : écran de chargement, écran vide (« Aucun repas aujourd'hui — scanne ton premier plat »),
    toasts de confirmation, messages d'erreur.

## Livrables attendus

1. **Système de design** sous forme de jetons, dans cette structure (je les reporterai dans mon fichier de thème) :
   - `colors` : background, surface, surfaceAlt, border, text, textMuted, primary, primaryPressed, onPrimary, accent,
     success, danger, protein, carbs, fat (+ équivalents mode sombre) ;
   - `spacing` (xs, sm, md, lg, xl), `radius` (sm, md, lg, pill), `font` (tailles et graisses : small, body, large,
     title, display), police conseillée (Google Fonts, gratuite), ombres des cartes.
2. **Bibliothèque de composants** : bouton (principal, secondaire, fantôme), carte, anneau de progression (grand
   calories, petit macro), puce/option, champ de saisie, barre d'onglets avec bouton central, sélecteur de jours,
   carte repas, ligne d'aliment, graphique en barres, bandeau d'information et d'erreur.
3. **Maquettes haute fidélité** de tous les écrans ci-dessus au format 360 × 800, avec des données réalistes locales.
4. Pour chaque écran, **2 à 3 lignes d'intention** (ce qui est mis en avant et pourquoi) et les points d'attention
   pour l'implémentation en React Native.
