// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createCart, getCart, isUuid, MaketouError, priceLabel } from './maketou.ts';

const CART = 'fd2d91d7-20d2-4b86-b067-d474fb0d1e60';

function fakeFetch(status: number, body: unknown, calls: { url: string; init: RequestInit }[] = []): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
}

test('libellé de prix', () => {
  assert.equal(priceLabel(2000, 'FCFA', 'monthly'), '2 000 FCFA / mois');
  assert.equal(priceLabel(20000, 'FCFA', 'yearly'), '20 000 FCFA / an');
});

test('isUuid', () => {
  assert.ok(isUuid(CART));
  assert.ok(!isUuid('CB123'));
  assert.ok(!isUuid(null));
});

test('createCart : requête et réponse', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = fakeFetch(201, { cart: { id: CART, status: 'waiting_payment' }, redirectUrl: 'https://checkout.moneroo.io/py_x' }, calls);
  const result = await createCart(
    { apiKey: 'k' },
    { productDocumentId: 'p1', email: 'a@b.c', firstName: 'Awa', lastName: 'Dossou', redirectURL: 'https://r', meta: { intentId: 'i' } },
    fetchImpl,
  );
  assert.deepEqual(result, { cartId: CART, redirectUrl: 'https://checkout.moneroo.io/py_x' });
  assert.equal(calls[0]!.url, 'https://api.maketou.net/api/v1/stores/cart/checkout');
  assert.equal(calls[0]!.init.method, 'POST');
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, 'Bearer k');
  const sent = JSON.parse(String(calls[0]!.init.body));
  assert.equal(sent.productDocumentId, 'p1');
  assert.deepEqual(sent.meta, { intentId: 'i' });
});

test('createCart : erreur Maketou explicite', async () => {
  await assert.rejects(
    createCart(
      { apiKey: 'k' },
      { productDocumentId: 'p1', email: 'a@b.c', firstName: 'A', lastName: 'B', redirectURL: 'https://r', meta: {} },
      fakeFetch(400, { code: 'INVALID_PRODUCT', message: 'The product is not available' }),
    ),
    (e: unknown) => e instanceof MaketouError && e.code === 'INVALID_PRODUCT' && e.httpStatus === 400,
  );
});

test('createCart : réponse incomplète refusée', async () => {
  await assert.rejects(
    createCart(
      { apiKey: 'k' },
      { productDocumentId: 'p1', email: 'a@b.c', firstName: 'A', lastName: 'B', redirectURL: 'https://r', meta: {} },
      fakeFetch(201, { cart: {} }),
    ),
    MaketouError,
  );
});

test('getCart : statut et métadonnées ; 404 → null', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const cart = await getCart({ apiKey: 'k' }, CART, fakeFetch(200, { id: CART, status: 'completed', paymentId: 'p', meta: { intentId: 'i', n: 1 } }, calls));
  assert.deepEqual(cart, { id: CART, status: 'completed', paymentId: 'p', meta: { intentId: 'i' } });
  assert.equal(calls[0]!.url, `https://api.maketou.net/api/v1/stores/cart/${CART}`);
  assert.equal(await getCart({ apiKey: 'k' }, CART, fakeFetch(404, { code: 'NOT_FOUND' })), null);
  await assert.rejects(getCart({ apiKey: 'k' }, CART, fakeFetch(500, {})), MaketouError);
});
