/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isValidCode, isValidEmail, normalizeCode, parseNumber } from './validation.ts';

test('codes e-mail de 6 à 10 chiffres (6 ou 8 selon le réglage Supabase)', () => {
  assert.equal(isValidCode('123456'), true);
  assert.equal(isValidCode('12345678'), true);
  assert.equal(isValidCode(' 12345678 '), true);
  assert.equal(isValidCode('12345'), false);
  assert.equal(isValidCode('12345678901'), false);
  assert.equal(isValidCode('12a456'), false);
});

test('saisie du code : chiffres seulement, collage d’un code espacé', () => {
  assert.equal(normalizeCode('1234 5678'), '12345678');
  assert.equal(normalizeCode('12-34-56'), '123456');
  assert.equal(normalizeCode('123456789012'), '1234567890');
});

test('e-mail et nombres', () => {
  assert.equal(isValidEmail('awa@exemple.bj'), true);
  assert.equal(isValidEmail('awa@'), false);
  assert.equal(parseNumber('65,5'), 65.5);
  assert.equal(parseNumber(''), null);
});
