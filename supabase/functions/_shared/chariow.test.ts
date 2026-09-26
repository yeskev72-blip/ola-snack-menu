// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AlreadyPurchasedError, createCheckout, fetchSale, findCheckoutUrl, findSaleId, readSale, safeEqual, verifySignature } from './chariow.ts';

test('lien de paiement : clés connues, lien de retour ignoré', () => {
  assert.equal(findCheckoutUrl({ data: { checkout_url: 'https://pay.chariow.com/c/1', redirect_url: 'https://calbasse.app' } }), 'https://pay.chariow.com/c/1');
  assert.equal(findCheckoutUrl({ data: { payment: { url: 'https://pay.chariow.com/c/2' } } }), 'https://pay.chariow.com/c/2');
  assert.equal(findCheckoutUrl({ data: { redirect_url: 'https://calbasse.app' } }), null);
  assert.equal(findCheckoutUrl({ data: { url: 'http://non-securise' } }), null);
});

test('identifiant de vente dans une notification', () => {
  assert.equal(findSaleId({ event: 'successful_sale', data: { sale: { id: 'sal_1' } } }), 'sal_1');
  assert.equal(findSaleId({ sale_id: 'sal_2' }), 'sal_2');
  assert.equal(findSaleId({ data: { id: 'sal_3', status: 'completed' } }), 'sal_3');
  assert.equal(findSaleId({ event: 'test' }), null);
});

test('lecture d’une vente, enveloppe { data } et variantes', () => {
  const sale = readSale(
    { message: 'ok', data: { id: 'sal_1', status: 'Completed', product: { id: 'prd_m' }, custom_metadata: { user_id: 'u1', offer: 'monthly' }, amount: { value: 1000, currency: 'XOF' } } },
    'sal_1',
  );
  assert.deepEqual(sale, { id: 'sal_1', status: 'completed', productId: 'prd_m', productSlug: null, metadata: { user_id: 'u1', offer: 'monthly' }, amount: 1000, currency: 'XOF' });
  const flat = readSale({ id: 'sal_2', status: 'settled', product_id: 'prd_y', metadata: { user_id: 'u2' }, amount: '10000', currency: 'XOF' }, 'sal_2');
  assert.equal(flat.productId, 'prd_y');
  assert.equal(readSale({ data: { id: 's', product: { id: 'prd_z', slug: 'calbasse-1-mois' } } }, 's').productSlug, 'calbasse-1-mois');
  assert.equal(flat.amount, 10000);
  assert.equal(readSale(null, 'sal_x').status, null);
});

test('création du paiement : corps envoyé, clé en en-tête, erreur lisible', async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const ok = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ data: { checkout_url: 'https://pay.chariow.com/c/1' } }), { status: 200 });
  }) as unknown as typeof fetch;
  const input = { productId: 'prd_m', email: 'a@b.c', firstName: 'Awa', lastName: 'Dossou', phone: '97000000', countryCode: 'BJ', metadata: { user_id: 'u1', offer: 'monthly' } };
  assert.equal(await createCheckout({ apiKey: 'sk_test' }, input, ok), 'https://pay.chariow.com/c/1');
  assert.equal(seen!.url, 'https://api.chariow.com/v1/checkout');
  assert.equal(new Headers(seen!.init.headers).get('Authorization'), 'Bearer sk_test');
  const body = JSON.parse(String(seen!.init.body));
  assert.deepEqual(body.phone, { number: '97000000', country_code: 'BJ' });
  assert.deepEqual(body.custom_metadata, { user_id: 'u1', offer: 'monthly' });
  assert.equal('redirect_url' in body, false);
  assert.equal('discount_code' in body, false);
  await createCheckout({ apiKey: 'k' }, { ...input, discountCode: 'TEST100' }, ok);
  assert.equal(JSON.parse(String(seen!.init.body)).discount_code, 'TEST100');

  const ko = (async () => new Response(JSON.stringify({ message: 'Produit introuvable', errors: [] }), { status: 422 })) as unknown as typeof fetch;
  await assert.rejects(createCheckout({ apiKey: 'k' }, input, ko), /Chariow HTTP 422 : Produit introuvable/);
});

test('produit déjà acheté par ce client : erreur dédiée', async () => {
  const owned = (async () =>
    new Response(
      JSON.stringify({ data: { step: 'already_purchased', message: 'You already own this product.', payment: { checkout_url: null } } }),
      { status: 200 },
    )) as unknown as typeof fetch;
  const input = { productId: 'p', email: 'a@b.c', firstName: 'A', lastName: 'B', phone: '97000000', countryCode: 'BJ', metadata: {} };
  await assert.rejects(createCheckout({ apiKey: 'k' }, input, owned), AlreadyPurchasedError);
});

test('relecture d’une vente : 404 → null', async () => {
  const missing = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
  assert.equal(await fetchSale({ apiKey: 'k' }, 'sal_x', missing), null);
});

test('signature HMAC-SHA256 « sha256=… » avec le secret complet', async () => {
  const secret = 'whsec_test';
  const body = '{"event":"successful_sale"}';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hex = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))), (b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(await verifySignature(body, `sha256=${hex}`, secret), true);
  assert.equal(await verifySignature(body, hex, secret), true);
  assert.equal(await verifySignature(body + ' ', `sha256=${hex}`, secret), false);
  assert.equal(await verifySignature(body, null, secret), false);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});
