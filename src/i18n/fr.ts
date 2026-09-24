export const fr = {
  common: {
    continue: 'Continuer',
    back: 'Retour',
    save: 'Enregistrer',
    cancel: 'Annuler',
    comingSoon: 'Bientôt disponible',
    kcal: 'kcal',
    grams: 'g',
  },
  auth: {
    tagline: 'Prends ton plat en photo, on compte les calories.',
    guest: 'Continuer sans compte',
    signIn: 'Se connecter',
    signUp: 'Créer un compte',
    guestNote: 'En invité, tu pourras créer un compte plus tard sans perdre ton journal.',
  },
  onboarding: {
    step: 'Étape {current} sur {total}',
    goalTitle: 'Quel est ton objectif ?',
    goalLose: 'Perdre du poids',
    goalMaintain: 'Garder mon poids',
    goalGain: 'Prendre du poids',
    bodyTitle: 'Parle-nous de toi',
    targetTitle: 'Ta cible du jour',
    start: 'Commencer',
  },
  tabs: {
    journal: 'Journal',
    scan: 'Scanner',
    history: 'Historique',
    profile: 'Profil',
  },
  journal: {
    title: "Aujourd'hui",
    remaining: 'restantes',
    target: 'Cible : {kcal} kcal',
    protein: 'Protéines',
    carbs: 'Glucides',
    fat: 'Lipides',
    empty: "Aucun repas enregistré aujourd'hui.",
    scanCta: 'Scanner un plat',
  },
  meals: {
    breakfast: 'Petit-déjeuner',
    lunch: 'Déjeuner',
    dinner: 'Dîner',
    snack: 'En-cas',
  },
  scan: {
    title: 'Scanner un plat',
    takePhoto: 'Prendre une photo',
    pickGallery: 'Choisir dans la galerie',
    hintLabel: "Qu'y a-t-il dans ce plat ? (facultatif)",
    hintPlaceholder: "riz, sauce graine, poulet, un peu d'huile",
    quota: 'Scans restants aujourd\'hui : {count}',
  },
  result: {
    title: 'Résultat',
  },
  history: {
    title: 'Historique',
    last7: '7 jours',
    last30: '30 jours',
  },
  profile: {
    title: 'Profil',
    language: 'Langue',
    signOut: 'Se déconnecter',
    deleteAccount: 'Supprimer mon compte et mes données',
  },
} as const;

/** Forme que chaque langue doit respecter : mêmes clés, valeurs libres. */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof fr>;
