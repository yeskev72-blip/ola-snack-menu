# Configurer Supabase depuis le navigateur (sans terminal)

Tout se fait dans le tableau de bord de Supabase, en copiant-collant trois fichiers préparés dans
`supabase/dashboard/`. Compte environ 30 minutes. Aucune clé ne quitte ton compte.
Les libellés du tableau de bord peuvent légèrement varier selon les versions ; en cas de doute, cherche le mot-clé indiqué.

Pour copier un fichier depuis GitHub : ouvre-le, clique sur **Raw** (ou l'icône « Copy raw file »), puis tout sélectionner → copier.

---

## Étape 1 — Créer le projet (5 min)

1. Va sur [supabase.com](https://supabase.com) → **Start your project** → connecte-toi (GitHub ou e-mail).
2. Si on te le demande, crée une **organisation** (ex. « Calbasse », offre **Free**).
3. **New project** :
   - **Name** : `calbasse`
   - **Database password** : clique sur **Generate a password**, puis **garde-le dans un gestionnaire de mots de passe**
     (il ne sera plus affiché).
   - **Region** : **West EU (Paris)** ou **Central EU (Frankfurt)** — les plus proches de Cotonou.
   - Offre **Free**.
4. **Create new project**, puis attends 1 à 2 minutes que le projet soit prêt.

## Étape 2 — Créer les tables et charger les plats (3 min)

1. Menu de gauche : **SQL Editor** → **New query**.
2. Colle **tout** le contenu de [`supabase/dashboard/01_installation.sql`](../supabase/dashboard/01_installation.sql).
3. **Run**. Si Supabase affiche un avertissement (opération « destructive » ou RLS), confirme : le script ne supprime rien,
   il crée les tables et active la protection des données partout.
4. Le résultat doit afficher : **« Installation Calbasse terminée : 69 plats chargés »**.
   - Erreur `already exists` : le script a déjà été exécuté, rien à refaire.
5. Vérification facultative : nouvelle requête avec le contenu de [`supabase/tests/rls_test.sql`](../supabase/tests/rls_test.sql)
   → **Run** → « Tous les tests RLS sont passés » (ce test annule tout ce qu'il crée).

## Étape 3 — Connexion des utilisateurs (5 min)

Menu de gauche : **Authentication**.

1. **Sign In / Providers** (ou *Providers*) :
   - active **Allow anonymous sign-ins** (mode invité) → **Save** ;
   - fournisseur **Email** : actif, **Confirm email** activé ;
   - **Minimum password length** : `8` → **Save**.
2. **Serveur d'e-mails (SMTP)** — obligatoire : sur l'offre gratuite, Supabase ne permet de modifier
   les modèles d'e-mail qu'avec ton propre SMTP (et son serveur par défaut n'envoie qu'aux membres de ton organisation).
   Exemple avec **Brevo** (gratuit, 300 e-mails par jour) :
   1. Crée un compte sur [brevo.com](https://www.brevo.com).
   2. **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender** : ton adresse d'envoi → valide le lien reçu.
   3. **SMTP & API** → onglet **SMTP** : note le **SMTP server** (`smtp-relay.brevo.com`), le **Port** (`587`)
      et le **Login** ; clique sur **Generate a new SMTP key** et copie la clé (elle n'est affichée qu'une fois).
   4. Dans Supabase : **Authentication** → **Emails** → **SMTP Settings** → **Enable custom SMTP** :
      - **Sender email** : l'adresse validée à l'étape 2 ; **Sender name** : `Calbasse`
      - **Host** : `smtp-relay.brevo.com` ; **Port** : `587`
      - **Username** : le *Login* Brevo ; **Password** : la clé SMTP → **Save changes**.
   5. La clé SMTP est un secret : elle ne va que dans Supabase, jamais dans l'app, un fichier ou une conversation.

   > Avec une adresse Gmail/Yahoo comme expéditeur, les e-mails risquent d'arriver en spam chez les autres :
   > avant la diffusion, utilise une adresse sur ton propre nom de domaine (vérifié dans Brevo).
3. **Emails** → **Templates** (débloqué par le SMTP) : l'app demande un **code** (6 à 10 chiffres ; Supabase en envoie 6 ou 8 selon le réglage *Email OTP Length* du fournisseur Email).
   - **Confirm signup** : sujet `Ton code Calbasse`, corps = contenu de
     [`supabase/templates/confirmation.html`](../supabase/templates/confirmation.html) → **Save**.
   - **Change email address** : sujet `Ton code Calbasse`, corps = contenu de
     [`supabase/templates/email_change.html`](../supabase/templates/email_change.html) → **Save**.
   - Les deux corps contiennent `{{ .Token }}` : c'est ce qui affiche le code. Ne le retire pas.

## Étape 4 — Clé Gemini et secrets (5 min)

1. Sur [Google AI Studio](https://aistudio.google.com/apikey) : **Create API key** → copie la clé.
2. Dans Supabase : **Edge Functions** → **Secrets** (ou *Project Settings → Edge Functions*) → ajoute :

   | Nom | Valeur |
   |---|---|
   | `GEMINI_API_KEY` | ta clé Gemini |
   | `GEMINI_MODEL` | `gemini-flash-lite-latest` |
   | `GEMINI_FALLBACK_MODELS` | `gemini-flash-lite-latest,gemini-flash-latest` (facultatif : c'est déjà la valeur par défaut) |
   | `STORE_PHOTOS` | `false` |

   → **Save**. La clé Gemini reste ici, jamais dans l'app. (`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
   sont fournies automatiquement aux fonctions : ne les ajoute pas.)

### Variante — payer par crédit prépayé et Mobile Money (RodiumAi)

La facturation de Google, comme celle d'OpenAI et d'Anthropic, refuse les cartes prépayées.
[RodiumAi](https://www.rodiumai.io) relaie les mêmes modèles derrière une API compatible OpenAI, se
recharge par **Mobile Money** (MTN MoMo, Orange Money, Wave, Moov…) et facture un crédit déposé à
l'avance : le solde se consomme à chaque scan, et plus de solde signifie plus d'appel — jamais de
facture surprise.

1. Sur [rodiumai.io](https://www.rodiumai.io) : crée un compte, puis recharge ton portefeuille RODI.
2. Dans le tableau de bord : crée une clé API (format `rd_sk_…`) → copie-la.
3. Dans les mêmes secrets Supabase, ajoute :

   | Nom | Valeur |
   |---|---|
   | `AI_PROVIDER` | `gateway` |
   | `GATEWAY_API_KEY` | ta clé `rd_sk_…` |
   | `GATEWAY_MODEL` | `google/gemini-2.5-flash-lite` (facultatif : c'est déjà la valeur par défaut) |

   `GEMINI_API_KEY` devient inutile dans ce mode, mais tu peux la laisser : repasser à la facturation
   Google directe ne demande alors que de remettre `AI_PROVIDER` à `gemini`.

> « Compatible OpenAI » ne désigne que le **format** de la requête, adopté par toute l'industrie.
> Le modèle qui analyse la photo reste celui de `GATEWAY_MODEL` : aucune donnée ne va chez OpenAI.

#### Modèles Google utilisables et tarifs

Relevés sur la page *Models* de RodiumAi (1 USD ≈ 742,5 RODI) ; le premier est le moins cher et sert
par défaut. Les tarifs sont ceux de Google : la passerelle ne prend pas de marge sur les jetons.

| `GATEWAY_MODEL` | Entrée / 1M | Sortie / 1M |
|---|---|---|
| `google/gemini-2.5-flash-lite` | ~0,10 $ | ~0,40 $ |
| `google/gemini-3.1-flash-lite` | ~0,25 $ | ~1,50 $ |
| `google/gemini-2.5-flash` | ~0,30 $ | ~2,50 $ |

`GATEWAY_FALLBACK_MODELS` (vide par défaut) accepte une liste séparée par des virgules, utilisée si le
modèle principal est saturé ou indisponible : par exemple `google/gemini-3.1-flash-lite`. Un scan qui
bascule sur un secours coûte alors le tarif de ce secours — d'où le choix de ne rien mettre par défaut.

Changer `GATEWAY_MODEL` suffit à essayer un autre modèle, sans rien redéployer. `GATEWAY_API_BASE`
permet d'utiliser une autre passerelle du même format (OpenRouter…) sans changer le code.

> **Sous-traitant supplémentaire** : les photos transitent alors par la passerelle en plus du modèle.
> La politique de confidentialité doit le mentionner (`site/confidentialite.html`).

## Étape 5 — Déployer les deux fonctions (10 min)

Pour **chacune** des deux fonctions :

| Nom exact de la fonction | Fichier à coller |
|---|---|
| `analyze-meal` | [`supabase/dashboard/analyze-meal/index.ts`](../supabase/dashboard/analyze-meal/index.ts) |
| `delete-account` | [`supabase/dashboard/delete-account/index.ts`](../supabase/dashboard/delete-account/index.ts) |

1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom : **exactement** celui du tableau (l'app appelle la fonction par ce nom).
3. Remplace tout le contenu de `index.ts` par le fichier correspondant → **Deploy function**.
4. Ouvre la fonction → **Details** (ou *Settings*) → désactive **Verify JWT with legacy secret**
   (*Enforce JWT verification*) → **Save**. Le jeton de l'utilisateur est vérifié dans le code de la fonction ;
   laisser ce réglage actif peut bloquer les appels de l'app.

**Vérification** : dans la fonction `analyze-meal`, onglet **Test** (ou *Invoke*), envoie une requête `POST`
sans en-tête d'autorisation. La réponse attendue est **401** `{"error":"unauthorized","message":"Connexion requise."}` :
la fonction est bien déployée et refuse les appels non connectés. (Le vrai test se fait depuis l'app.)

## Étape 6 — Récupérer les deux valeurs pour l'app (1 min)

**Project Settings** → **API** (ou *Data API* / *API Keys*) :

- **Project URL** : `https://<ref>.supabase.co` → deviendra `EXPO_PUBLIC_SUPABASE_URL` ;
- clé **anon** / **publishable** → deviendra `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Ces deux valeurs sont publiques par nature (la sécurité repose sur la RLS). Tu les renseigneras dans EAS au moment
du build (`docs/SETUP.md`, étape 6). **Ne copie jamais** la clé `service_role` / `secret` ni le mot de passe de la base
dans l'app, dans un fichier du dépôt ou dans une conversation.

---

## Récapitulatif

- [ ] Projet `calbasse` créé en Europe, mot de passe de la base conservé
- [ ] `01_installation.sql` exécuté : 69 plats chargés
- [ ] Invités activés, confirmation par e-mail, mot de passe ≥ 8, SMTP (Brevo…) configuré, deux modèles d'e-mail avec `{{ .Token }}`
- [ ] 5 secrets ajoutés (dont `GEMINI_API_KEY`)
- [ ] `analyze-meal` et `delete-account` déployées, « Verify JWT » désactivé, test 401 OK
- [ ] URL du projet et clé anon notées pour le build

Suite : le build de l'APK avec EAS (`docs/SETUP.md`, étape 6).
