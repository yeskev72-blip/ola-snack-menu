// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { PaymentInput } from '../_shared/cinetpay.ts';
import { availableCountries, createHandler, type Deps, type Intent } from './handler.ts';

const USERS: Record<string, { id: string; email: string | null; isAnonymous: boolean }> = {
  compte: { id: 'u1', email: 'awa@test.local', isAnonymous: false },
  invite: { id: 'g1', email: null, isAnonymous: true },
};
const FORM = { offer: 'monthly', country_code: 'bj', first_name: ' Awa ', last_name: 'Dossou', phone: '01 97 00 00 00' };

function setup(overrides: Partial<Deps> = {}) {
  const intents: Intent[] = [];
  const attached: string[] = [];
  const payments: { country: string; input: PaymentInput }[] = [];
  const handle = createHandler({
    getUser: async (token) => USERS[token] ?? null,
    enabledCountries: ['BJ', 'CM', 'GN'],
    prices: { XOF: { monthly: 2000, yearly: 20000 }, XAF: { monthly: 2000, yearly: 20000 } },
    webhookUrl: 'https://x.supabase.co/functions/v1/cinetpay-webhook',
    saveIntent: async (intent) => {
      intents.push(intent);
    },
    attachIntent: async (id) => {
      attached.push(id);
    },
    createPayment: async (country, input) => {
      payments.push({ country, input });
      return { paymentUrl: 'https://pay.cinetpay.net/x', notifyToken: 'nt', transactionId: 'T1' };
    },
    log: () => undefined,
    ...overrides,
  });
  const post = (token: string | null, body: unknown) =>
    handle(new Request('http://localhost/create-checkout', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) }));
  return { post, intents, attached, payments };
}

test('connexion requise', async () => {
  const { post } = setup();
  assert.equal((await post(null, FORM)).status, 401);
});

test('offres : seulement les pays configurés dont la devise a un prix', async () => {
  const { post } = setup();
  const res = await post('invite', { action: 'offers' });
  const { countries } = await res.json();
  assert.deepEqual(countries.map((c: { code: string }) => c.code), ['BJ', 'CM'], 'GN (GNF) sans prix : masqué');
  assert.equal(countries[0].offers[0].label, '2 000 FCFA / mois');
  assert.equal(countries[1].currency, 'XAF');
});

test('invité : compte e-mail exigé', async () => {
  const { post, payments } = setup();
  assert.equal((await post('invite', FORM)).status, 403);
  assert.equal(payments.length, 0);
});

test('paiement : intention enregistrée avant l’appel, montant fixé par le serveur, numéro E.164', async () => {
  const { post, intents, attached, payments } = setup();
  const res = await post('compte', { ...FORM, amount: 1 });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { url: 'https://pay.cinetpay.net/x' });
  assert.equal(intents[0]!.amount, 2000, 'le montant envoyé par l’app est ignoré');
  assert.equal(intents[0]!.userId, 'u1');
  assert.equal(intents[0]!.currency, 'XOF');
  assert.equal(payments[0]!.country, 'BJ');
  assert.equal(payments[0]!.input.phoneE164, '+2290197000000');
  assert.equal(payments[0]!.input.firstName, 'Awa');
  assert.equal(payments[0]!.input.merchantTransactionId, intents[0]!.merchantTransactionId);
  assert.equal(payments[0]!.input.notifyUrl, 'https://x.supabase.co/functions/v1/cinetpay-webhook');
  assert.deepEqual(attached, [intents[0]!.merchantTransactionId]);
});

test('annuel au Cameroun : 20000 XAF', async () => {
  const { post, payments } = setup();
  await post('compte', { ...FORM, offer: 'yearly', country_code: 'CM', phone: '6 70 00 00 00' });
  assert.equal(payments[0]!.input.amount, 20000);
  assert.equal(payments[0]!.input.currency, 'XAF');
  assert.equal(payments[0]!.input.phoneE164, '+237670000000');
});

test('validation : offre, pays indisponible, nom trop court, numéro d’un autre pays', async () => {
  const { post, payments } = setup();
  assert.equal((await post('compte', { ...FORM, offer: 'a_vie' })).status, 400);
  assert.equal((await post('compte', { ...FORM, country_code: 'SN' })).status, 400, 'SN non configuré');
  assert.equal((await post('compte', { ...FORM, country_code: 'GN' })).status, 400, 'GN sans prix');
  assert.equal((await post('compte', { ...FORM, last_name: 'D' })).status, 400);
  assert.equal((await post('compte', { ...FORM, phone: '+237 670000000' })).status, 400);
  assert.equal(payments.length, 0);
});

test('échec chez CinetPay : 502 avec un message clair', async () => {
  const { post } = setup({
    createPayment: async () => {
      throw new Error('CinetPay HTTP 401');
    },
  });
  const res = await post('compte', FORM);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'checkout_failed');
});

test('availableCountries : ordre stable, prix par offre', () => {
  const list = availableCountries({ enabledCountries: ['CM', 'BJ'], prices: { XOF: { monthly: 1500, yearly: 15000 }, XAF: { monthly: 2000, yearly: 20000 } } });
  assert.deepEqual(list.map((c) => [c.code, c.offers[0]!.amount]), [['BJ', 1500], ['CM', 2000]]);
});
