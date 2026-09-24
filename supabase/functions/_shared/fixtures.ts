/** Données de test partagées (pas utilisées en production). */
import type { FoodRef } from './analysis.ts';

export const FOODS: FoodRef[] = [
  { food_key: 'riz_blanc', label_fr: 'Riz blanc cuit', aliases: ['riz nature'], portion_reperes: { assiette: 300 } },
  { food_key: 'sauce_arachide', label_fr: 'Sauce arachide', aliases: ['mafé'], portion_reperes: { louche: 120 } },
  { food_key: 'poulet_braise', label_fr: 'Poulet braisé', aliases: [], portion_reperes: {} },
];

export const KEYS = new Set(FOODS.map((f) => f.food_key));

/** En-tête JPEG minimal encodé en base64 (commence par /9j/). */
export const JPEG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP' + 'A'.repeat(64);

export const VALID_OUTPUT = {
  not_food: false,
  items: [
    { food_key: 'riz_blanc', label: 'Riz blanc', grams: 280, confidence: 0.9, estimate_100g: null },
    { food_key: 'sauce_arachide', label: 'Sauce arachide', grams: 130, confidence: 0.55, estimate_100g: null },
  ],
  questions: [{ id: 'sauce', text: 'Sauce arachide ou sauce graine ?', options: ['Arachide', 'Graine'] }],
  confidence_globale: 0.6,
};
