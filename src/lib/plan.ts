/**
 * Statut de l'abonnement affiché dans l'app (le serveur applique la même règle : effective_plan).
 * Module pur : testé avec `node --test`.
 */

export type PlanStatus = { kind: 'free' } | { kind: 'premium'; until: Date | null };

/** Premium actif si plan = premium et pas encore expiré ; sans date de fin = permanent. */
export function planStatus(plan: string | null | undefined, premiumUntil: string | null | undefined, now = new Date()): PlanStatus {
  if (plan !== 'premium') return { kind: 'free' };
  if (!premiumUntil) return { kind: 'premium', until: null };
  const until = new Date(premiumUntil);
  return until.getTime() > now.getTime() ? { kind: 'premium', until } : { kind: 'free' };
}

/** « 25/10/2026 » (date locale du téléphone). */
export function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Pays proposés pour le paiement mobile money (code ISO → indicatif). */
export const PAYMENT_COUNTRIES = [
  { code: 'BJ', label: 'Bénin' },
  { code: 'TG', label: 'Togo' },
  { code: 'CI', label: "Côte d'Ivoire" },
  { code: 'SN', label: 'Sénégal' },
  { code: 'BF', label: 'Burkina Faso' },
  { code: 'ML', label: 'Mali' },
  { code: 'NE', label: 'Niger' },
  { code: 'CM', label: 'Cameroun' },
] as const;
