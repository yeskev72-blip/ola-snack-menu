/** Contrôles de saisie partagés par les formulaires. */

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 8;

/** Longueur des codes reçus par e-mail : réglable dans Supabase (6 par défaut, 8 sur certains projets). */
export const CODE_LENGTH = { min: 6, max: 10 } as const;

export const isValidCode = (code: string) => new RegExp(`^\\d{${CODE_LENGTH.min},${CODE_LENGTH.max}}$`).test(code.trim());

/** Garde uniquement les chiffres saisis ou collés, dans la limite de la longueur maximale. */
export const normalizeCode = (text: string) => text.replace(/\D/g, '').slice(0, CODE_LENGTH.max);

/** « 65,5 » ou « 65.5 » → 65.5 ; renvoie null si ce n'est pas un nombre. */
export function parseNumber(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : null;
}
