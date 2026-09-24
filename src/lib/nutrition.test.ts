/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { itemNutrition, mealNutrition, rangeMargin, type FoodValues } from './nutrition.ts';
import { describeGrams, roundHalf, unitsFor } from './portions.ts';

const foods = new Map<string, FoodValues>([
  ['riz_blanc', { food_key: 'riz_blanc', kcal_100g: 130, proteines_100g: 2.7, glucides_100g: 28.2, lipides_100g: 0.3 }],
  ['sauce_graine', { food_key: 'sauce_graine', kcal_100g: 180, proteines_100g: 4, glucides_100g: 5, lipides_100g: 16 }],
]);

test('élément de la table : grammes × valeurs pour 100 g', () => {
  const n = itemNutrition({ food_key: 'riz_blanc', grams: 300, estimate_100g: null, confidence: 0.9 }, foods);
  assert.deepEqual(n, { kcal: 390, proteines: 8.1, glucides: 84.6, lipides: 0.9, estimated: false });
});

test('la table prime sur une estimation du modèle', () => {
  const n = itemNutrition(
    { food_key: 'riz_blanc', grams: 100, estimate_100g: { kcal: 999, proteines: 0, glucides: 0, lipides: 0 }, confidence: 1 },
    foods,
  );
  assert.equal(n.kcal, 130);
  assert.equal(n.estimated, false);
});

test('élément hors table : estimation marquée comme telle', () => {
  const n = itemNutrition(
    { food_key: null, grams: 50, estimate_100g: { kcal: 200, proteines: 10, glucides: 20, lipides: 8 }, confidence: 0.5 },
    foods,
  );
  assert.deepEqual(n, { kcal: 100, proteines: 5, glucides: 10, lipides: 4, estimated: true });
});

test('élément sans données : zéro, marqué estimé', () => {
  const n = itemNutrition({ food_key: 'inconnu', grams: 100, estimate_100g: null, confidence: 1 }, foods);
  assert.equal(n.kcal, 0);
  assert.equal(n.estimated, true);
});

test('confiance élevée : chiffre simple, pas de fourchette', () => {
  const meal = mealNutrition(
    [
      { food_key: 'riz_blanc', grams: 300, estimate_100g: null, confidence: 0.9 },
      { food_key: 'sauce_graine', grams: 120, estimate_100g: null, confidence: 0.8 },
    ],
    foods,
  );
  assert.equal(meal.total.kcal, 606); // 390 + 216
  assert.equal(meal.range, null);
  assert.ok(meal.confidence > 0.8);
});

test('confiance faible : fourchette arrondie à 10 kcal', () => {
  const meal = mealNutrition(
    [
      { food_key: 'riz_blanc', grams: 300, estimate_100g: null, confidence: 0.5 },
      { food_key: 'sauce_graine', grams: 120, estimate_100g: null, confidence: 0.4 },
    ],
    foods,
  );
  assert.ok(meal.confidence < 0.7);
  assert.ok(meal.range);
  assert.ok(meal.range.low < 606 && meal.range.high > 606);
  assert.equal(meal.range.low % 10, 0);
  assert.equal(meal.range.high % 10, 0);
});

test('un élément corrigé par l’utilisateur compte comme sûr', () => {
  const meal = mealNutrition([{ food_key: 'riz_blanc', grams: 300, estimate_100g: null, confidence: null }], foods);
  assert.equal(meal.confidence, 1);
  assert.equal(meal.range, null);
});

test('marge de la fourchette bornée', () => {
  assert.ok(Math.abs(rangeMargin(0.7) - 0.1) < 1e-9);
  assert.equal(rangeMargin(0), 0.35);
});

test('repère de portion', () => {
  assert.deepEqual(unitsFor({ louche: 120, cuillere: 13 }), [
    { name: 'cuillere', grams: 13 },
    { name: 'louche', grams: 120 },
  ]);
  assert.equal(unitsFor({}).length, 4, 'repères génériques');
  assert.equal(roundHalf(1.3), 1.5);
  assert.equal(roundHalf(0.1), 0.5);
  const units = unitsFor({ louche: 120 });
  assert.deepEqual(describeGrams(250, units), { unit: { name: 'louche', grams: 120 }, count: 2 });
  assert.equal(describeGrams(2000, units), null);
});
