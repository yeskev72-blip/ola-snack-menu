import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sizeChoices, unitsFor } from './portions.ts';

test('unitsFor : repères de la table en priorité, génériques sinon', () => {
  assert.deepEqual(unitsFor({ boule: 90 }), [{ name: 'boule', grams: 90 }]);
  assert.deepEqual(unitsFor(null).map((u) => u.name), ['cuillere', 'louche', 'bol', 'assiette']);
  assert.deepEqual(unitsFor({}).map((u) => u.name), ['cuillere', 'louche', 'bol', 'assiette']);
});

// Une pomme pesée à 100 g était annoncée à 150 g. Le modèle reconnaît l'aliment mais juge mal
// sa taille : l'utilisateur doit pouvoir corriger d'un seul appui, sans taper au clavier.
test('sizeChoices : trois tailles autour de l’estimation', () => {
  assert.deepEqual(sizeChoices(150), [
    { name: 'small', grams: 100 },
    { name: 'medium', grams: 150 },
    { name: 'large', grams: 230 },
  ]);
  // Le cas réel : « petite » doit retomber sur le poids pesé.
  assert.equal(sizeChoices(150)[0]!.grams, 100);
});

test('sizeChoices : arrondis lisibles et bornes', () => {
  assert.deepEqual(sizeChoices(40).map((c) => c.grams), [25, 40, 60], 'au plus proche 5 g sous 50 g');
  assert.deepEqual(sizeChoices(300).map((c) => c.grams), [200, 300, 450]);
  assert.deepEqual(sizeChoices(4000).map((c) => c.grams), [2600, 4000, 5000], 'plafonné au maximum accepté');
});

test('sizeChoices : rien à proposer quand les tailles se confondent ou que l’estimation est absurde', () => {
  assert.deepEqual(sizeChoices(0), []);
  assert.deepEqual(sizeChoices(-5), []);
  assert.deepEqual(sizeChoices(Number.NaN), []);
  assert.deepEqual(sizeChoices(5), [], 'trop petit pour trois tailles distinctes');
  assert.deepEqual(sizeChoices(5000), [], 'déjà au plafond : « moyenne » et « grosse » se confondraient');
});
