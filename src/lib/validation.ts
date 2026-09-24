/** Contrôles de saisie partagés par les formulaires. */

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 8;

export const isValidCode = (code: string) => /^\d{6}$/.test(code.trim());

/** « 65,5 » ou « 65.5 » → 65.5 ; renvoie null si ce n'est pas un nombre. */
export function parseNumber(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : null;
}
