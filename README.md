# Calebasse

Application Android de suivi calorique par photo, pensée pour l'Afrique francophone
(marché de départ : Bénin / Cotonou). On prend son plat en photo, l'IA identifie les
éléments et les portions, et les calories sont calculées à partir d'une table de plats locaux.

Stack : Expo SDK 57 (React Native, TypeScript strict, Expo Router), Supabase, Gemini
(appelé uniquement depuis une Edge Function), EAS Build pour produire l'APK.

## État d'avancement

- [x] Phase 1 : initialisation, navigation, i18n, thème
- [x] Phase 2 : Supabase (migrations, RLS, seed des plats, auth invité + compte, onboarding)
- [x] Phase 3 : Edge Function `analyze-meal` (Gemini, sortie JSON validée, quota, suivi des tokens)
- [x] Phase 4 : scan → résultat → édition → enregistrement (journal local + synchro, corrections)
- [x] Phase 5 : journal, historique (7 et 30 jours), profil, suppression du compte, synchro dans les deux sens
- [ ] Phase 6 : EAS, build APK, documentation complète

## Mise en route

Tout ce qui demande tes identifiants (Supabase, Expo) est décrit pas à pas dans
[`docs/SETUP.md`](docs/SETUP.md).

## Développement

```bash
npm install
cp .env.example .env   # puis remplir l'URL et la clé anon Supabase
npm start              # serveur de développement Expo
npm run typecheck      # TypeScript strict
npm run lint
npm test               # tests unitaires (calcul de la cible calorique…)
npm run db:seed        # valide supabase/seed/foods.json et régénère supabase/seed.sql
npm run check:secrets  # vérifie qu'aucune clé secrète n'est dans le bundle de l'app
```

Tests de sécurité de la base (RLS, quota) : `psql "$DATABASE_URL" -f supabase/tests/rls_test.sql`.

Tester la fonction d'analyse déployée : `scripts/test-analyze-meal.sh photo.jpg "indice"` (voir `docs/SETUP.md`, étape 6).

## Analyse d'un repas

1. L'app envoie la photo compressée (JPEG base64) et l'indice facultatif à l'Edge Function `analyze-meal`.
2. La fonction vérifie le jeton, consomme un scan du quota (invité 1, gratuit 3, premium 30 par jour),
   charge la table `foods` et appelle Gemini avec un schéma JSON qui limite `food_key` aux plats connus (ou `autre`).
3. La réponse est validée strictement (une seule relance si elle est invalide) ; en cas d'échec, le scan est rendu.
4. Les calories ne viennent pas du modèle : l'app les calcule avec la table `foods`
   (`src/lib/nutrition.ts`, mise en cache sur le téléphone). Pour `autre`, l'estimation du modèle
   est utilisée et affichée « estimé ». Fourchette affichée si la confiance pondérée est < 0,7.
5. Si Gemini pose des questions, l'app peut relancer **une fois**, gratuitement, avec les réponses
   (`scan_id` + `answers`, en renvoyant la **même** photo et l'indice ; l'empreinte SHA-256 de la photo est vérifiée).

## Organisation

```
src/
  app/              routes Expo Router (un fichier = un écran)
    (auth)/         accueil : invité, connexion, inscription
    (onboarding)/   objectif, infos corporelles, cible calorique
    (tabs)/         Journal, Scanner, Historique, Profil
    result.tsx      résultat d'un scan
  components/       composants d'interface réutilisables
  i18n/             textes (fr.ts) et fonction t()
  lib/              Supabase, calculs, validation
  state/            session (Supabase Auth + profil en cache), brouillon d'onboarding
  brand.json        nom de l'app (seul endroit à modifier)
  config.ts         réglages (fuseau, quotas, compression photo)
  theme.ts          couleurs, espacements, tailles
supabase/
  migrations/       schéma SQL versionné (RLS partout)
  seed/foods.json   table des plats locaux (source du seed)
  seed.sql          généré par scripts/seed-foods.mjs
  functions/        Edge Functions (Deno) : analyze-meal + logique partagée testée
  templates/        e-mails avec code à 6 chiffres
  tests/            tests RLS et quota
docs/
  SETUP.md          mise en route Supabase / Expo
  FOODS_TODO.md     valeurs nutritionnelles à vérifier
```

Le nom de l'application se change uniquement dans `src/brand.json`. L'identifiant Android
`com.calebasse.app` est défini dans `app.config.ts` et ne doit plus changer après publication.

## Journal hors ligne

Les repas sont écrits d'abord dans SQLite sur le téléphone (`src/lib/meals.ts`), puis envoyés à Supabase
dès que le réseau revient, au retour de l'app au premier plan ou à l'ouverture d'un écran
(identifiants générés par l'app : la synchro peut être rejouée sans doublon).
Les suppressions suivent le même chemin. Les repas des 35 derniers jours sont rapatriés depuis le serveur
(nouveau téléphone, réinstallation) sans jamais écraser un repas local pas encore envoyé.
La journée affichée suit l'heure du téléphone.
Sans réseau, on peut toujours saisir un repas « sans photo » à partir de la table des plats en cache.
Chaque différence entre la prédiction de l'IA et la saisie finale est enregistrée dans `corrections`.
