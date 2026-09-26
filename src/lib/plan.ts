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

/** Jours de Premium restants (arrondis au jour supérieur, jamais négatifs). */
export function daysLeft(until: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 86_400_000));
}
