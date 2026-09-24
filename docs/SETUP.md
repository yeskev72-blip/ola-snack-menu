# Mise en route (ce que tu dois faire toi-même)

Ces étapes demandent tes identifiants : elles ne sont pas automatisées. Compte environ 20 minutes.
Les libellés du tableau de bord Supabase peuvent légèrement varier selon les versions.

Prérequis sur ton ordinateur : Node.js 22 ou plus récent, et Git.

```bash
git clone <url-du-dépôt> calebasse && cd calebasse
npm install
```

## 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), crée un projet nommé `calebasse`.
   Région : **Europe (Paris `eu-west-3` ou Francfort `eu-central-1`)**, la plus proche de Cotonou.
2. Note le **mot de passe de la base** choisi à la création.
3. Dans *Project Settings > API*, relève :
   - l'**URL du projet** (`https://xxxx.supabase.co`) ;
   - la **clé `anon` / publishable** (publique, destinée à l'app).
   - Ne copie **jamais** la clé `service_role` / secret dans l'app ni dans ce dépôt.

## 2. Créer les tables et charger les plats

```bash
npx supabase@latest login
npx supabase@latest link --project-ref <ref-du-projet>   # le ref est dans l'URL : https://<ref>.supabase.co
npx supabase@latest db push --include-seed
```

`db push` applique `supabase/migrations/` (tables, RLS, quota). `--include-seed` charge `supabase/seed.sql`
(69 plats, valeurs approximatives : voir `docs/FOODS_TODO.md`).

Vérification facultative : dans *SQL Editor*, colle le contenu de `supabase/tests/rls_test.sql` et exécute-le.
La dernière ligne doit afficher « Tous les tests RLS sont passés » (rien n'est conservé, tout est annulé à la fin).

## 3. Réglages d'authentification (tableau de bord)

Dans *Authentication* :

1. **Sign In / Providers**
   - Active **Allow anonymous sign-ins** (mode invité).
   - Fournisseur **Email** : active-le et laisse **Confirm email** activé.
   - Longueur minimale du mot de passe : **8**.
2. **Emails > Templates** : l'app demande un **code à 6 chiffres**, pas un lien. Remplace le contenu de :
   - **Confirm signup** par le fichier `supabase/templates/confirmation.html` ;
   - **Change email address** par le fichier `supabase/templates/email_change.html`.
   (Les deux contiennent `{{ .Token }}`, c'est ce qui affiche le code.)
3. **Emails > SMTP Settings** : le serveur d'e-mails par défaut de Supabase n'envoie qu'aux membres de ton
   équipe Supabase, et seulement quelques e-mails par heure. Pour tes premiers tests, utilise ta propre adresse.
   Avant d'ouvrir l'app à d'autres personnes, configure un SMTP (Brevo, Resend, Mailjet… ont une offre gratuite).
4. Recommandé avant la diffusion : **Attack Protection > CAPTCHA** pour limiter la création d'invités en masse
   (à brancher dans l'app plus tard).

## 4. Relier l'app à Supabase

Copie `.env.example` en `.env` et remplis-le :

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon / publishable>
```

## 5. Tester sur ton téléphone Android

### Option A : Expo Go (le plus rapide, avec un ordinateur)

1. Installe **Expo Go** depuis le Play Store (version compatible SDK 57).
2. Sur l'ordinateur, sur le même Wi-Fi que le téléphone : `npx expo start`.
3. Scanne le QR code avec Expo Go.
   Si le Wi-Fi bloque la connexion : `npx expo start --tunnel`.

### Option B : APK installable (sans ordinateur pour la suite)

1. Crée un compte sur [expo.dev](https://expo.dev), puis :
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
   `init` affiche un `projectId` : colle-le dans `EAS_PROJECT_ID` dans `app.config.ts`.
2. Déclare les deux variables publiques pour le build :
   ```bash
   npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
   npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <clé anon>
   ```
3. Lance le build : `npx eas-cli@latest build -p android --profile preview`.
   À la première fois, accepte la génération d'une clé de signature Android (EAS la conserve pour toi).
4. À la fin (10 à 20 minutes), la commande affiche un **lien et un QR code** : ouvre-le sur le téléphone,
   télécharge l'APK et autorise l'installation depuis cette source.
   Le lien reste aussi disponible sur expo.dev, dans *Projects > calebasse > Builds*.

## 6. Activer l'analyse des photos (Gemini)

La clé Gemini reste **uniquement** dans les secrets Supabase : elle n'est jamais dans l'app ni dans l'APK.

1. Crée une clé API sur [Google AI Studio](https://aistudio.google.com/apikey).
   Active la facturation du projet Google Cloud associé si tu dépasses le niveau gratuit.
2. Applique la nouvelle migration (tables `scans` et `scan_calls`) :
   ```bash
   npx supabase@latest db push
   ```
3. Copie `supabase/functions/.env.example` en `supabase/functions/.env`, mets ta clé dans `GEMINI_API_KEY`,
   puis envoie les secrets et déploie la fonction :
   ```bash
   npx supabase@latest secrets set --env-file supabase/functions/.env
   npx supabase@latest functions deploy analyze-meal
   ```
   Pour changer de modèle plus tard, sans republier l'app :
   `npx supabase@latest secrets set GEMINI_MODEL=<nouvel-identifiant>` (effet immédiat).
4. Teste avec une photo JPEG de plat :
   ```bash
   scripts/test-analyze-meal.sh photo.jpg "riz, sauce graine, poulet"
   ```
   Sans `TEST_EMAIL` / `TEST_PASSWORD`, le script crée un invité (1 scan par jour).
   Avec ton compte de test :
   ```bash
   TEST_EMAIL=toi@exemple.com TEST_PASSWORD='…' REPEAT=4 scripts/test-analyze-meal.sh photo.jpg
   ```
   Les 3 premiers scans répondent `HTTP 200`, le 4e `HTTP 429` (`quota_exceeded`).
   Pour tester une relance après question : reprends le `scan_id` renvoyé et lance
   `SCAN_ID=<scan_id> QUESTION="<texte>" ANSWER="<option choisie>" scripts/test-analyze-meal.sh photo.jpg`.

### Suivre le coût réel

Chaque appel Gemini est journalisé dans `scan_calls` (tokens d'entrée, de sortie, de réflexion, durée).
Dans *SQL Editor* :

```sql
-- Tokens par utilisateur et par jour (heure du Bénin)
select * from scan_costs_daily order by day desc, total_tokens desc limit 50;

-- Moyenne par scan réussi sur les 7 derniers jours
select round(avg(total_tokens)) as tokens_moyens, count(*) as appels
from scan_calls where ok and created_at > now() - interval '7 days';
```

Multiplie par le tarif en vigueur du modèle (entrée et sortie, réflexion comprise dans la sortie) pour obtenir le coût.

### Température

Le cahier des charges fixe la température à 0,3 (`GEMINI_TEMPERATURE=0.3`). Google recommande pourtant de garder
la valeur par défaut sur les modèles Gemini 3 (baisser la température peut dégrader les réponses ou les faire boucler).
Si tu observes des réponses invalides ou tronquées dans `scan_calls.error`, passe à
`npx supabase@latest secrets set GEMINI_TEMPERATURE=default`.
