/** Contrôles de saisie partagés par les formulaires. */

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 8;

/** Longueur des codes reçus par e-mail : réglable dans Supabase (6 par défaut, 8 sur certains projets). */
export const CODE_LENGTH = { min: 6, max: 10 } as const;

/**
 * Nombre de cases à afficher pour un code en cours de saisie.
 *
 * Jamais de case vide au-delà du code : une septième case après six chiffres laisse croire
 * qu'il manque un chiffre, alors que le code est complet. Le champ part donc à la longueur
 * minimale et ne s'allonge qu'au fur et à mesure des chiffres réellement tapés, pour les
 * projets Supabase dont le code dépasse six chiffres.
 */
export function codeBoxCount(length: number, min: number = CODE_LENGTH.min, max: number = CODE_LENGTH.max): number {
  return Math.min(max, Math.max(min, Number.isFinite(length) ? Math.max(0, Math.trunc(length)) : 0));
}

export const isValidCode = (code: string) => new RegExp(`^\\d{${CODE_LENGTH.min},${CODE_LENGTH.max}}$`).test(code.trim());

/** Garde uniquement les chiffres saisis ou collés, dans la limite de la longueur maximale. */
export const normalizeCode = (text: string) => text.replace(/\D/g, '').slice(0, CODE_LENGTH.max);

/** « 65,5 » ou « 65.5 » → 65.5 ; renvoie null si ce n'est pas un nombre. */
export function parseNumber(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : null;
}
