# Paiements Premium avec Chariow

Premium = **30 scans par jour** au lieu de 2 (invité : 1). Deux offres, payées par mobile money ou carte sur la
page de paiement Chariow, **sans renouvellement automatique** : chaque paiement ajoute 30 jours (mensuel) ou
365 jours (annuel) à la date de fin actuelle.

Tout se fait dans le navigateur (Chariow et Supabase). Compte environ 20 minutes.
Aucune clé ne va dans l'app : la clé Chariow reste dans les secrets Supabase.

## Fonctionnement

1. Dans l'app (Profil → **Passer Premium**), l'utilisateur choisit l'offre et saisit prénom, nom, pays et numéro.
2. La fonction `create-checkout` crée la page de paiement Chariow avec son identifiant Calbasse
   dans les métadonnées de la vente ; l'app l'ouvre dans le navigateur.
3. Après le paiement, Chariow prévient la fonction `chariow-webhook` (Pulse « vente réussie »).
4. La fonction **relit la vente auprès de Chariow** avec la clé secrète (statut payé, produit), puis crédite le
   Premium une seule fois par vente (`grant_premium`, table `payments`).
5. De retour dans l'app, le Profil affiche « Premium jusqu'au … ».

Un invité doit d'abord créer son compte (e-mail) : le Premium est rattaché au compte.

## 1. Produits Chariow (5 min)

Sur [chariow.com](https://chariow.com), dans ta boutique, crée **deux produits de type « Files »** (fichiers), avec en
fichier joint [`docs/boutique/bienvenue-calbasse-premium.pdf`](boutique/bienvenue-calbasse-premium.pdf).
⚠️ Pas « Services » ni « Coaching » : Chariow refuse de les vendre via son API
(`HTTP 422 : Service and Coaching products are not supported via the Public API`).

| Produit | Prix (exemple) |
|---|---|
| Calbasse Premium — 1 mois | 1 000 FCFA |
| Calbasse Premium — 1 an | 10 000 FCFA |

Note l'**identifiant** de chaque produit (il commence par `prd_…` ; visible dans la page du produit ou son
adresse). Seules les ventes de ces deux produits créditent du Premium.

## 2. Clé API Chariow (2 min)

Chariow → **Développeurs** (ou *Paramètres → API*) → crée une clé API et copie-la.
Elle ne va **que** dans les secrets Supabase (étape 4) : jamais dans l'app, un fichier ou une conversation.

## 3. Base de données (1 min)

Supabase → **SQL Editor** → **New query** → colle tout le contenu de
[`supabase/migrations/20260925100000_premium.sql`](../supabase/migrations/20260925100000_premium.sql) → **Run**.
(Un projet neuf installé avec `supabase/dashboard/01_installation.sql` l'a déjà.)

**Ton compte en Premium permanent, sans payer** : nouvelle requête, remplace l'adresse par celle de ton compte, **Run** :

```sql
update public.profiles
set plan = 'premium', premium_until = null
where id = (select id from auth.users where email = 'ton-adresse@email.com');
```

La réponse doit indiquer `UPDATE 1`. Dans l'app : Profil → « Premium permanent : 30 scans par jour »
(ferme et rouvre l'app si besoin). Pour d'autres comptes gratuits (testeurs, famille), même requête avec leur adresse.

## 4. Secrets Supabase (3 min)

**Edge Functions** → **Secrets** → ajoute :

| Nom | Valeur |
|---|---|
| `CHARIOW_API_KEY` | la clé API Chariow |
| `CHARIOW_PRODUCT_MONTHLY` | produit 1 mois : identifiant `prd_…` ou nom court, la fin du lien public (ex. `calbasse-1-mois` pour `https://calbasse.mychariow.store/calbasse-1-mois`) |
| `CHARIOW_PRODUCT_YEARLY` | produit 1 an : identifiant `prd_…` ou nom court |
| `CHARIOW_LABEL_MONTHLY` | prix affiché dans l'app, ex. `1 000 FCFA / mois` |
| `CHARIOW_LABEL_YEARLY` | ex. `10 000 FCFA / an` |
| `CHARIOW_WEBHOOK_TOKEN` | une longue suite aléatoire (voir ci-dessous) |

Pour générer le jeton : SQL Editor → `select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');` → **Run** → copie le résultat.
Les prix affichés se changent ici, sans nouvel APK (le vrai prix est celui du produit Chariow).

## 5. Déployer les deux fonctions (5 min)

Comme pour `analyze-meal` (`docs/SUPABASE_TABLEAU_DE_BORD.md`, étape 5) :

| Nom exact | Fichier à coller |
|---|---|
| `create-checkout` | [`supabase/dashboard/create-checkout/index.ts`](../supabase/dashboard/create-checkout/index.ts) |
| `chariow-webhook` | [`supabase/dashboard/chariow-webhook/index.ts`](../supabase/dashboard/chariow-webhook/index.ts) |

Pour les deux : **Verify JWT** désactivé (le jeton est vérifié dans le code ; Chariow n'envoie pas de jeton Supabase).

## 6. Notification de vente : Pulse Chariow (2 min)

Chariow → **Pulses** (webhooks) → nouveau Pulse :

- **Événement** : vente réussie (`successful_sale`) ;
- **Produits** : les deux produits Premium (ou tous) ;
- **URL** : `https://<ref>.supabase.co/functions/v1/chariow-webhook?token=<CHARIOW_WEBHOOK_TOKEN>`
  (le `<ref>` de ton projet et le jeton de l'étape 4).

Si Chariow affiche un **secret de signature** (`whsec_…`), ajoute-le aussi dans le secret `CHARIOW_WEBHOOK_SECRET`.

## 7. Tester

1. Avec un compte **gratuit** (pas ton compte permanent) : Profil → **Passer Premium** → Mensuel → payer.
   Pour tester sans dépenser, crée dans Chariow un **code de réduction de 100 %** limité à une utilisation,
   et saisis-le sur la page de paiement.
2. Reviens dans l'app : le Profil affiche « Premium jusqu'au … » (sinon, touche « J'ai payé : actualiser »).
3. Contrôle dans Supabase :
   ```sql
   select created_at, offer, days, amount, currency, premium_until from public.payments order by created_at desc limit 5;
   ```
4. Si rien n'arrive : **Edge Functions → chariow-webhook → Logs**. Messages utiles : `notification refusée`
   (jeton de l'URL faux), `vente d'un autre produit` (identifiant de produit dans les secrets), `vente non payée`,
   `lecture de la vente impossible` (clé API).

## À savoir

- **Remboursement ou geste commercial** : SQL, par exemple
  `update public.profiles set premium_until = premium_until + interval '30 days' where id = '<uuid>';`
- **Google Play** : un APK distribué directement peut encaisser par Chariow. Si l'app est un jour publiée sur le
  Play Store, Google impose son propre système de paiement pour un abonnement numérique : à revoir à ce moment-là.
- **Coût de l'IA** : avant de vendre, active la facturation de ta clé Gemini (le niveau gratuit de Google est plafonné
  et peut utiliser les photos pour améliorer ses modèles). Suis le coût réel avec `scan_costs_daily` (`docs/SETUP.md`, étape 8).
