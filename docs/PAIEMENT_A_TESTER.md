# Paiement : ce qui reste à vérifier

La chaîne de paiement Maketou a été relue et testée partiellement. **Un seul maillon n'a jamais
été exécuté pour de vrai : le retour après paiement.** Tant que personne n'a payé, on ne sait pas
si Maketou appelle bien `maketou-return`, ni si le Premium s'active.

## Déjà vérifié

- Les secrets Supabase sont en place : sans `MAKETOU_API_KEY` ni identifiant produit, aucune offre
  ne s'afficherait. Les deux offres s'affichent.
- La création du panier chez Maketou fonctionne (l'appel le plus risqué, qu'aucun test ne couvre).
- Le prix affiché dans l'app correspond au prix réellement débité : la page Maketou affiche
  2000 FCFA pour l'offre mensuelle.
- 19 tests passent sur `create-checkout` et `maketou-return`.
- L'idempotence est posée en base (`on conflict (sale_id) do nothing`), pas en JavaScript, et
  `grant_premium` est révoquée pour `anon` et `authenticated`.

## À faire au premier paiement réel

1. La page de retour affiche « Paiement reçu, merci ! ».
2. Dans l'app : Profil → Premium, 30 scans par jour.
3. Dans Supabase → `payments` : **une seule ligne**.
4. Toucher **« J'ai payé : actualiser » trois fois de suite** : la date d'expiration ne doit pas
   bouger d'un jour, et `payments` ne doit toujours contenir qu'une ligne. C'est le test qui
   compte : une garantie d'idempotence non vérifiée, sur un chemin qui touche à l'argent, ne vaut
   pas grand-chose.

Si le premier paiement vient d'un client plutôt que de l'éditeur, surveiller sa transaction de
près et être prêt à créditer à la main.

## Limite connue

Le rattrapage des paiements non réglés (`pendingIntents` dans `create-checkout/index.ts`) ne
remonte que **30 jours**. Quelqu'un qui paie, ferme son navigateur sans revenir, et ne rouvre
l'app qu'un mois plus tard ne sera jamais crédité automatiquement — il faudra le faire à la main.
Ce n'est pas le chemin normal : le retour du navigateur règle le paiement tout de suite.
