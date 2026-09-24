// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHandler, type Deps } from './handler.ts';

function setup(overrides: Partial<Deps> = {}) {
  const calls: string[] = [];
  const handle = createHandler({
    getUser: async (token) => (token === 'jeton-valide' ? { id: 'u1' } : null),
    deletePhotos: async (userId) => {
      calls.push(`photos:${userId}`);
      return 2;
    },
    deleteUser: async (userId) => {
      calls.push(`user:${userId}`);
    },
    log: () => undefined,
    ...overrides,
  });
  const post = (token?: string) =>
    handle(new Request('http://localhost/delete-account', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} }));
  return { post, handle, calls };
}

test('refuse sans jeton valide, sans rien supprimer', async () => {
  const { post, calls } = setup();
  assert.equal((await post()).status, 401);
  assert.equal((await post('faux')).status, 401);
  assert.deepEqual(calls, []);
});

test('supprime les photos puis le compte de l’utilisateur du jeton', async () => {
  const { post, calls } = setup();
  const res = await post('jeton-valide');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.deepEqual(calls, ['photos:u1', 'user:u1']);
});

test('échec : erreur propre, compte conservé si les photos n’ont pas pu être supprimées', async () => {
  const { post, calls } = setup({
    deletePhotos: async () => {
      throw new Error('stockage indisponible');
    },
  });
  const res = await post('jeton-valide');
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'internal_error');
  assert.deepEqual(calls, []);
});

test('méthodes : OPTIONS et GET', async () => {
  const { handle } = setup();
  assert.equal((await handle(new Request('http://localhost', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handle(new Request('http://localhost', { method: 'GET' }))).status, 405);
});
