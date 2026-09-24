/**
 * Calcul des calories et macros d'un repas à partir de la table foods (valeurs pour 100 g).
 * Les chiffres du modèle ne servent que pour les éléments hors table (« autre »), marqués estimés.
 * Module pur (sans import) : testé avec `node --test`.
 */

export type Per100g = { kcal: number; proteines: number; glucides: number; lipides: number };

export type FoodValues = {
  food_key: string;
  kcal_100g: number;
  proteines_100g: number;
  glucides_100g: number;
  lipides_100g: number;
};

export type NutritionItem = {
  food_key: string | null;
  grams: number;
  /** Estimation de l'IA pour 100 g, utilisée seulement si l'aliment n'est pas dans la table. */
  estimate_100g: Per100g | null;
  /** Confiance de l'IA (0 à 1) ; null pour un élément saisi ou corrigé par l'utilisateur. */
  confidence: number | null;
};

export type Nutrients = { kcal: number; proteines: number; glucides: number; lipides: number };

export type ItemNutrition = Nutrients & {
  /** true si les valeurs ne viennent pas de la table foods. */
  estimated: boolean;
};

export type MealNutrition = {
  items: ItemNutrition[];
  total: Nutrients;
  /** Confiance pondérée par les calories (0 à 1). */
  confidence: number;
  /** Fourchette affichée quand la confiance est faible ; null sinon. */
  range: { low: number; high: number } | null;
};

/** En dessous de ce seuil de confiance, on affiche une fourchette plutôt qu'un chiffre. */
export const RANGE_THRESHOLD = 0.7;

const round1 = (v: number) => Math.round(v * 10) / 10;

export function foodPer100g(food: FoodValues): Per100g {
  return { kcal: food.kcal_100g, proteines: food.proteines_100g, glucides: food.glucides_100g, lipides: food.lipides_100g };
}

export function itemNutrition(item: NutritionItem, foods: ReadonlyMap<string, FoodValues>): ItemNutrition {
  const food = item.food_key ? foods.get(item.food_key) : undefined;
  const per100 = food ? foodPer100g(food) : item.estimate_100g;
  if (!per100) return { kcal: 0, proteines: 0, glucides: 0, lipides: 0, estimated: true };
  const factor = Math.max(item.grams, 0) / 100;
  return {
    kcal: round1(per100.kcal * factor),
    proteines: round1(per100.proteines * factor),
    glucides: round1(per100.glucides * factor),
    lipides: round1(per100.lipides * factor),
    estimated: !food,
  };
}

/** Marge relative de la fourchette selon la confiance : 10 % au seuil, jusqu'à 35 %. */
export function rangeMargin(confidence: number): number {
  return Math.min(0.35, 0.1 + (RANGE_THRESHOLD - confidence) * 0.5);
}

export function mealNutrition(items: NutritionItem[], foods: ReadonlyMap<string, FoodValues>): MealNutrition {
  const computed = items.map((item) => itemNutrition(item, foods));
  const total = computed.reduce<Nutrients>(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      proteines: acc.proteines + n.proteines,
      glucides: acc.glucides + n.glucides,
      lipides: acc.lipides + n.lipides,
    }),
    { kcal: 0, proteines: 0, glucides: 0, lipides: 0 },
  );

  // Confiance pondérée par les calories : un élément corrigé par l'utilisateur compte pour 1.
  const weight = computed.reduce((sum, n) => sum + n.kcal, 0);
  const confidence =
    weight > 0 ? computed.reduce((sum, n, i) => sum + n.kcal * (items[i]!.confidence ?? 1), 0) / weight : 1;

  const kcal = Math.round(total.kcal);
  let range: MealNutrition['range'] = null;
  if (confidence < RANGE_THRESHOLD && kcal > 0) {
    const margin = rangeMargin(confidence);
    range = { low: Math.floor((kcal * (1 - margin)) / 10) * 10, high: Math.ceil((kcal * (1 + margin)) / 10) * 10 };
  }

  return {
    items: computed,
    total: { kcal, proteines: round1(total.proteines), glucides: round1(total.glucides), lipides: round1(total.lipides) },
    confidence: Math.round(confidence * 100) / 100,
    range,
  };
}
