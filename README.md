# Calebasse

Application Android de suivi calorique par photo, pensée pour l'Afrique francophone
(marché de départ : Bénin / Cotonou). On prend son plat en photo, l'IA identifie les
éléments et les portions, et les calories sont calculées à partir d'une table de plats locaux.

Stack : Expo SDK 57 (React Native, TypeScript strict, Expo Router), Supabase, Gemini
(appelé uniquement depuis une Edge Function), EAS Build pour produire l'APK.

## État d'avancement

- [x] Phase 1 : initialisation, navigation, i18n, thème
- [x] Phase 2 : Supabase (migrations, RLS, seed des plats, auth invité + compte, onboarding)
- [ ] Phase 3 : Edge Function `analyze-meal`
- [ ] Phase 4 : scan → résultat → édition → enregistrement
- [ ] Phase 5 : journal, historique, onboarding, profil, hors ligne
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
```

Tests de sécurité de la base (RLS, quota) : `psql "$DATABASE_URL" -f supabase/tests/rls_test.sql`.

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
  templates/        e-mails avec code à 6 chiffres
  tests/            tests RLS et quota
docs/
  SETUP.md          mise en route Supabase / Expo
  FOODS_TODO.md     valeurs nutritionnelles à vérifier
```

Le nom de l'application se change uniquement dans `src/brand.json`. L'identifiant Android
`com.calebasse.app` est défini dans `app.config.ts` et ne doit plus changer après publication.
