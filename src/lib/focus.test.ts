/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { primaryMetric, secondaryMetrics } from './focus.ts';

test('les protéines passent devant en prise de masse', () => {
  assert.equal(primaryMetric('prise'), 'proteines');
  assert.equal(primaryMetric('perte'), 'kcal');
  assert.equal(primaryMetric('maintien'), 'kcal');
  // Profil incomplet : les calories, comme avant.
  assert.equal(primaryMetric(null), 'kcal');
  assert.equal(primaryMetric(undefined), 'kcal');
});

test('le chiffre mis en avant ne disparaît jamais du second rang', () => {
  for (const primary of ['kcal', 'proteines'] as const) {
    const seconds = secondaryMetrics(primary);
    assert.equal(seconds.length, 3);
    assert.ok(!seconds.includes(primary), 'pas affiché deux fois');
    assert.deepEqual([...seconds, primary].sort(), ['glucides', 'kcal', 'lipides', 'proteines']);
  }
  // Celui qui cède la vedette reste le premier des trois.
  assert.equal(secondaryMetrics('proteines')[0], 'kcal');
  assert.equal(secondaryMetrics('kcal')[0], 'proteines');
});
