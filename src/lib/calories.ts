/**
 * Cible calorique journalière : Mifflin-St Jeor × facteur d'activité, ajustée à l'objectif.
 * Module pur (sans import) pour être testé directement avec `node --test`.
 */

export type Sex = 'femme' | 'homme';
export type Goal = 'perte' | 'maintien' | 'prise';

export const ACTIVITY_LEVELS = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
  tres_actif: 1.9,
} as const;
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;

/** Écart appliqué à la dépense estimée selon l'objectif (kcal/jour). */
const GOAL_DELTA: Record<Goal, number> = { perte: -500, maintien: 0, prise: 300 };

/** Plancher de sécurité pour un objectif de perte de poids. */
const MIN_TARGET: Record<Sex, number> = { femme: 1200, homme: 1500 };

/** Bornes acceptées par la base (profiles.calories_cible). */
export const TARGET_BOUNDS = { min: 1000, max: 6000 } as const;

export type BodyInfo = {
  sexe: Sex;
  age: number;
  taille_cm: number;
  poids_kg: number;
};

/** Métabolisme de base (kcal/jour), formule de Mifflin-St Jeor. */
export function basalMetabolicRate({ sexe, age, taille_cm, poids_kg }: BodyInfo): number {
  const base = 10 * poids_kg + 6.25 * taille_cm - 5 * age;
  return sexe === 'homme' ? base + 5 : base - 161;
}

export function dailyTarget(body: BodyInfo, activity: number, goal: Goal): number {
  const expenditure = basalMetabolicRate(body) * activity;
  let target = expenditure + GOAL_DELTA[goal];
  if (goal === 'perte') target = Math.max(target, MIN_TARGET[body.sexe]);
  return clampTarget(Math.round(target / 10) * 10);
}

export function clampTarget(kcal: number): number {
  return Math.min(TARGET_BOUNDS.max, Math.max(TARGET_BOUNDS.min, Math.round(kcal)));
}

/** Répartition conseillée de la cible (part des kcal) : protéines 25 %, glucides 50 %, lipides 25 %. */
export const MACRO_SPLIT = { proteines: 0.25, glucides: 0.5, lipides: 0.25 } as const;

/** Grammes visés par macro pour une cible (4 kcal/g protéines et glucides, 9 kcal/g lipides). */
export function macroTargets(kcal: number): { proteines: number; glucides: number; lipides: number } {
  return {
    proteines: Math.round((kcal * MACRO_SPLIT.proteines) / 4),
    glucides: Math.round((kcal * MACRO_SPLIT.glucides) / 4),
    lipides: Math.round((kcal * MACRO_SPLIT.lipides) / 9),
  };
}
