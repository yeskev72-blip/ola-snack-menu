// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { PaymentState } from '../_shared/cinetpay.ts';
import { createHandler, type Deps, type StoredIntent } from './handler.ts';

const INTENT: StoredIntent = {
  merchantTransactionId: 'CB123',
  userId: '6f1c2f4e-8b1a-4c43-9a51-3d2f0e6b7a10',
  offer: 'monthly',
  amount: 2000,
  currency: 'XOF',
  country: 'BJ',
  notifyToken: 'nt',
  status: 'pending',
};
const PAID: PaymentState = { status: 'SUCCESS', merchantTransactionId: 'CB123', transactionId: 'T1' };
const NOTIF = { notify_token: 'nt', merchant_transaction_id: 'CB123', transaction_id: 'T1', status: 'SUCCESS' };

function setup(intent: StoredIntent | null = INTENT, payment: PaymentState | null = PAID, overrides: Partial<Deps> = {}) {
  const grants: Parameters<Deps['grantPremium']>[0][] = [];
  const marks: string[] = [];
  let current = intent;
  const handle = createHandler({
    loadIntent: async (id) => (current && id === current.merchantTransactionId ? current : null),
    findPayment: async () => payment,
    grantPremium: async (input) => {
      grants.push(input);
      return { granted: true, premiumUntil: '2026-10-26T00:00:00Z' };
    },
    markIntent: async (id, status) => {
      marks.push(`${id}:${status}`);
      if (current) current = { ...current, status };
    },
    log: () => undefined,
    ...overrides,
  });
  const notify = (body: unknown, query = '', contentType = 'application/json') =>
    handle(new Request(`http://localhost/cinetpay-webhook${query}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }));
  return { handle, notify, grants, marks };
}

test('paiement confirmé par l’API : Premium crédité une seule fois', async () => {
  const { notify, grants, marks } = setup();
  const res = await notify(NOTIF);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).granted, true);
  assert.deepEqual(grants[0], { userId: INTENT.userId, saleId: 'CB123', offer: 'monthly', days: 30, amount: 2000, currency: 'XOF' });
  assert.deepEqual(marks, ['CB123:paid']);
  assert.equal((await (await notify(NOTIF)).json()).already, true, 'notification rejouée');
  assert.equal(grants.length, 1);
});

test('formulaire accepté, annuel = 365 jours', async () => {
  const { notify, grants } = setup({ ...INTENT, offer: 'yearly', amount: 20000 });
  await notify('notify_token=nt&merchant_transaction_id=CB123&transaction_id=T1', '', 'application/x-www-form-urlencoded');
  assert.equal(grants[0]!.days, 365);
});

test('le statut de la notification est ignoré : seul celui de l’API compte', async () => {
  const { notify, grants, marks } = setup(INTENT, { ...PAID, status: 'PENDING' });
  const res = await notify({ ...NOTIF, status: 'SUCCESS' });
  assert.equal((await res.json()).ignored, 'not_paid');
  assert.equal(grants.length, 0);
  assert.deepEqual(marks, []);
});

test('échec définitif : intention marquée « failed », rien de crédité', async () => {
  const { notify, grants, marks } = setup(INTENT, { ...PAID, status: 'FAILED' });
  await notify(NOTIF);
  assert.equal(grants.length, 0);
  assert.deepEqual(marks, ['CB123:failed']);
});

test('refus : mauvais jeton, identifiants incohérents, transaction inconnue', async () => {
  assert.equal((await setup().notify({ ...NOTIF, notify_token: 'faux' })).status, 401);
  assert.equal((await setup(INTENT, { ...PAID, transactionId: 'AUTRE' }).notify(NOTIF)).status, 400);
  const unknown = setup(null);
  const res = await unknown.notify(NOTIF);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ignored, 'unknown_transaction');
  assert.equal(unknown.grants.length, 0);
  assert.equal((await setup().notify({ merchant_transaction_id: 'CB123' })).status, 400, 'sans notify_token');
});

test('intention pas encore prête ou CinetPay injoignable : erreur pour une nouvelle tentative', async () => {
  assert.equal((await setup({ ...INTENT, notifyToken: null }).notify(NOTIF)).status, 503);
  const down = setup(INTENT, PAID, {
    findPayment: async () => {
      throw new Error('réseau');
    },
  });
  assert.equal((await down.notify(NOTIF)).status, 502);
});

test('pages de retour : texte pour le client, notification jointe traitée', async () => {
  const { handle, notify, grants } = setup();
  const success = await handle(new Request('http://localhost/cinetpay-webhook?page=success'));
  assert.match(await success.text(), /Paiement reçu/);
  assert.match(await (await handle(new Request('http://localhost/cinetpay-webhook?page=failed'))).text(), /n’a pas abouti/);
  assert.equal(await (await handle(new Request('http://localhost/cinetpay-webhook'))).text(), 'ok');
  const back = await notify(NOTIF, '?page=success');
  assert.match(await back.text(), /Paiement reçu/);
  assert.equal(grants.length, 1);
});
