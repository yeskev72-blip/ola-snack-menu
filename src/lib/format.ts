/**
 * Affichage des nombres : au plus une décimale, virgule française (52,3 kcal ; 150 g).
 * Module pur (sans import) : testé avec `node --test`.
 */

export const round1 = (v: number) => Math.round(v * 10) / 10;

/** 52.34 → « 52,3 » ; 52.04 → « 52 » ; -0.04 → « 0 ». */
export function formatNumber(value: number): string {
  const rounded = round1(value);
  return String(rounded === 0 ? 0 : rounded).replace('.', ',');
}
