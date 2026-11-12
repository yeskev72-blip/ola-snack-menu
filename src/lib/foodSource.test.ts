import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sourceText, sourceTone } from './foodSource.ts';

const verified = { source: 'Estimation interne Calbasse, validée par l’éditeur.', verified: true };
const unverified = { source: 'Estimation interne Calbasse à vérifier.', verified: false };

test('un aliment vérifié de la table est annoncé comme tel', () => {
  assert.equal(sourceTone(verified, false), 'table');
});

test('un aliment de la table non vérifié reste distinct', () => {
  assert.equal(sourceTone(unverified, false), 'unverified');
});

test('un élément hors table vient du modèle, quel que soit le reste', () => {
  assert.equal(sourceTone(undefined, false), 'ai');
  assert.equal(sourceTone(null, true), 'ai');
});

// Le calcul marque « estimated » dès que la valeur ne sort pas de la table ; la pastille ne doit
// jamais prétendre le contraire, même si un aliment du même nom existe dans le cache.
test('un élément estimé n’emprunte pas la caution d’un aliment vérifié', () => {
  assert.equal(sourceTone(verified, true), 'ai');
});

test('la phrase de provenance est rendue telle quelle', () => {
  assert.equal(sourceText(verified), 'Estimation interne Calbasse, validée par l’éditeur.');
});

test('une provenance absente, vide ou blanche ne donne rien à afficher', () => {
  assert.equal(sourceText(undefined), null);
  assert.equal(sourceText({ verified: true }), null);
  assert.equal(sourceText({ source: null, verified: true }), null);
  assert.equal(sourceText({ source: '   ', verified: true }), null);
});
