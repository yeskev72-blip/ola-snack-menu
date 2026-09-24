import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ActivityLevel, Goal, Sex } from '@/lib/calories';

/** Réponses saisies pendant l'onboarding, enregistrées d'un coup au dernier écran. */
export type OnboardingDraft = {
  objectif: Goal | null;
  prenom: string;
  sexe: Sex | null;
  age: number | null;
  taille_cm: number | null;
  poids_kg: number | null;
  activite: ActivityLevel;
};

const initialDraft: OnboardingDraft = {
  objectif: null,
  prenom: '',
  sexe: null,
  age: null,
  taille_cm: null,
  poids_kg: null,
  activite: 'leger',
};

type Ctx = { draft: OnboardingDraft; update: (patch: Partial<OnboardingDraft>) => void };

const DraftContext = createContext<Ctx | null>(null);

export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(initialDraft);
  const value = useMemo<Ctx>(() => ({ draft, update: (patch) => setDraft((d) => ({ ...d, ...patch })) }), [draft]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useOnboardingDraft(): Ctx {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useOnboardingDraft doit être utilisé dans <OnboardingDraftProvider>');
  return ctx;
}
