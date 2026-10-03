/**
 * Détail technique court d'une erreur, à montrer derrière un message lisible.
 *
 * Un message générique ne laisse aucune prise : ni à la personne qui le lit, ni à qui elle le
 * rapporte. Deux pannes différentes se ressemblent alors à l'écran, et on cherche à l'aveugle.
 * Quelques mots suffisent à distinguer une mémoire saturée d'un format refusé.
 */
const MAX = 120;

export function errorDetail(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ((error as { message?: unknown } | null)?.message ?? null);
  if (typeof message !== 'string' || !message.trim()) return '';
  const court = message.trim().replace(/\s+/g, ' ').slice(0, MAX);
  return ` (${court})`;
}
