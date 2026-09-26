# Paiements Premium avec CinetPay

Premium = **30 scans par jour** au lieu de 2 (invité : 1). Deux offres, payées par mobile money (Orange, MTN, Moov,
Wave…) ou carte sur la page CinetPay, **sans renouvellement automatique** : chaque paiement ajoute 30 jours
(mensuel) ou 365 jours (annuel) à la date de fin actuelle. Aucune limite de rachat.

Aucune clé ne va dans l'app : les identifiants CinetPay restent dans les secrets Supabase.

## Fonctionnement

1. Dans l'app (Profil → **Passer Premium**), l'utilisateur choisit son pays, l'offre, et saisit prénom, nom et numéro.
2. `create-checkout` fixe le montant (prix du pays), enregistre le paiement en cours (`payment_intents`), crée la
   page CinetPay et l'app l'ouvre dans le navigateur.
3. CinetPay prévient `cinetpay-webhook`. La fonction vérifie le `notify_token` propre à la transaction, **relit le
   statut auprès de CinetPay** (seul `SUCCESS` compte) puis crédite le Premium une seule fois (`grant_premium`).
4. De retour dans l'app, le Profil affiche « Premium jusqu'au … ».

## 1. Comptes CinetPay (un par pays)

Chez CinetPay, **un compte marchand = un pays** (devise et indicatif imposés). Pour vendre dans plusieurs pays,
ouvre un compte par pays sur [cinetpay.com](https://cinetpay.com) et récupère pour chacun sa **clé API** et son
**mot de passe API** (espace marchand → Intégration / API). Commence en **sandbox** (tests) puis passe en production.

| Pays | Devise | Code |
|---|---|---|
| Bénin, Burkina Faso, Côte d'Ivoire, Mali, Niger, Sénégal, Togo | XOF (FCFA) | BJ, BF, CI, ML, NE, SN, TG |
| Cameroun, Centrafrique, Congo, Gabon, Guinée équatoriale, Tchad | XAF (FCFA) | CM, CF, CG, GA, GQ, TD |
| Guinée | GNF | GN |
| RD Congo | CDF | CD |

## 2. Base de données (1 min)

Supabase → **SQL Editor** → colle le contenu de
[`supabase/migrations/20260926120000_cinetpay.sql`](../supabase/migrations/20260926120000_cinetpay.sql) → **Run**.

Ton compte en Premium permanent (si ce n'est pas déjà fait) :
```sql
update public.profiles set plan = 'premium', premium_until = null
where id = (select id from auth.users where email = 'ton-adresse@email.com');
```

## 3. Secrets Supabase

**Edge Functions → Secrets** :

| Nom | Valeur |
|---|---|
| `CINETPAY_ENV` | `sandbox` pour tester, `production` pour encaisser |
| `CINETPAY_BJ_API_KEY` | clé API du compte Bénin (remplace `BJ` par le code de chaque pays ouvert) |
| `CINETPAY_BJ_API_PASSWORD` | mot de passe API du même compte |
| `PREMIUM_PRICE_MONTHLY_XOF` | facultatif, défaut `2000` |
| `PREMIUM_PRICE_YEARLY_XOF` | facultatif, défaut `20000` |

Même principe pour XAF (défauts 2000 / 20000). Pour la Guinée (GNF) et la RD Congo (CDF), ajoute leurs deux prix,
sinon ces pays restent masqués. Un pays n'apparaît dans l'app que si sa clé, son mot de passe et le prix de sa
devise sont présents. Les prix se changent ici, sans nouvel APK.

Tu peux supprimer les anciens secrets `CHARIOW_*`.

## 4. Déployer les deux fonctions

| Nom exact | Fichier à coller |
|---|---|
| `create-checkout` | [`supabase/dashboard/create-checkout/index.ts`](../supabase/dashboard/create-checkout/index.ts) |
| `cinetpay-webhook` | [`supabase/dashboard/cinetpay-webhook/index.ts`](../supabase/dashboard/cinetpay-webhook/index.ts) |

Pour les deux : **Verify JWT** désactivé. Supprime l'ancienne fonction `chariow-webhook`.
Rien à configurer chez CinetPay pour la notification : son adresse est envoyée avec chaque paiement.

## 5. Tester (sandbox)

1. `CINETPAY_ENV=sandbox` et les identifiants sandbox d'un pays.
2. Avec un compte gratuit : Profil → **Passer Premium** → pays → Mensuel → payer avec un moyen de test CinetPay.
3. Reviens dans l'app : « Premium jusqu'au … » (sinon « J'ai payé : actualiser »).
4. Contrôle :
   ```sql
   select merchant_transaction_id, country, amount, currency, status, created_at from public.payment_intents order by created_at desc limit 5;
   select created_at, offer, days, amount, currency, premium_until from public.payments order by created_at desc limit 5;
   ```
5. Si rien n'arrive : **Edge Functions → cinetpay-webhook → Logs** (`notify_token invalide`, `paiement non abouti`,
   `lecture du paiement impossible`…) ou **create-checkout → Logs** (`création du paiement impossible` + raison).

## À savoir

- **Geste commercial** : `update public.profiles set premium_until = premium_until + interval '30 days' where id = '<uuid>';`
- **Google Play** : un APK distribué directement peut encaisser par CinetPay ; sur le Play Store, Google impose son
  propre système pour un abonnement numérique.
- **Coût de l'IA** : active la facturation de ta clé Gemini avant de vendre.
