// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AlreadyPurchasedError, type CheckoutInput } from '../_shared/chariow.ts';
import { createHandler, type Deps } from './handler.ts';

const USERS: Record<string, { id: string; email: string | null; isAnonymous: boolean }> = {
  compte: { id: 'u1', email: 'awa@test.local', isAnonymous: false },
  invite: { id: 'g1', email: null, isAnonymous: true },
};
const FORM = { offer: 'monthly', first_name: ' Awa ', last_name: 'Dossou', phone: '+229 97 00 00 00', country_code: 'bj' };

function setup(overrides: Partial<Deps> = {}) {
  const checkouts: CheckoutInput[] = [];
  const handle = createHandler({
    getUser: async (token) => USERS[token] ?? null,
    offers: { monthly: { productId: 'prd_m', label: '1 000 FCFA / mois' }, yearly: { productId: null, label: null } },
    redirectUrl: null,
    createCheckout: async (input) => {
      checkouts.push(input);
      return 'https://pay.chariow.com/c/1';
    },
    log: () => undefined,
    ...overrides,
  });
  const post = (token: string | null, body: unknown) =>
    handle(
      new Request('http://localhost/create-checkout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(body),
      }),
    );
  return { post, handle, checkouts };
}

test('connexion requise', async () => {
  const { post } = setup();
  assert.equal((await post(null, FORM)).status, 401);
  assert.equal((await post('faux', FORM)).status, 401);
});

test('offres : prix affichés, offre sans produit indisponible', async () => {
  const { post } = setup();
  const res = await post('invite', { action: 'offers' });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).offers, [
    { offer: 'monthly', label: '1 000 FCFA / mois', available: true },
    { offer: 'yearly', label: null, available: false },
  ]);
});

test('invité : compte e-mail exigé', async () => {
  const { post, checkouts } = setup();
  const res = await post('invite', FORM);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'account_required');
  assert.equal(checkouts.length, 0);
});

test('paiement créé : e-mail du compte, identifiant en métadonnées, champs nettoyés', async () => {
  const { post, checkouts } = setup();
  const res = await post('compte', FORM);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { url: 'https://pay.chariow.com/c/1' });
  assert.deepEqual(checkouts[0], {
    productId: 'prd_m',
    email: 'awa@test.local',
    firstName: 'Awa',
    lastName: 'Dossou',
    phone: '22997000000',
    countryCode: 'BJ',
    metadata: { user_id: 'u1', offer: 'monthly' },
    redirectUrl: null,
    discountCode: null,
  });
});

test('code promo transmis à Chariow ; code refusé → message dédié', async () => {
  const { post, checkouts } = setup();
  await post('compte', { ...FORM, discount_code: ' TEST100 ' });
  assert.equal(checkouts[0]!.discountCode, 'TEST100');

  const { post: refused } = setup({
    createCheckout: async () => {
      throw new Error('Chariow HTTP 422 : Invalid discount code');
    },
  });
  const res = await refused('compte', { ...FORM, discount_code: 'FAUX' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_discount');
});

test('validation : offre, nom, téléphone, pays', async () => {
  const { post, checkouts } = setup();
  assert.equal((await post('compte', { ...FORM, offer: 'a_vie' })).status, 400);
  assert.equal((await post('compte', { ...FORM, last_name: '  ' })).status, 400);
  assert.equal((await post('compte', { ...FORM, phone: '12' })).status, 400);
  assert.equal((await post('compte', { ...FORM, country_code: 'BEN' })).status, 400);
  assert.equal((await post('compte', { ...FORM, offer: 'yearly' })).status, 503, 'offre non configurée');
  assert.equal(checkouts.length, 0);
});

test('échec chez Chariow : 502 avec un message clair', async () => {
  const { post } = setup({
    createCheckout: async () => {
      throw new Error('Chariow HTTP 500');
    },
  });
  const res = await post('compte', FORM);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'checkout_failed');
});

test('produit déjà possédé chez Chariow : 409 avec un message clair', async () => {
  const { post } = setup({
    createCheckout: async () => {
      throw new AlreadyPurchasedError();
    },
  });
  const res = await post('compte', FORM);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'already_purchased');
});
