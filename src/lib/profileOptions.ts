import type { MessageKey } from '@/i18n';
import { ACTIVITY_LEVELS, type ActivityLevel, type Goal } from '@/lib/calories';

export const GOALS: { value: Goal; label: MessageKey }[] = [
  { value: 'perte', label: 'onboarding.goalLose' },
  { value: 'maintien', label: 'onboarding.goalMaintain' },
  { value: 'prise', label: 'onboarding.goalGain' },
];

export const ACTIVITIES: { value: ActivityLevel; label: MessageKey }[] = [
  { value: 'sedentaire', label: 'onboarding.activitySedentaire' },
  { value: 'leger', label: 'onboarding.activityLeger' },
  { value: 'modere', label: 'onboarding.activityModere' },
  { value: 'actif', label: 'onboarding.activityActif' },
  { value: 'tres_actif', label: 'onboarding.activityTresActif' },
];

/** Niveau d'activité le plus proche d'un facteur enregistré (profiles.niveau_activite). */
export function activityFromFactor(factor: number | null): ActivityLevel {
  if (factor === null) return 'leger';
  let best: ActivityLevel = 'leger';
  for (const level of Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]) {
    if (Math.abs(ACTIVITY_LEVELS[level] - factor) < Math.abs(ACTIVITY_LEVELS[best] - factor)) best = level;
  }
  return best;
}
