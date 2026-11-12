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

/**
 * Répartition de repli, en part des calories : protéines 25 %, glucides 50 %, lipides 25 %.
 *
 * Ne sert plus que lorsque le poids ou l'objectif manquent (profil incomplet, compte invité).
 * Voir `PROTEIN_PER_KG` pour la raison.
 */
export const MACRO_SPLIT = { proteines: 0.25, glucides: 0.5, lipides: 0.25 } as const;

/**
 * Protéines visées par kilo de poids de corps et par jour, selon l'objectif.
 *
 * Les protéines se comptent au poids du corps, pas en part des calories : c'est le muscle qu'on
 * nourrit, pas l'assiette. La part fixe de 25 % donnait 2,6 g/kg à qui mange 2 900 kcal et
 * 1,1 g/kg à qui en mange 1 600 — trop à l'un, trop peu à l'autre, et ce sont précisément les
 * deux profils visés.
 *
 * En perte, la ration est plus haute qu'en prise : à calories réduites, c'est elle qui empêche
 * de perdre du muscle avec le gras.
 *
 * Fourchette de référence 1,6–2,2 g/kg. Ces trois valeurs sont une convention raisonnable, pas
 * une prescription : à confronter à un nutritionniste avant d'être présentées comme exactes.
 */
export const PROTEIN_PER_KG: Record<Goal, number> = { perte: 2, maintien: 1.6, prise: 1.8 };

/**
 * Part maximale des calories laissée aux protéines.
 *
 * Sans elle, un poids élevé associé à une cible basse (120 kg au plancher de 1 000 kcal) ferait
 * des protéines la quasi-totalité du repas, et il ne resterait plus de quoi manger.
 *
 * Le seuil est à 45 % et non plus bas : en sèche, un gabarit lourd vise une ration élevée sur peu
 * de calories, et c'est exactement le cas que le plafond ne doit pas écraser. À 90 kg sur
 * 1 600 kcal, 2,0 g/kg demandent 45 % des calories — le plafond effleure sans entamer.
 */
const MAX_PROTEIN_SHARE = 0.45;

/** Part des calories restantes revenant aux glucides ; le reste va aux lipides. Comme MACRO_SPLIT. */
const CARB_SHARE_OF_REST = MACRO_SPLIT.glucides / (MACRO_SPLIT.glucides + MACRO_SPLIT.lipides);

/** Facteurs d'Atwater : énergie d'un gramme de chaque macro. */
export const KCAL_PER_GRAM = { proteines: 4, glucides: 4, lipides: 9 } as const;

export type MacroTargets = { proteines: number; glucides: number; lipides: number };

/** Ce qu'il faut connaître du corps pour viser les protéines ; les deux peuvent manquer. */
export type MacroBody = { poids_kg: number | null; objectif: Goal | null };

/**
 * Grammes visés par macro pour une cible calorique.
 *
 * Les protéines sont fixées d'abord, d'après le poids ; glucides et lipides se partagent ce qui
 * reste dans les mêmes proportions qu'avant (deux tiers, un tiers). Sans poids ni objectif, on
 * retombe exactement sur l'ancienne répartition en pourcentage.
 */
export function macroTargets(kcal: number, body?: MacroBody | null): MacroTargets {
  const proteines = proteinKcal(kcal, body);
  const reste = Math.max(0, kcal - proteines);
  return {
    proteines: Math.round(proteines / KCAL_PER_GRAM.proteines),
    glucides: Math.round((reste * CARB_SHARE_OF_REST) / KCAL_PER_GRAM.glucides),
    lipides: Math.round((reste * (1 - CARB_SHARE_OF_REST)) / KCAL_PER_GRAM.lipides),
  };
}

function proteinKcal(kcal: number, body?: MacroBody | null): number {
  if (!body?.poids_kg || !body.objectif) return kcal * MACRO_SPLIT.proteines;
  const grammes = body.poids_kg * PROTEIN_PER_KG[body.objectif];
  return Math.min(grammes * KCAL_PER_GRAM.proteines, kcal * MAX_PROTEIN_SHARE);
}

/**
 * Part des calories réellement apportée par chaque macro, d'après les grammes retenus.
 *
 * La répartition n'étant plus une constante, les écrans qui l'affichent (anneau et pourcentages
 * de l'accueil) doivent la lire ici plutôt que de citer MACRO_SPLIT, qui mentirait.
 */
export function macroShares(targets: MacroTargets): MacroTargets {
  const kcal = targets.proteines * KCAL_PER_GRAM.proteines + targets.glucides * KCAL_PER_GRAM.glucides + targets.lipides * KCAL_PER_GRAM.lipides;
  if (kcal <= 0) return { proteines: 0, glucides: 0, lipides: 0 };
  return {
    proteines: (targets.proteines * KCAL_PER_GRAM.proteines) / kcal,
    glucides: (targets.glucides * KCAL_PER_GRAM.glucides) / kcal,
    lipides: (targets.lipides * KCAL_PER_GRAM.lipides) / kcal,
  };
}
