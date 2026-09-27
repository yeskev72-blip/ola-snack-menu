// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CartInput, CartState } from '../_shared/maketou.ts';
import type { StoredIntent } from '../_shared/settle.ts';
import { MaketouError } from '../_shared/maketou.ts';
import { createHandler, type Deps, errorCode, type NewIntent } from './handler.ts';

const USERS: Record<string, { id: string; email: string | null; isAnonymous: boolean }> = {
  compte: { id: 'u1', email: 'awa@test.local', isAnonymous: false },
  invite: { id: 'g1', email: null, isAnonymous: true },
};
const FORM = { offer: 'monthly', first_name: ' Awa ', last_name: 'Dossou', phone: '+229 01 97 00 00 00' };
const INTENT_ID = '11111111-1111-4111-8111-111111111111';
const CART_ID = '22222222-2222-4222-8222-222222222222';

function setup(overrides: Partial<Deps> = {}, carts: Record<string, CartState | null> = {}, pending: StoredIntent[] = []) {
  const intents: NewIntent[] = [];
  const attached: [string, string][] = [];
  const created: CartInput[] = [];
  const grants: { saleId: string; days: number }[] = [];
  const paid: string[] = [];
  const handle = createHandler({
    getUser: async (token) => USERS[token] ?? null,
    offers: { monthly: { productId: 'prod-m', amount: 2000 }, yearly: { productId: 'prod-y', amount: 20000 } },
    currency: 'XOF',
    currencyLabel: 'FCFA',
    returnUrl: 'https://x.supabase.co/functions/v1/maketou-return',
    newId: () => INTENT_ID,
    saveIntent: async (intent) => {
      intents.push(intent);
    },
    attachCart: async (id, cartId) => {
      attached.push([id, cartId]);
    },
    pendingIntents: async () => pending,
    createCart: async (input) => {
      created.push(input);
      return { cartId: CART_ID, redirectUrl: 'https://checkout.moneroo.io/py_x' };
    },
    getCart: async (id) => carts[id] ?? null,
    grantPremium: async ({ saleId, days }) => {
      grants.push({ saleId, days });
      return { granted: true, premiumUntil: '2026-10-27T00:00:00Z' };
    },
    markPaid: async (id) => {
      paid.push(id);
    },
    log: () => undefined,
    ...overrides,
  });
  const post = (token: string | null, body: unknown) =>
    handle(new Request('http://localhost/create-checkout', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) }));
  return { post, intents, attached, created, grants, paid };
}

const pendingIntent = (over: Partial<StoredIntent> = {}): StoredIntent => ({
  id: INTENT_ID,
  cartId: CART_ID,
  userId: 'u1',
  offer: 'yearly',
  amount: 20000,
  currency: 'XOF',
  status: 'pending',
  ...over,
});

test('connexion requise', async () => {
  const { post } = setup();
  assert.equal((await post(null, FORM)).status, 401);
});

test('offres et prix', async () => {
  const { post } = setup();
  const { offers, currency } = await (await post('invite', { action: 'offers' })).json();
  assert.equal(currency, 'XOF');
  assert.deepEqual(offers.map((o: { offer: string }) => o.offer), ['monthly', 'yearly']);
  assert.equal(offers[0].label, '2 000 FCFA / mois');
});

test('offres : produit non configuré masqué', async () => {
  const { post } = setup({ offers: { yearly: { productId: 'prod-y', amount: 20000 } } });
  const { offers } = await (await post('compte', { action: 'offers' })).json();
  assert.deepEqual(offers.map((o: { offer: string }) => o.offer), ['yearly']);
  assert.equal((await post('compte', FORM)).status, 400, 'mensuel indisponible');
});

test('invité : compte e-mail exigé', async () => {
  const { post, created } = setup();
  assert.equal((await post('invite', FORM)).status, 403);
  assert.equal(created.length, 0);
});

test('validation : offre et nom', async () => {
  const { post } = setup();
  assert.equal((await post('compte', { ...FORM, offer: 'lifetime' })).status, 400);
  assert.equal((await post('compte', { ...FORM, last_name: 'D' })).status, 400);
});

test('paiement : intention enregistrée, panier créé avec le bon produit et retour', async () => {
  const { post, intents, created, attached } = setup();
  const res = await post('compte', FORM);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, 'https://checkout.moneroo.io/py_x');
  assert.deepEqual(intents, [{ id: INTENT_ID, userId: 'u1', offer: 'monthly', amount: 2000, currency: 'XOF' }]);
  assert.equal(created[0]!.productDocumentId, 'prod-m');
  assert.equal(created[0]!.email, 'awa@test.local');
  assert.equal(created[0]!.firstName, 'Awa');
  assert.equal(created[0]!.phone, '+2290197000000');
  assert.equal(created[0]!.redirectURL, `https://x.supabase.co/functions/v1/maketou-return?intent=${INTENT_ID}`);
  assert.deepEqual(created[0]!.meta, { intentId: INTENT_ID, userId: 'u1', offer: 'monthly' });
  assert.deepEqual(attached, [[INTENT_ID, CART_ID]]);
});

test('paiement : numéro sans indicatif ou invalide ignoré', async () => {
  for (const phone of ['12', '01 97 00 00 00', '', 'abc']) {
    const { post, created } = setup();
    await post('compte', { ...FORM, phone });
    assert.equal(created[0]!.phone, undefined, phone);
  }
  const { post, created } = setup();
  await post('compte', { ...FORM, phone: '00229 01 97 00 00 00' });
  assert.equal(created[0]!.phone, '+2290197000000', 'préfixe 00 accepté');
});

test('code de diagnostic', () => {
  assert.equal(errorCode(new MaketouError('x', 400, 'INVALID_PRODUCT')), '400/INVALID_PRODUCT');
  assert.equal(errorCode(new MaketouError('x', 401, null)), '401');
  assert.equal(errorCode({ code: '42P01', message: 'relation does not exist' }), 'db/42P01');
  assert.equal(errorCode(new Error('The signal has been aborted')), 'timeout');
  assert.equal(errorCode(new Error('boom')), 'inconnu');
  assert.equal(
    errorCode(new MaketouError('x', 422, 'VALIDATION_ERROR'), 'calbasse-premium-1-mois'),
    '422/produit-non-uuid',
    'nom court pris pour un identifiant',
  );
  assert.equal(errorCode(new MaketouError('x', 422, 'VALIDATION_ERROR'), CART_ID), '422/VALIDATION_ERROR');
  assert.equal(errorCode({ code: 'clé secrète ; texte libre' }), 'inconnu', 'aucun texte libre recopié');
});

test('paiement : erreur Maketou → 502 avec le code du refus', async () => {
  const { post } = setup({
    createCart: async () => {
      throw new MaketouError('Maketou HTTP 400 : produit indisponible', 400, 'INVALID_PRODUCT');
    },
  });
  const res = await post('compte', FORM);
  assert.equal(res.status, 502);
  const { message } = await res.json();
  assert.match(message, /n'a pas pu être préparé/);
  assert.match(message, /400\/INVALID_PRODUCT/);
});

test('paiement : migration oubliée → code de la base', async () => {
  const { post } = setup({
    saveIntent: async () => {
      throw { code: '42P01', message: 'relation "payment_intents" does not exist' };
    },
  });
  assert.match((await (await post('compte', FORM)).json()).message, /db\/42P01/);
});

test('confirm : panier payé → Premium crédité une fois', async () => {
  const cart: CartState = { id: CART_ID, status: 'completed', paymentId: 'p', meta: { intentId: INTENT_ID, userId: 'u1' } };
  const { post, grants, paid } = setup({}, { [CART_ID]: cart }, [pendingIntent()]);
  const res = await post('compte', { action: 'confirm' });
  assert.deepEqual(await res.json(), { paid: 1 });
  assert.deepEqual(grants, [{ saleId: `maketou:${CART_ID}`, days: 365 }]);
  assert.deepEqual(paid, [INTENT_ID]);
});

test('confirm : panier en attente ou échoué → rien', async () => {
  for (const status of ['waiting_payment', 'payment_failed', 'abandoned']) {
    const cart: CartState = { id: CART_ID, status, paymentId: null, meta: {} };
    const { post, grants } = setup({}, { [CART_ID]: cart }, [pendingIntent()]);
    assert.deepEqual(await (await post('compte', { action: 'confirm' })).json(), { paid: 0 });
    assert.equal(grants.length, 0, status);
  }
});

test('confirm : panier d’un autre utilisateur refusé', async () => {
  const cart: CartState = { id: CART_ID, status: 'completed', paymentId: 'p', meta: { intentId: INTENT_ID, userId: 'autre' } };
  const { post, grants } = setup({}, { [CART_ID]: cart }, [pendingIntent()]);
  assert.deepEqual(await (await post('compte', { action: 'confirm' })).json(), { paid: 0 });
  assert.equal(grants.length, 0);
});

test('confirm : Maketou injoignable → pas d’erreur, rien de crédité', async () => {
  const { post, grants } = setup(
    {
      getCart: async () => {
        throw new Error('timeout');
      },
    },
    {},
    [pendingIntent()],
  );
  assert.deepEqual(await (await post('compte', { action: 'confirm' })).json(), { paid: 0 });
  assert.equal(grants.length, 0);
});
