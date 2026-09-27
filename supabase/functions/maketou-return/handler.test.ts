// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CartState } from '../_shared/maketou.ts';
import type { StoredIntent } from '../_shared/settle.ts';
import { createHandler, type Deps, PAGES } from './handler.ts';

const INTENT_ID = '11111111-1111-4111-8111-111111111111';
const CART_ID = '22222222-2222-4222-8222-222222222222';
const INTENT: StoredIntent = { id: INTENT_ID, cartId: CART_ID, userId: 'u1', offer: 'monthly', amount: 2000, currency: 'XOF', status: 'pending' };

function setup(cart: CartState | null, intent: StoredIntent | null = INTENT, overrides: Partial<Deps> = {}) {
  const grants: string[] = [];
  const handle = createHandler({
    loadIntent: async (id) => (id === INTENT_ID ? intent : null),
    getCart: async () => cart,
    grantPremium: async ({ saleId }) => {
      grants.push(saleId);
      return { granted: true, premiumUntil: null };
    },
    markPaid: async () => undefined,
    log: () => undefined,
    ...overrides,
  });
  const get = async (query: string) => (await handle(new Request(`http://localhost/maketou-return${query}`))).text();
  return { get, grants };
}

test('payé : Premium crédité et page de succès', async () => {
  const { get, grants } = setup({ id: CART_ID, status: 'completed', paymentId: 'p', meta: { intentId: INTENT_ID, userId: 'u1' } });
  assert.equal(await get(`?intent=${INTENT_ID}`), PAGES.paid);
  assert.deepEqual(grants, [`maketou:${CART_ID}`]);
});

test('déjà payé : pas de second crédit', async () => {
  const { get, grants } = setup({ id: CART_ID, status: 'completed', paymentId: 'p', meta: {} }, { ...INTENT, status: 'paid' });
  assert.equal(await get(`?intent=${INTENT_ID}`), PAGES.paid);
  assert.equal(grants.length, 0);
});

test('en attente, échec, inconnu', async () => {
  assert.equal(await setup({ id: CART_ID, status: 'waiting_payment', paymentId: null, meta: {} }).get(`?intent=${INTENT_ID}`), PAGES.waiting);
  assert.equal(await setup({ id: CART_ID, status: 'payment_failed', paymentId: null, meta: {} }).get(`?intent=${INTENT_ID}`), PAGES.failed);
  assert.equal(await setup(null).get(`?intent=${INTENT_ID}`), PAGES.waiting);
  assert.equal(await setup(null).get('?intent=pas-un-uuid'), PAGES.waiting);
  assert.equal(await setup(null).get(''), PAGES.waiting);
});

test('erreur Maketou : page d’attente, rien de crédité', async () => {
  const { get, grants } = setup(null, INTENT, {
    getCart: async () => {
      throw new Error('boom');
    },
  });
  assert.equal(await get(`?intent=${INTENT_ID}`), PAGES.waiting);
  assert.equal(grants.length, 0);
});

test('POST refusé', async () => {
  const { grants } = setup(null);
  const handle = createHandler({
    loadIntent: async () => null,
    getCart: async () => null,
    grantPremium: async () => ({ granted: false, premiumUntil: null }),
    markPaid: async () => undefined,
    log: () => undefined,
  });
  assert.equal((await handle(new Request('http://localhost/maketou-return', { method: 'POST' }))).status, 405);
  assert.equal(grants.length, 0);
});
