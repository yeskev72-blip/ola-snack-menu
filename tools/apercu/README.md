# Voir l'app web dans un navigateur

Deux petits serveurs, sans dépendance, pour regarder un export web sans toucher
au vrai Supabase ni à la production.

```bash
# 1. construire, en pointant l'app vers le Supabase de substitution
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8300 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=factice \
npx expo export --platform web --output-dir dist --clear

# 2. lancer les deux serveurs
node tools/apercu/faux-supabase.mjs &
node tools/apercu/servir.mjs dist 8080 &

# 3. ouvrir http://127.0.0.1:8080 et entrer en invité
```

`servir.mjs dist 8080 --iso` ajoute les en-têtes d'isolation de `netlify.toml`.

Le profil servi est complet, donc l'app va directement au journal : c'est fait
pour regarder les écrans, pas pour tester la vraie base.

`PROFIL=vide node tools/apercu/faux-supabase.mjs` ne sert aucun profil : l'app part
dans le parcours d'accueil, seul chemin vers l'écran de la cible.

`OBJECTIF=prise` sert un profil en prise de masse : l'écran du jour et
l'historique passent alors les protéines devant les calories.
