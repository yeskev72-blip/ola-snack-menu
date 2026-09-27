# Paiements Premium avec Maketou

Premium = **30 scans par jour** au lieu de 2 (invité : 1). Deux offres, payées par mobile money ou carte sur la page
de paiement Maketou, **sans renouvellement automatique** : chaque paiement ajoute 30 jours (mensuel) ou 365 jours
(annuel) à la date de fin actuelle. Commission Maketou : 5 % par vente.

Aucune clé ne va dans l'app : la clé API Maketou reste dans les secrets Supabase.

## Fonctionnement

1. Dans l'app (Profil → **Passer Premium**), l'utilisateur choisit l'offre et saisit son prénom et son nom
   (numéro facultatif).
2. `create-checkout` enregistre le paiement en cours (`payment_intents`), crée un panier Maketou pour le produit de
   l'offre et l'app ouvre la page de paiement dans le navigateur.
3. Maketou n'envoie pas de notification : le panier est **relu chez Maketou** (seul le statut `completed` compte)
   - quand le navigateur revient sur `maketou-return` après le paiement ;
   - quand l'utilisateur revient dans l'app, ouvre l'écran Premium ou touche « J'ai payé : actualiser ».
4. Le Premium est crédité une seule fois par panier (`grant_premium`, identifiant `maketou:<panier>`).

## 1. Boutique et produits Maketou

1. Crée ta boutique sur [maketou.com](https://maketou.com).
2. Crée **deux produits numériques** :
   - « Calbasse Premium 1 mois » au prix de **2 000 F** ;
   - « Calbasse Premium 1 an » au prix de **20 000 F**.
3. Relève l'**identifiant public** de chaque produit (`productDocumentId`, un identifiant du type
   `550e8400-e29b-41d4-…`) et crée une **clé API** dans les réglages de la boutique (section API / développeurs).
   Ne partage jamais la clé : elle va uniquement dans les secrets Supabase.

## 2. Base de données (1 min)

Supabase → **SQL Editor** → colle le contenu de
[`supabase/migrations/20260927100000_maketou.sql`](../supabase/migrations/20260927100000_maketou.sql) → **Run**.

(Inutile d'exécuter l'ancienne migration CinetPay.)

## 3. Secrets Supabase

**Edge Functions → Secrets** :

| Nom | Valeur |
|---|---|
| `MAKETOU_API_KEY` | clé API de la boutique |
| `MAKETOU_PRODUCT_MONTHLY` | identifiant du produit « 1 mois » |
| `MAKETOU_PRODUCT_YEARLY` | identifiant du produit « 1 an » |
| `PREMIUM_PRICE_MONTHLY` | facultatif, défaut `2000` : prix **affiché** dans l'app |
| `PREMIUM_PRICE_YEARLY` | facultatif, défaut `20000` |

Le prix réellement payé est celui du produit sur Maketou : si tu le changes là-bas, change aussi
`PREMIUM_PRICE_*` pour que l'app affiche le même montant. Une offre sans produit n'est pas proposée.

Tu peux supprimer les secrets `CINETPAY_*` et `CHARIOW_*` s'ils existent.

## 4. Déployer les deux fonctions

| Nom exact | Fichier à coller |
|---|---|
| `create-checkout` | [`supabase/dashboard/create-checkout/index.ts`](../supabase/dashboard/create-checkout/index.ts) |
| `maketou-return` | [`supabase/dashboard/maketou-return/index.ts`](../supabase/dashboard/maketou-return/index.ts) |

Pour les deux : **Verify JWT** désactivé. Supprime les anciennes fonctions `cinetpay-webhook` et `chariow-webhook`
si elles existent. Rien à configurer chez Maketou : l'adresse de retour est envoyée avec chaque panier.

## 5. Tester

Maketou n'a pas de mode test : fais un vrai paiement de 2 000 F (tu pourras te le rembourser depuis Maketou).

1. Avec un compte gratuit : Profil → **Passer Premium** → Mensuel → **Payer**.
2. Paie sur la page Maketou, puis reviens dans l'app : « Premium jusqu'au … » (sinon « J'ai payé : actualiser »).
3. Contrôle :
   ```sql
   select id, cart_id, offer, amount, status, created_at from public.payment_intents order by created_at desc limit 5;
   select created_at, provider, sale_id, offer, days, premium_until from public.payments order by created_at desc limit 5;
   ```
4. Si le paiement ne se prépare pas, l'app affiche un **code** entre parenthèses. Il dit quoi corriger :

| Code | Cause | Correction |
|---|---|---|
| `400/INVALID_PRODUCT` | `MAKETOU_PRODUCT_*` n'est pas l'identifiant attendu | reprends le `documentId` du produit |
| `401` ou `401/MISSING_API_KEY` | `MAKETOU_API_KEY` absente ou fausse | recolle la clé |
| `422/VALIDATION_ERROR` | un champ refusé par Maketou | vois les journaux pour le champ |
| `429` | trop de requêtes | réessaie dans une minute |
| `db/42P01` | table `payment_intents` absente | exécute la migration (étape 2) |
| `db/42703`, `db/23502` | table à l'ancien format | exécute la migration (étape 2) |
| `timeout` | Maketou n'a pas répondu | réessaie |

   Le détail complet reste dans **Edge Functions → create-checkout → Logs**
   (`création du paiement impossible`, avec `code` et `error`).

## À savoir

- **Geste commercial** : `update public.profiles set premium_until = premium_until + interval '30 days' where id = '<uuid>';`
- **Paiement fait mais app jamais rouverte** : le Premium est crédité dès que l'utilisateur rouvre l'écran Premium
  (les paniers en attente des 30 derniers jours sont revérifiés).
- **Google Play** : un APK distribué directement peut encaisser par Maketou ; sur le Play Store, Google impose son
  propre système pour un abonnement numérique.
