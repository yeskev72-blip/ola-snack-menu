# Calebasse

Application **Android** de suivi calorique par photo, pensée pour l'Afrique francophone
(marché de départ : Bénin / Cotonou). On prend son plat en photo, on peut dire ce qu'il contient,
l'IA identifie les éléments et les portions, et **l'app calcule les calories avec une table de plats
locaux** (attiéké, pâte de maïs, sauce graine, amiwo, poisson braisé…), pas avec des chiffres inventés
par le modèle.

- **App** : Expo SDK 57 (React Native, TypeScript strict, Expo Router), interface en français
- **Backend** : Supabase (Auth, Postgres avec RLS, Edge Functions, Storage facultatif)
- **IA** : Gemini (`gemini-3.8-flash` par défaut), appelé **uniquement** depuis une Edge Function
- **Build** : EAS Build, profils produisant un **APK** à distribuer directement

> **Mise en route, secrets et build de l'APK : [`docs/SETUP.md`](docs/SETUP.md)** (liste de contrôle
> de tout ce qui demande tes identifiants, puis pas à pas).

## Fonctionnalités

- **Comptes** : mode invité (sans e-mail), inscription par e-mail avec code à 6 chiffres, conversion
  invité → compte sans perte de données, suppression du compte et de toutes les données.
- **Onboarding** : objectif, informations corporelles, activité ; cible calculée avec Mifflin-St Jeor, ajustable.
- **Scan** : photo (caméra ou galerie) compressée à 1024 px / JPEG 0,7, indice facultatif, quota restant affiché.
- **Résultat modifiable** : éléments détectés, questions de clarification (une relance gratuite), quantités en
  grammes ou en repères locaux (louche, boule, bol…), ajout depuis la table, fourchette de calories si
  l'estimation est incertaine, éléments hors table marqués « estimé ».
- **Journal du jour** : anneau des calories restantes, macros, repas par type ; détail et suppression d'un repas.
- **Historique** : calories par jour sur 7 et 30 jours avec la cible, moyenne, détail par journée.
- **Hors ligne** : journal consultable et enregistrable sans réseau (saisie sans photo), synchronisé au retour
  du réseau ; le scan IA, lui, exige internet et le dit clairement.
- **Quota** : invité 1, gratuit 3, premium 30 scans par jour (heure du Bénin), vérifié côté serveur.
- **Corrections** : chaque écart entre la prédiction de l'IA et la saisie finale est enregistré pour améliorer la table.

## Architecture

```
Téléphone (APK)                                   Supabase
┌───────────────────────────────┐   JWT    ┌──────────────────────────────────────┐
│ Expo Router · écrans           │ ───────▶ │ Edge Function analyze-meal           │
│ SQLite : journal local + file  │          │  ├ vérifie le jeton, consomme le quota│
│ Cache : table des plats        │          │  ├ charge foods, appelle Gemini ─────┼─▶ Gemini
│ Calcul kcal/macros (foods)     │          │  └ valide le JSON, journalise tokens │   (clé dans
│ Clé anon Supabase seulement    │ ◀─────── │ Postgres + RLS : profils, repas,     │    les secrets)
└───────────────────────────────┘  synchro │   éléments, corrections, quota…      │
                                            │ Edge Function delete-account         │
                                            └──────────────────────────────────────┘
```

1. L'app envoie la photo compressée et l'indice à `analyze-meal` avec le jeton de l'utilisateur.
2. La fonction consomme un scan (atomique, en SQL), charge la table `foods` et appelle Gemini avec un
   **schéma JSON** qui limite `food_key` aux plats connus (ou `autre`).
3. La réponse est validée strictement ; une seule relance si elle est invalide ; en cas d'échec, le scan est rendu.
4. L'app calcule les calories avec la table `foods` (`src/lib/nutrition.ts`). Les valeurs de l'IA ne servent
   que pour un élément `autre`, affiché « estimé ».
5. Si l'IA pose des questions, l'app relance **une fois**, gratuitement, avec la **même** photo
   (empreinte SHA-256 vérifiée) et les réponses.
6. Les repas sont écrits d'abord dans SQLite (`src/lib/meals.ts`) puis envoyés à Supabase au retour du réseau
   (identifiants générés par l'app : aucune duplication si la synchro est rejouée). Les 35 derniers jours
   sont rapatriés depuis le serveur (nouveau téléphone), sans écraser un repas local pas encore envoyé.

## Variables d'environnement

| Où | Variable | Contenu |
|---|---|---|
| App (`.env` en local, EAS en build) | `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase (publique) |
| | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé `anon` / publishable (publique, sécurité assurée par la RLS) |
| Secrets Supabase (`supabase/functions/.env`) | `GEMINI_API_KEY` | clé Gemini — **jamais dans l'app** |
| | `GEMINI_MODEL` | défaut `gemini-3.8-flash`, modifiable sans republier l'app |
| | `GEMINI_TEMPERATURE` | défaut `0.3` ; `default` = valeur du modèle |
| | `GEMINI_THINKING_LEVEL` | défaut `low` (coût et latence) |
| | `STORE_PHOTOS` | `false` par défaut ; `true` conserve les photos des utilisateurs consentants |
| Fournies par Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | utilisées par les Edge Functions seulement |

## Développement

```bash
npm install
cp .env.example .env     # remplir l'URL et la clé anon Supabase
npm start                # serveur Expo (Expo Go ou build de développement)
```

| Commande | Rôle |
|---|---|
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint (config Expo + React Compiler) |
| `npm test` | tests : calories, portions, corrections, journées, SQL local, logique des Edge Functions |
| `npm run db:seed` | valide `supabase/seed/foods.json` (cohérence kcal/macros) et régénère `supabase/seed.sql` |
| `npm run check:secrets` | vérifie qu'aucune clé secrète n'est dans le bundle de l'app |
| `scripts/test-db.sh` | migrations + seed + tests RLS sur un PostgreSQL vide (`DATABASE_URL`) |
| `scripts/test-analyze-meal.sh photo.jpg "indice"` | appelle la fonction d'analyse déployée avec `curl` |

Edge Functions (Deno 2) : `deno check`, `deno lint` et `deno test` dans `supabase/functions`.
La CI GitHub (`.github/workflows/ci.yml`) lance tout cela à chaque push.

Le nom de l'app se change uniquement dans `src/brand.json`. L'identifiant Android `com.calebasse.app`
(`app.config.ts`) ne doit plus changer une fois l'app publiée.

## Build de l'APK (résumé)

```bash
npx eas-cli@latest login
npx eas-cli@latest init                    # puis coller le projectId dans EAS_PROJECT_ID (app.config.ts)
npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <clé anon>
npx eas-cli@latest build -p android --profile preview
```

Le lien de téléchargement de l'APK s'affiche à la fin du build et reste sur expo.dev (*Projects > calebasse > Builds*).
Détails, profil `production`, versions et recette : [`docs/SETUP.md`](docs/SETUP.md), étapes 6 et 7.

Permissions Android demandées : **caméra** uniquement (plus le stockage, limité à Android 12 et moins,
pour la galerie) ; micro, superposition et vibreur sont retirés du manifeste. Android 7.0 minimum.

## Organisation

```
src/
  app/                routes Expo Router (un fichier = un écran)
    (auth)/           accueil, connexion, inscription, code
    (onboarding)/     objectif, infos corporelles, cible
    (tabs)/           Journal, Scanner, Historique, Profil
    result.tsx        résultat d'un scan · item-editor · food-picker
    meal/[id].tsx     détail d'un repas · day/[day].tsx détail d'une journée
    profile-edit.tsx  modification du profil · link-account.tsx invité → compte
  components/         composants d'interface (boutons, anneau, graphique…)
  i18n/               textes (fr.ts) et fonction t() typée
  lib/                Supabase, calculs purs testés, journal local, synchro, analyse
  state/              session, brouillon d'onboarding, scan en cours
  brand.json          nom de l'app
supabase/
  migrations/         schéma SQL versionné (RLS partout)
  seed/foods.json     table des plats (source) · seed.sql (généré)
  functions/          analyze-meal, delete-account, logique partagée (_shared)
  templates/          e-mails avec code à 6 chiffres
  tests/              tests RLS/quota + imitation Supabase pour PostgreSQL nu
docs/
  SETUP.md            mise en route, secrets, build APK, recette
  FOODS_TODO.md       valeurs nutritionnelles à faire vérifier (FAO)
```

## Limites connues

- **Valeurs nutritionnelles non vérifiées** : les 69 plats ont des valeurs approximatives (`verified = false`),
  à contrôler avec la table FAO de l'Afrique de l'Ouest (`docs/FOODS_TODO.md`).
- **Journée** : le journal suit l'heure du téléphone, le quota l'heure du Bénin (identiques si le téléphone
  est à l'heure du Bénin).
- **E-mails** : le serveur par défaut de Supabase ne sert qu'aux tests ; SMTP à configurer avant diffusion.
- **CAPTCHA** des invités non branché dans l'app.
- **Interface** : français seulement (les textes sont prêts pour d'autres langues dans `src/i18n`).

Hors périmètre de ce MVP : paiement mobile money, coach IA, suivi d'entraînement, code-barres, iOS, web.
