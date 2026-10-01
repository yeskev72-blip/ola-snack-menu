/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CODE_LENGTH, codeBoxCount, isValidCode, isValidEmail, normalizeCode, parseNumber } from './validation.ts';

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

// Une septième case après un code de six chiffres laissait croire qu'il manquait un chiffre.
test('codeBoxCount : jamais de case vide au-delà du code', () => {
  for (let saisi = 0; saisi <= CODE_LENGTH.min; saisi++) {
    assert.equal(codeBoxCount(saisi), CODE_LENGTH.min, `${saisi} chiffres saisis`);
  }
});

test('codeBoxCount : le champ s’allonge pour les codes plus longs', () => {
  assert.equal(codeBoxCount(7), 7);
  assert.equal(codeBoxCount(9), 9);
  assert.equal(codeBoxCount(CODE_LENGTH.max), CODE_LENGTH.max);
  assert.equal(codeBoxCount(99), CODE_LENGTH.max, 'jamais au-delà du maximum');
});

test('codeBoxCount : longueurs absurdes ramenées au minimum', () => {
  assert.equal(codeBoxCount(-3), CODE_LENGTH.min);
  assert.equal(codeBoxCount(Number.NaN), CODE_LENGTH.min);
  assert.equal(codeBoxCount(4.7), CODE_LENGTH.min);
});
