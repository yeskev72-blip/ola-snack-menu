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
