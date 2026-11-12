/**
 * Temps de saisie d'un repas scanné : de la photo choisie au repas enregistré.
 *
 * La promesse est « moins de 30 secondes », et rien ne la vérifiait. Ce module transforme les
 * instants relevés au fil du parcours en durées par étape, pour savoir non seulement si la
 * promesse tient, mais où part le temps quand elle ne tient pas : la photo, le réseau et l'IA,
 * ou la relecture.
 *
 * Seuls les repas partis d'une photo fraîche sont mesurés. Un ajout à la main, un repas refait
 * ou une photo gardée hors ligne puis reprise n'ont pas de déclencheur comparable.
 *
 * Module pur, sans dépendance : testé avec `node --test`.
 */

/** La promesse du produit, en millisecondes. */
export const TARGET_MS = 30_000;

/**
 * Au-delà, la personne a posé son téléphone en route : ce n'est plus un temps de saisie, et une
 * seule de ces valeurs fausserait toutes les moyennes. Le parcours n'est alors pas compté.
 */
export const MAX_TOTAL_MS = 30 * 60_000;

/** Instants relevés pendant le parcours (millisecondes, horloge du téléphone). */
export type ScanMarks = {
  /** Le sélecteur ou l'appareil photo vient de rendre l'image. */
  pickedAt: number;
  /** L'image est réduite et prête à partir. */
  preparedAt: number;
  /** Début et fin de la dernière analyse, celle qui a abouti. */
  analyzeAt?: number;
  analyzedAt?: number;
  /** Analyses lancées, échecs et annulations compris. */
  attempts: number;
  /** La personne a répondu aux questions de clarification. */
  followUp: boolean;
};

export type ScanTiming = {
  total_ms: number;
  prep_ms: number;
  analysis_ms: number;
  review_ms: number;
  attempts: number;
  follow_up: boolean;
};

/**
 * Durées du parcours, ou null s'il n'est pas mesurable : analyse jamais aboutie, instants dans
 * le désordre (horloge du téléphone changée en route), ou parcours abandonné puis repris.
 *
 * Les trois étapes ne font pas le total : le reste est le temps passé entre la photo prête et
 * l'analyse aboutie — hésitation, indice tapé, essais ratés. Il se lit par différence.
 */
export function scanTiming(marks: ScanMarks | null | undefined, savedAt: number): ScanTiming | null {
  if (!marks || marks.analyzeAt === undefined || marks.analyzedAt === undefined) return null;
  const { pickedAt, preparedAt, analyzeAt, analyzedAt } = marks;
  const ordered = pickedAt <= preparedAt && preparedAt <= analyzeAt && analyzeAt <= analyzedAt && analyzedAt <= savedAt;
  if (!ordered) return null;
  const total = savedAt - pickedAt;
  if (total > MAX_TOTAL_MS) return null;
  return {
    total_ms: Math.round(total),
    prep_ms: Math.round(preparedAt - pickedAt),
    analysis_ms: Math.round(analyzedAt - analyzeAt),
    review_ms: Math.round(savedAt - analyzedAt),
    attempts: Math.min(20, Math.max(1, marks.attempts)),
    follow_up: marks.followUp,
  };
}

export const NETWORKS = ['wifi', '2g', '3g', '4g', '5g', 'cellular', 'unknown'] as const;
export type Network = (typeof NETWORKS)[number];

/**
 * Nom du réseau à joindre à la mesure : le même parcours n'a pas le même sens en Wi-Fi et en 3G.
 *
 * Sur téléphone, c'est la technologie radio. Sur le web le navigateur ne la connaît pas et ne
 * donne qu'une classe de débit (`effectiveType`) : on la prend faute de mieux, en sachant qu'un
 * Wi-Fi lent s'y présente comme « 3g ». Pour juger de la lenteur, c'est d'ailleurs l'information
 * utile.
 */
export function networkLabel(type: string | null | undefined, generation: string | null | undefined, effectiveType: string | null | undefined): Network {
  if (type === 'wifi' || type === 'ethernet') return 'wifi';
  const known = (value: string | null | undefined): Network | null =>
    value === 'slow-2g' ? '2g' : value === '2g' || value === '3g' || value === '4g' || value === '5g' ? value : null;
  if (type === 'cellular') return known(generation) ?? known(effectiveType) ?? 'cellular';
  return known(effectiveType) ?? 'unknown';
}
