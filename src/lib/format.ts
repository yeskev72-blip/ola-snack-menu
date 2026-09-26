/**
 * Affichage des nombres : au plus une décimale, virgule française (52,3 kcal ; 150 g).
 * Module pur (sans import) : testé avec `node --test`.
 */

export const round1 = (v: number) => Math.round(v * 10) / 10;

/** Valeur d'un champ de saisie : une décimale, virgule, sans séparateur de milliers. */
export function formatInput(value: number): string {
  const rounded = round1(value);
  return String(rounded === 0 ? 0 : rounded).replace('.', ',');
}

/** 52.34 → « 52,3 » ; 52.04 → « 52 » ; -0.04 → « 0 » ; 1234.56 → « 1 234,6 » (espace insécable). */
export function formatNumber(value: number): string {
  const rounded = round1(value);
  const [int, dec] = String(rounded === 0 ? 0 : rounded).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return dec ? `${grouped},${dec}` : grouped;
}
