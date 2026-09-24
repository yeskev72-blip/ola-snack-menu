/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCorrection } from './corrections.ts';

const predicted = [
  { food_key: 'riz_blanc', label: 'Riz blanc', grams: 280 },
  { food_key: 'autre', label: 'Piment', grams: 10 },
];

test('aucune modification : pas de correction (ordre indifférent)', () => {
  const final = [
    { food_key: null, label: 'Piment', grams: 10 },
    { food_key: 'riz_blanc', label: 'Riz blanc', grams: 280.04 },
  ];
  assert.equal(buildCorrection(predicted, final), null);
});

test('quantité, aliment, libellé, ajout ou retrait : correction', () => {
  assert.ok(buildCorrection(predicted, [{ ...predicted[0]!, grams: 350 }, predicted[1]!]));
  assert.ok(buildCorrection(predicted, [{ ...predicted[0]!, food_key: 'riz_jollof' }, predicted[1]!]));
  assert.ok(buildCorrection(predicted, [{ ...predicted[0]!, label: 'Riz parfumé' }, predicted[1]!]));
  assert.ok(buildCorrection(predicted, [predicted[0]!]));
  assert.ok(buildCorrection(predicted, [...predicted, { food_key: 'huile_palme', label: 'Huile', grams: 13 }]));
});

test('la correction contient la prédiction et la saisie finale normalisées', () => {
  const c = buildCorrection(predicted, [predicted[0]!]);
  assert.deepEqual(c?.predicted[1], { food_key: null, label: 'Piment', grams: 10 });
  assert.equal(c?.corrected.length, 1);
});
