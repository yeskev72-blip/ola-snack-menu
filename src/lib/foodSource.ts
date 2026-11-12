/**
 * Provenance d'une valeur nutritionnelle, pour l'écran « Détail et sources ».
 *
 * La douleur visée est bloquante dans les entretiens de la Phase 1 (« doute sur la fiabilité
 * des outils », citée par les quatre professionnels) : la réponse n'est pas une pastille
 * rassurante, c'est la phrase exacte qui dit d'où sort le chiffre, y compris quand elle
 * reconnaît que rien n'a encore été confronté à une table de référence.
 *
 * Module pur, sans dépendance React Native : testable avec `node --test`.
 */

/** Ce qui soutient un chiffre, du plus solide au plus fragile. */
export type SourceTone = 'table' | 'unverified' | 'ai';

export type SourcedFood = { source?: string | null; verified: boolean };

/**
 * @param food L'aliment de la table, ou undefined s'il n'y est pas.
 * @param estimated true quand les valeurs viennent du modèle et non de la table.
 */
export function sourceTone(food: SourcedFood | null | undefined, estimated: boolean): SourceTone {
  if (!food || estimated) return 'ai';
  return food.verified ? 'table' : 'unverified';
}

/**
 * Phrase de provenance enregistrée avec l'aliment. Null quand il n'y en a pas : le cache local
 * d'une version précédente ne porte pas encore la colonne, et un élément hors table n'en a
 * jamais eu. L'écran affiche alors le seul fait dont il est sûr, donné par le ton.
 */
export function sourceText(food: SourcedFood | null | undefined): string | null {
  const text = food?.source?.trim();
  return text ? text : null;
}
