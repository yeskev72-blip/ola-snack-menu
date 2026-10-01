import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addPending, MAX_PENDING, parsePending, type PendingScan, pendingPhotoUri, removePending } from './pendingScans.ts';

const scan = (id: string): PendingScan => ({ id, base64: '/9j/4AAQ', hint: null, createdAt: '2026-10-01T08:00:00.000Z' });

test('addPending : garde les plus récentes', () => {
  const list = [scan('a'), scan('b')];
  assert.deepEqual(addPending(list, scan('c')).map((s) => s.id), ['a', 'b', 'c']);
  // Une photo de la semaine dernière n'intéresse plus personne, et la file ne doit pas grossir.
  const plein = Array.from({ length: MAX_PENDING }, (_, i) => scan(`p${i}`));
  assert.deepEqual(addPending(plein, scan('neuf')).map((s) => s.id), ['p1', 'p2', 'p3', 'p4', 'neuf']);
});

test('addPending : réenregistrer la même photo ne la duplique pas', () => {
  const list = addPending([scan('a'), scan('b')], { ...scan('a'), hint: 'riz' });
  assert.deepEqual(list.map((s) => s.id), ['b', 'a']);
  assert.equal(list[1]!.hint, 'riz', 'la version la plus récente gagne');
});

test('removePending : retire une photo analysée', () => {
  assert.deepEqual(removePending([scan('a'), scan('b')], 'a').map((s) => s.id), ['b']);
  assert.deepEqual(removePending([scan('a')], 'absent').map((s) => s.id), ['a']);
});

// Une entrée abîmée ne doit pas empêcher l'app de démarrer : une photo perdue est un
// désagrément, une app qui ne s'ouvre plus est une panne.
test('parsePending : tolère tout contenu douteux', () => {
  assert.deepEqual(parsePending(null), []);
  assert.deepEqual(parsePending(''), []);
  assert.deepEqual(parsePending('pas du json'), []);
  assert.deepEqual(parsePending('{"pas":"un tableau"}'), []);
  assert.deepEqual(parsePending(JSON.stringify([null, 42, 'x'])), []);
  assert.deepEqual(parsePending(JSON.stringify([{ id: 'a' }])), [], 'photo manquante');
  assert.deepEqual(parsePending(JSON.stringify([{ id: '', base64: 'x', createdAt: 'd' }])), [], 'identifiant vide');
  assert.deepEqual(parsePending(JSON.stringify([{ id: 'a', base64: 'x' }])), [], 'date manquante');
});

test('parsePending : relit ce qui a été écrit', () => {
  const list = [{ ...scan('a'), hint: 'attiéké' }, scan('b')];
  assert.deepEqual(parsePending(JSON.stringify(list)), list);
  assert.equal(parsePending(JSON.stringify([{ ...scan('a'), hint: '' }]))[0]!.hint, null, 'indice vide ramené à null');
  assert.equal(parsePending(JSON.stringify(Array.from({ length: 9 }, (_, i) => scan(`p${i}`)))).length, MAX_PENDING);
});

test('pendingPhotoUri : affichable sans écrire de fichier', () => {
  assert.equal(pendingPhotoUri(scan('a')), 'data:image/jpeg;base64,/9j/4AAQ');
});
