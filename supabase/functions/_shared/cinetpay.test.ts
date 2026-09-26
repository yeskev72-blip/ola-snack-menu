// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type CinetPayConfig,
  CinetPayError,
  createPayment,
  findPayment,
  newMerchantTransactionId,
  parseNotification,
  priceLabel,
  safeEqual,
  toE164,
} from './cinetpay.ts';

const config: CinetPayConfig = { apiKey: 'cle', apiPassword: 'secret', baseUrl: 'https://api.cinetpay.net' };

/** Doublure : répond selon le chemin appelé et garde les requêtes. */
function fakeApi(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const route = routes[`${init.method} ${path}`] ?? { status: 404, body: { status: 'NOT_FOUND' } };
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const INPUT = {
  currency: 'XOF' as const,
  merchantTransactionId: 'CB123',
  amount: 2000,
  successUrl: 'https://x.supabase.co/functions/v1/cinetpay-webhook?page=success',
  failedUrl: 'https://x.supabase.co/functions/v1/cinetpay-webhook?page=failed',
  notifyUrl: 'https://x.supabase.co/functions/v1/cinetpay-webhook',
  designation: 'Calbasse Premium 1 mois',
  firstName: 'Awa',
  lastName: 'Dossou',
  email: 'awa@test.local',
  phoneE164: '+2290197000000',
};

test('numéro → E.164 avec l’indicatif du pays, 0 initial conservé', () => {
  assert.equal(toE164('01 97 00 00 00', '229'), '+2290197000000');
  assert.equal(toE164('+229 01 97 00 00 00', '229'), '+2290197000000');
  assert.equal(toE164('00229 0197000000', '229'), '+2290197000000');
  assert.equal(toE164('07 07 00 00 01', '225'), '+2250707000001');
  assert.equal(toE164('+225 0707000001', '229'), null, 'indicatif d’un autre pays');
  assert.equal(toE164('12', '229'), null);
});

test('prix affiché et identifiant marchand', () => {
  assert.equal(priceLabel(2000, 'XOF', 'monthly'), '2 000 FCFA / mois');
  assert.equal(priceLabel(20000, 'XAF', 'yearly'), '20 000 FCFA / an');
  const id = newMerchantTransactionId();
  assert.ok(id.length <= 30 && /^CB[0-9A-Z]+$/.test(id));
  assert.notEqual(newMerchantTransactionId(), id);
});

test('création : connexion puis paiement avec le jeton, corps attendu par CinetPay', async () => {
  const { calls, fetchImpl } = fakeApi({
    'POST /v1/oauth/login': { body: { code: 200, status: 'OK', access_token: 'jeton' } },
    'POST /v1/payment': {
      body: { code: 200, status: 'OK', payment_url: 'https://pay.cinetpay.net/x', notify_token: 'nt', transaction_id: 'T1', merchant_transaction_id: 'CB123' },
    },
  });
  const init = await createPayment(config, INPUT, fetchImpl);
  assert.deepEqual(init, { paymentUrl: 'https://pay.cinetpay.net/x', notifyToken: 'nt', transactionId: 'T1' });
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { api_key: 'cle', api_password: 'secret' });
  assert.equal(new Headers(calls[1]!.init.headers).get('Authorization'), 'Bearer jeton');
  const body = JSON.parse(String(calls[1]!.init.body));
  assert.equal(body.merchant_transaction_id, 'CB123');
  assert.equal(body.currency, 'XOF');
  assert.equal(body.amount, 2000);
  assert.equal(body.client_phone_number, '+2290197000000');
  assert.equal(body.lang, 'fr');
});

test('création : identifiants refusés ou lien absent → erreur lisible', async () => {
  const refused = fakeApi({ 'POST /v1/oauth/login': { status: 401, body: { status: 'INVALID_CREDENTIALS', description: 'Bad credentials' } } });
  await assert.rejects(createPayment(config, INPUT, refused.fetchImpl), (e) => e instanceof CinetPayError && /401 : Bad credentials/.test(e.message));
  const noUrl = fakeApi({
    'POST /v1/oauth/login': { body: { access_token: 'j' } },
    'POST /v1/payment': { body: { status: 'OPERATION_ERROR', details: { message: 'Devise refusée' } } },
  });
  await assert.rejects(createPayment(config, INPUT, noUrl.fetchImpl), /OPERATION_ERROR : Devise refusée/);
});

test('statut : SUCCESS lu depuis l’API, transaction inconnue → null', async () => {
  const { fetchImpl } = fakeApi({
    'POST /v1/oauth/login': { body: { data: { token: 'j' } } },
    'GET /v1/payment/CB123': { body: { code: 200, status: 'SUCCESS', merchant_transaction_id: 'CB123', transaction_id: 'T1' } },
  });
  assert.deepEqual(await findPayment(config, 'CB123', fetchImpl), { status: 'SUCCESS', merchantTransactionId: 'CB123', transactionId: 'T1' });
  assert.equal(await findPayment(config, 'CB999', fetchImpl), null);
});

test('notification : JSON ou formulaire ; champs manquants → null', () => {
  const expected = { notifyToken: 'nt', merchantTransactionId: 'CB123', transactionId: 'T1' };
  assert.deepEqual(parseNotification('{"notify_token":"nt","merchant_transaction_id":"CB123","transaction_id":"T1","status":"SUCCESS"}', 'application/json'), expected);
  assert.deepEqual(parseNotification('notify_token=nt&merchant_transaction_id=CB123&transaction_id=T1', 'application/x-www-form-urlencoded'), expected);
  assert.equal(parseNotification('{"merchant_transaction_id":"CB123"}', 'application/json'), null);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
});
