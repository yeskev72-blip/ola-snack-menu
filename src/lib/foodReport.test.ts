import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanReport, isSendableReport, REPORT_MAX } from './foodReport.ts';

test('les espaces de bord sont retirés', () => {
  assert.equal(cleanReport('  le poulet frit est trop bas \n'), 'le poulet frit est trop bas');
});

// La base refuse au-delà de 1000 caractères : couper ici vaut mieux qu'une erreur serveur
// découverte après coup, quand le texte est déjà perdu.
test('un message trop long est coupé à la limite de la base', () => {
  const long = 'a'.repeat(REPORT_MAX + 500);
  assert.equal(cleanReport(long).length, REPORT_MAX);
});

test('un message vide ou blanc ne peut pas être envoyé', () => {
  assert.equal(isSendableReport(''), false);
  assert.equal(isSendableReport('   \n  '), false);
});

test('un message d’un seul caractère utile peut partir', () => {
  assert.equal(isSendableReport(' ? '), true);
});
