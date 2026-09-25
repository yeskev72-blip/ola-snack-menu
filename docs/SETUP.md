# Mise en route et build de l'APK

Ce guide couvre tout ce qui demande **tes** identifiants : rien de cela n'est automatisé.
Compte environ 1 heure la première fois (dont 15 à 20 minutes d'attente pour le build).
Les libellés des tableaux de bord Supabase et Expo peuvent légèrement varier selon les versions.

## Ce que tu dois faire toi-même (liste de contrôle)

- [ ] Créer un projet **Supabase** (région Europe) et noter son URL, sa clé `anon` et le mot de passe de la base — étape 1
- [ ] Appliquer les migrations et charger la table des plats — étape 2
- [ ] Régler l'authentification (invités, confirmation par code, modèles d'e-mail) — étape 3
- [ ] Créer une clé **Gemini** sur Google AI Studio, l'envoyer dans les secrets Supabase, déployer les 2 fonctions — étape 4
- [ ] Remplir `.env` et tester avec Expo Go (facultatif mais conseillé) — étape 5
- [ ] Créer un compte **Expo**, relier le projet, déclarer les 2 variables publiques, lancer le build — étape 6
- [ ] Installer l'APK et dérouler la recette — étape 7
- [ ] Paiements Premium (Chariow) et ton compte en Premium permanent — [`docs/PAIEMENTS_CHARIOW.md`](PAIEMENTS_CHARIOW.md)
- [ ] Avant d'ouvrir l'app à d'autres personnes : SMTP, CAPTCHA, vérification des valeurs nutritionnelles — étape 9

> **Sans terminal ?** Les étapes 1 à 4 (Supabase) peuvent se faire entièrement dans le navigateur :
> suis [`docs/SUPABASE_TABLEAU_DE_BORD.md`](SUPABASE_TABLEAU_DE_BORD.md), puis reviens ici à l'étape 6.

Prérequis sur ton ordinateur : **Node.js 22** ou plus récent, et **Git**.

```bash
git clone <url-du-dépôt> calbasse && cd calbasse
npm install
```

## 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), crée un projet nommé `calbasse`.
   Région : **Europe (Paris `eu-west-3` ou Francfort `eu-central-1`)**, la plus proche de Cotonou.
2. Note le **mot de passe de la base** choisi à la création.
3. Dans *Project Settings > API*, relève :
   - l'**URL du projet** (`https://<ref>.supabase.co`) ;
   - la **clé `anon` / publishable** (publique, destinée à l'app).
   - Ne copie **jamais** la clé `service_role` / secret dans l'app, dans `.env` ni dans ce dépôt.

## 2. Créer les tables et charger les plats

```bash
npx supabase@latest login
npx supabase@latest link --project-ref <ref>        # le ref est dans l'URL : https://<ref>.supabase.co
npx supabase@latest db push --include-seed
```

`db push` applique `supabase/migrations/` (tables, RLS, quota, suivi des scans, bucket photos).
`--include-seed` charge `supabase/seed.sql` : 69 plats aux valeurs **approximatives** (voir `docs/FOODS_TODO.md`).
Plus tard, après une modification de `supabase/seed/foods.json` : `npm run db:seed` puis la même commande.

Vérification facultative : dans *SQL Editor*, colle le contenu de `supabase/tests/rls_test.sql` et exécute-le.
La dernière ligne doit afficher « Tous les tests RLS sont passés » (tout est annulé à la fin, rien n'est conservé).

## 3. Réglages d'authentification (tableau de bord Supabase)

Dans *Authentication* :

1. **Sign In / Providers**
   - Active **Allow anonymous sign-ins** (mode invité).
   - Fournisseur **Email** : actif, avec **Confirm email** activé.
   - Longueur minimale du mot de passe : **8**.
2. **Emails > Templates** : l'app demande un **code** (6 à 10 chiffres ; Supabase en envoie 6 ou 8 selon le réglage *Email OTP Length* du fournisseur Email), pas un lien. Remplace le contenu de :
   - **Confirm signup** par `supabase/templates/confirmation.html` ;
   - **Change email address** par `supabase/templates/email_change.html`.
   (Les deux contiennent `{{ .Token }}` : c'est ce qui affiche le code.)
3. **Emails > SMTP Settings** : **obligatoire avant l'étape 2 ci-dessus** — sur l'offre gratuite, Supabase ne permet de
   modifier les modèles d'e-mail qu'avec un SMTP personnel (son serveur par défaut n'envoie de toute façon qu'aux membres
   de ton organisation). Pas à pas avec Brevo (gratuit) : `docs/SUPABASE_TABLEAU_DE_BORD.md`, étape 3.

## 4. Analyse des photos (Gemini) et fonctions serveur

La clé Gemini reste **uniquement** dans les secrets Supabase : elle n'est jamais dans l'app ni dans l'APK.

1. Crée une clé API sur [Google AI Studio](https://aistudio.google.com/apikey)
   (active la facturation du projet Google Cloud associé si tu dépasses le niveau gratuit).
2. Copie `supabase/functions/.env.example` en `supabase/functions/.env` et mets ta clé dans `GEMINI_API_KEY`.
   Ce fichier est ignoré par Git : ne le partage pas.
3. Envoie les secrets et déploie les deux fonctions :
   ```bash
   npx supabase@latest secrets set --env-file supabase/functions/.env
   npx supabase@latest functions deploy analyze-meal
   npx supabase@latest functions deploy delete-account
   ```
4. Teste l'analyse avec une photo JPEG de plat :
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon> \
     scripts/test-analyze-meal.sh photo.jpg "riz, sauce graine, poulet"
   ```
   (Si `.env` est déjà rempli — étape 5 — le script le lit tout seul.)
   Sans `TEST_EMAIL` / `TEST_PASSWORD`, il crée un invité (1 scan par jour). Avec ton compte de test,
   `REPEAT=4` envoie 4 scans : les 3 premiers répondent `HTTP 200`, le 4e `HTTP 429` (`quota_exceeded`).

Pour changer de modèle plus tard, sans republier l'app : `npx supabase@latest secrets set GEMINI_MODEL=<identifiant>`.

**Modèle saturé ou quota dépassé** (`HTTP 503 : … high demand` ou `HTTP 429 : You exceeded your current quota` dans
`scan_calls.error`) : un modèle saturé (503) est réessayé une fois après 2 s ; un quota dépassé (429) passe directement au
suivant. Ordre : `GEMINI_MODEL`, puis `GEMINI_FALLBACK_MODELS` (défaut `gemini-flash-lite-latest,gemini-flash-latest`,
séparés par des virgules, `none` pour désactiver). Si tout échoue ainsi, l'app affiche « Le service d'analyse est saturé »
et le scan n'est pas décompté. Chaque essai a sa ligne dans `scan_calls` (colonne `model`).

**Requête simplifiée** : les modèles actuels refusent (`HTTP 400 : Request contains an invalid argument`) la requête avec
schéma JSON imposé, température et niveau de réflexion. Par défaut la fonction envoie donc une requête simplifiée : la forme
JSON est décrite dans le prompt et la réponse est validée aussi strictement. `GEMINI_STRUCTURED=true` rétablit la requête
complète (un refus 400 est alors réessayé une fois en requête simplifiée).

## 5. Relier l'app et tester avec Expo Go (conseillé)

```bash
cp .env.example .env     # puis remplis EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start           # ajoute --tunnel si le téléphone n'atteint pas l'ordinateur
```

Installe **Expo Go** (compatible SDK 57) depuis le Play Store et scanne le QR code.
C'est le moyen le plus rapide de voir tes modifications ; l'APK de l'étape 6 est ce que tu distribues.

## 6. Construire l'APK avec EAS

EAS Build compile l'APK dans le cloud d'Expo : pas besoin d'Android Studio.

1. **Compte et projet Expo** (une seule fois)
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
   `init` crée le projet `calbasse` sur expo.dev et affiche son **projectId**. Comme la configuration est
   dynamique (`app.config.ts`), colle-le dans la constante `EAS_PROJECT_ID` de `app.config.ts`, puis commite.
2. **Variables publiques du build** (une seule fois par environnement)
   ```bash
   npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
   npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <clé anon>
   ```
   Refais les deux commandes avec `--environment production` si tu utilises le profil `production`.
   Seules ces deux valeurs publiques vont dans l'app ; **aucune autre clé**.
3. **Vérification facultative avant le build** : `npm run check:secrets` doit afficher « Aucun secret dans le bundle ».
4. **Lancer le build**
   ```bash
   npx eas-cli@latest build -p android --profile preview
   ```
   La première fois, accepte la **génération d'une clé de signature Android** : EAS la conserve pour toi.
   Garde ce même projet Expo pour toutes les versions : un APK signé avec une autre clé ne pourra pas
   mettre à jour l'app déjà installée.
5. **Récupérer l'APK** : à la fin (10 à 20 minutes), la commande affiche un **lien et un QR code**.
   Le lien reste disponible sur [expo.dev](https://expo.dev), dans *Projects > calbasse > Builds* :
   bouton **Download** pour le fichier `.apk`, ou **Share** pour envoyer le lien.

Profils (`eas.json`) :

| Profil | Usage | Numéro de version (`versionCode`) |
|---|---|---|
| `preview` | APK de test, distribution interne | géré par EAS |
| `production` | APK à diffuser | incrémenté automatiquement à chaque build |

**Taille de l'APK** (`expo-build-properties` dans `app.config.ts`) : seuls les processeurs des vrais téléphones
sont inclus (`arm64-v8a`, `armeabi-v7a` ; pas les émulateurs x86), les bibliothèques natives sont compressées
et R8 retire le code et les ressources inutilisés. Si un écran plante uniquement dans l'APK (pas dans Expo Go),
essaie d'abord `enableMinifyInReleaseBuilds: false`.

Pour une nouvelle version visible des utilisateurs, change `version` dans `app.config.ts` (ex. `0.2.0`),
puis `npx eas-cli@latest build -p android --profile production`. Le numéro s'affiche en bas de l'écran Profil.

## 7. Installer l'APK et recette

Sur le téléphone : ouvre le lien, télécharge l'APK, puis autorise l'installation depuis cette source
(*Paramètres > Sécurité > Sources inconnues*, ou la demande affichée par Android).

Recette (critères d'acceptation) :

1. Entrer **en invité**, faire l'onboarding : le journal affiche la cible.
2. **Scanner un plat** : le résultat est modifiable (quantités en louches, boules…, ajout, suppression).
3. Les calories viennent de la table des plats ; un élément hors table est marqué « estimé ».
4. **Mode avion** : « Saisir sans photo » → le repas s'enregistre et reste consultable ; au retour du réseau
   il est synchronisé (le message « en attente » disparaît).
5. Profil > **Créer mon compte** : code reçu par e-mail, journal conservé.
6. Avec un compte gratuit, le **4e scan** du jour est refusé avec un message clair.
7. Profil > **Supprimer mon compte** : retour à l'accueil ; dans Supabase, l'utilisateur et ses repas ont disparu.

## 8. Suivre le coût réel de Gemini

Chaque appel est journalisé dans `scan_calls` (tokens d'entrée, de sortie, de réflexion, durée). Dans *SQL Editor* :

```sql
-- Tokens par utilisateur et par jour (heure du Bénin)
select * from scan_costs_daily order by day desc, total_tokens desc limit 50;

-- Moyenne par scan réussi sur les 7 derniers jours
select round(avg(total_tokens)) as tokens_moyens, count(*) as appels
from scan_calls where ok and created_at > now() - interval '7 days';
```

Multiplie par le tarif en vigueur du modèle (la réflexion est facturée comme de la sortie).

**Température** : elle n'est envoyée qu'avec `GEMINI_STRUCTURED=true` (défaut `GEMINI_TEMPERATURE=0.3`, cahier des charges ;
Google recommande de garder la valeur par défaut des modèles Gemini 3 : `GEMINI_TEMPERATURE=default`).

## 9. Avant d'ouvrir l'app à d'autres personnes

- **SMTP** : configure un vrai serveur d'e-mails (*Authentication > Emails > SMTP Settings* ; Brevo, Resend,
  Mailjet… ont une offre gratuite), sinon les codes n'arrivent qu'aux membres de ton équipe Supabase.
- **CAPTCHA** (*Authentication > Attack Protection*) : limite la création d'invités en masse. Il faudra aussi
  brancher le jeton CAPTCHA dans l'app (non fait dans ce MVP).
- **Valeurs nutritionnelles** : faire vérifier `docs/FOODS_TODO.md` avec la table FAO avant toute communication.
- **Photos** : `STORE_PHOTOS=false` par défaut. Ne l'active qu'avec une politique de confidentialité à jour ;
  seules les photos des utilisateurs ayant coché le partage sont alors conservées.
