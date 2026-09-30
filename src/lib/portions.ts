/**
 * Repères de portion locaux (louche, bol, boule…) convertis en grammes.
 * Module pur : les libellés traduits sont dans src/lib/portionLabels.ts.
 */

export type PortionUnit = { name: string; grams: number };

/** Repères génériques quand la table n'en donne pas pour un aliment. */
export const GENERIC_UNITS: Record<string, number> = { cuillere: 15, louche: 120, bol: 250, assiette: 300 };

/** Repères proposés pour un aliment : ceux de la table en priorité, sinon les génériques. */
export function unitsFor(reperes: Record<string, number> | null | undefined): PortionUnit[] {
  const source = reperes && Object.keys(reperes).length > 0 ? reperes : GENERIC_UNITS;
  return Object.entries(source)
    .filter(([, grams]) => grams > 0)
    .map(([name, grams]) => ({ name, grams }))
    .sort((a, b) => a.grams - b.grams);
}

export type SizeChoice = { name: 'small' | 'medium' | 'large'; grams: number };

/** Écarts appliqués à l'estimation de l'IA pour proposer trois tailles. */
const SIZE_FACTORS: { name: SizeChoice['name']; factor: number }[] = [
  { name: 'small', factor: 0.65 },
  { name: 'medium', factor: 1 },
  { name: 'large', factor: 1.5 },
];

/** Arrondi lisible : au plus proche 5 g sous 50 g, sinon au plus proche 10 g. */
const roundNice = (grams: number) => (grams < 50 ? Math.round(grams / 5) * 5 : Math.round(grams / 10) * 10);

/**
 * Trois tailles autour de l'estimation de l'IA, pour corriger un poids d'un seul appui.
 * L'IA reconnaît bien l'aliment mais juge mal sa taille : elle donne le repère, l'utilisateur tranche.
 * Renvoie une liste vide si les trois tailles ne sont pas distinctes ou si l'estimation est absurde.
 */
export function sizeChoices(baseGrams: number, maxGrams = 5000): SizeChoice[] {
  if (!Number.isFinite(baseGrams) || baseGrams <= 0) return [];
  const choices = SIZE_FACTORS.map(({ name, factor }) => ({
    name,
    grams: Math.min(maxGrams, Math.max(1, roundNice(baseGrams * factor))),
  }));
  const distinct = new Set(choices.map((c) => c.grams));
  return distinct.size === choices.length ? choices : [];
}

/** Arrondi au demi : 1,3 → 1,5 ; 0,2 → 0,5 (jamais zéro). */
export const roundHalf = (v: number) => Math.max(0.5, Math.round(v * 2) / 2);

/**
 * Repère le plus parlant pour une quantité en grammes : celui dont le nombre tombe
 * entre ½ et 6. Renvoie null si aucun ne convient (on affiche alors les grammes).
 */
export function describeGrams(grams: number, units: PortionUnit[]): { unit: PortionUnit; count: number } | null {
  let best: { unit: PortionUnit; count: number; score: number } | null = null;
  for (const unit of units) {
    const exact = grams / unit.grams;
    if (exact < 0.4 || exact > 6) continue;
    const count = roundHalf(exact);
    // Préfère l'écart le plus faible, puis un nombre proche de 1.
    const score = Math.abs(count * unit.grams - grams) / grams + Math.abs(Math.log(count)) * 0.05;
    if (!best || score < best.score) best = { unit, count, score };
  }
  return best && { unit: best.unit, count: best.count };
}
