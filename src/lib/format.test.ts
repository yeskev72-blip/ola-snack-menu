import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatNumber, round1 } from './format.ts';

test('une décimale au plus, virgule française, pas de « ,0 »', () => {
  assert.equal(formatNumber(52.34), '52,3');
  assert.equal(formatNumber(52.35), '52,4');
  assert.equal(formatNumber(52.04), '52');
  assert.equal(formatNumber(150), '150');
  assert.equal(formatNumber(0.3), '0,3');
  assert.equal(formatNumber(-0.04), '0');
  assert.equal(formatNumber(1234.56), '1234,6');
  assert.equal(round1(84.64), 84.6);
});
