# Calebasse

Application Android de suivi calorique par photo, pensée pour l'Afrique francophone
(marché de départ : Bénin / Cotonou). On prend son plat en photo, l'IA identifie les
éléments et les portions, et les calories sont calculées à partir d'une table de plats locaux.

Stack : Expo SDK 57 (React Native, TypeScript strict, Expo Router), Supabase, Gemini
(appelé uniquement depuis une Edge Function), EAS Build pour produire l'APK.

## État d'avancement

- [x] Phase 1 : initialisation, navigation, i18n, thème
- [ ] Phase 2 : Supabase (migrations, RLS, seed des plats, auth invité + compte)
- [ ] Phase 3 : Edge Function `analyze-meal`
- [ ] Phase 4 : scan → résultat → édition → enregistrement
- [ ] Phase 5 : journal, historique, onboarding, profil, hors ligne
- [ ] Phase 6 : EAS, build APK, documentation complète

## Développement

```bash
npm install
npm start          # serveur de développement Expo
npm run typecheck  # TypeScript strict
npm run lint
```

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
  state/            état de session
  brand.json        nom de l'app (seul endroit à modifier)
  config.ts         réglages (fuseau, quotas, compression photo)
  theme.ts          couleurs, espacements, tailles
```

Le nom de l'application se change uniquement dans `src/brand.json`. L'identifiant Android
`com.calebasse.app` est défini dans `app.config.ts` et ne doit plus changer après publication.
