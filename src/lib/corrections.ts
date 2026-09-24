/**
 * Compare la prédiction de l'IA à la saisie finale de l'utilisateur.
 * Toute différence (élément ajouté, retiré, renommé, autre aliment, autre quantité)
 * produit une correction, enregistrée pour améliorer la table plus tard.
 * Module pur : testé avec `node --test`.
 */

export type ComparableItem = { food_key: string | null; label: string; grams: number };

type Normalized = { food_key: string | null; label: string; grams: number };

const OTHER = 'autre';

function normalize(item: ComparableItem): Normalized {
  return {
    food_key: item.food_key === OTHER ? null : item.food_key,
    label: item.label.trim(),
    grams: Math.round(item.grams * 10) / 10,
  };
}

const same = (a: Normalized, b: Normalized) => a.food_key === b.food_key && a.label === b.label && Math.abs(a.grams - b.grams) < 0.5;

export function buildCorrection(
  predicted: ComparableItem[],
  final: ComparableItem[],
): { predicted: Normalized[]; corrected: Normalized[] } | null {
  const p = predicted.map(normalize);
  const f = final.map(normalize);
  const remaining = [...p];
  const unchanged =
    p.length === f.length &&
    f.every((item) => {
      const index = remaining.findIndex((candidate) => same(candidate, item));
      if (index === -1) return false;
      remaining.splice(index, 1);
      return true;
    });
  return unchanged ? null : { predicted: p, corrected: f };
}
