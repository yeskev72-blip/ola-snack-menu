/**
 * Huile de cuisson : ajuster un plat cuisiné avec plus ou moins de gras que d'habitude.
 *
 * Dans la table des plats, l'huile est déjà comprise dans chaque ligne — « Sauce tomate à
 * l'huile » porte ses 7 g de lipides. Ajouter une cuillère d'huile par-dessus la compterait
 * deux fois. Le réglage agit donc sur la matière grasse déjà comptée, et non en plus d'elle.
 *
 * Conséquence utile : un plat sans gras ne bouge pas. Une pomme n'a pas de lipides, donc aucun
 * niveau ne change ses calories, sans qu'il faille distinguer les plats cuisinés des autres.
 *
 * Les deux coefficients sont une convention, pas une mesure. Ils disent « environ un quart de
 * gras en moins » et « un tiers de plus », ce qui correspond à une main plus ou moins généreuse
 * sur la bouteille. À confronter à un nutritionniste avant de les présenter comme exacts.
 *
 * Module pur, sans dépendance : testé avec `node --test`.
 */

import { round1 } from './format.ts';

export const OIL_LEVELS = ['peu', 'normal', 'beaucoup'] as const;
export type OilLevel = (typeof OIL_LEVELS)[number];
export const DEFAULT_OIL: OilLevel = 'normal';

const FACTORS: Record<OilLevel, number> = { peu: 0.75, normal: 1, beaucoup: 1.35 };

/** 1 g de lipides vaut 9 kcal (facteur d'Atwater) : le seul lien entre gras retiré et calories. */
const KCAL_PER_GRAM_FAT = 9;

export function isOilLevel(value: unknown): value is OilLevel {
  return typeof value === 'string' && (OIL_LEVELS as readonly string[]).includes(value);
}

type Adjustable = { kcal: number; lipides: number };

/**
 * Applique le niveau d'huile à un aliment déjà calculé.
 *
 * Seuls les lipides et les calories bougent : changer la quantité d'huile ne change ni les
 * protéines ni les glucides du plat. Rien ne peut devenir négatif.
 */
export function applyOil<T extends Adjustable>(valeurs: T, niveau: OilLevel): T {
  const facteur = FACTORS[niveau];
  if (facteur === 1) return valeurs;
  const lipides = Math.max(0, round1(valeurs.lipides * facteur));
  const ecart = lipides - valeurs.lipides;
  // Les calories sont arrondies à l'unité : un dixième de calorie ne veut rien dire, et le
  // réglage en faisait apparaître là où il n'y en avait pas.
  return { ...valeurs, lipides, kcal: Math.max(0, Math.round(valeurs.kcal + ecart * KCAL_PER_GRAM_FAT)) };
}
