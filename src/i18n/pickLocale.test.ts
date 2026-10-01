import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_LOCALE, deviceLanguages, pickLocale } from './pickLocale.ts';

const dispo = ['fr', 'en'] as const;

test('pickLocale : la région ne change pas la langue', () => {
  for (const tag of ['fr', 'fr-FR', 'fr-CI', 'fr-BE', 'FR-ci', 'fr_SN']) {
    assert.equal(pickLocale([tag], dispo, 'fr'), 'fr', tag);
  }
  assert.equal(pickLocale(['en-GH'], dispo, 'fr'), 'en', 'anglais du Ghana');
  assert.equal(pickLocale(['en-NG'], dispo, 'fr'), 'en', 'anglais du Nigeria');
});

test('pickLocale : première langue connue de la liste', () => {
  assert.equal(pickLocale(['wo', 'en-GH', 'fr-CI'], dispo, 'fr'), 'en', 'le wolof est ignoré, l’anglais vient avant');
  assert.equal(pickLocale(['ar', 'fr'], dispo, 'fr'), 'fr');
});

test('pickLocale : repli quand rien ne correspond', () => {
  assert.equal(pickLocale([], dispo, 'fr'), 'fr');
  assert.equal(pickLocale(['yo', 'ha'], dispo, 'fr'), 'fr', 'yoruba et haoussa non traduits');
  assert.equal(pickLocale(['', '-', '_x'], dispo, 'fr'), 'fr', 'étiquettes vides ou mal formées');
  assert.equal(pickLocale([null as unknown as string, 'en'], dispo, 'fr'), 'en', 'entrée non textuelle ignorée');
});

test('deviceLanguages : renvoie une étiquette exploitable', () => {
  const langues = deviceLanguages();
  assert.ok(Array.isArray(langues));
  for (const l of langues) assert.match(l, /^[a-zA-Z]{2}/);
  // Le marché visé est francophone : c'est le repli quand la langue du téléphone est inconnue.
  assert.equal(DEFAULT_LOCALE, 'fr');
});
