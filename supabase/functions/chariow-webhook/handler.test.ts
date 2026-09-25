// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SaleInfo } from '../_shared/chariow.ts';
import { createHandler, type Deps } from './handler.ts';

const USER = '6f1c2f4e-8b1a-4c43-9a51-3d2f0e6b7a10';
const PAID: SaleInfo = { id: 'sal_1', status: 'completed', productId: 'prd_m', metadata: { user_id: USER, offer: 'monthly' }, amount: 1000, currency: 'XOF' };

function setup(sale: SaleInfo | null = PAID, overrides: Partial<Deps> = {}) {
  const grants: Parameters<Deps['grantPremium']>[0][] = [];
  const credited = new Set<string>();
  const handle = createHandler({
    webhookToken: 'jeton-secret',
    signingSecret: null,
    productOffers: { prd_m: 'monthly', prd_y: 'yearly' },
    fetchSale: async (id) => (sale && id === sale.id ? sale : null),
    grantPremium: async (input) => {
      grants.push(input);
      const granted = !credited.has(input.saleId);
      credited.add(input.saleId);
      return { granted, premiumUntil: '2026-10-25T00:00:00Z' };
    },
    log: () => undefined,
    ...overrides,
  });
  const notify = (body: unknown, query = '?token=jeton-secret', headers: Record<string, string> = {}) =>
    handle(new Request(`http://localhost/chariow-webhook${query}`, { method: 'POST', headers, body: JSON.stringify(body) }));
  return { notify, grants };
}

const EVENT = { event: 'successful_sale', data: { sale: { id: 'sal_1' } } };

test('jeton absent ou faux : refusé, rien de crédité', async () => {
  const { notify, grants } = setup();
  assert.equal((await notify(EVENT, '')).status, 401);
  assert.equal((await notify(EVENT, '?token=faux')).status, 401);
  assert.equal(grants.length, 0);
});

test('vente payée : Premium crédité une seule fois (notification rejouée)', async () => {
  const { notify, grants } = setup();
  const first = await notify(EVENT);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { granted: true, premium_until: '2026-10-25T00:00:00Z' });
  assert.deepEqual(grants[0], { userId: USER, saleId: 'sal_1', offer: 'monthly', days: 30, amount: 1000, currency: 'XOF' });
  assert.equal((await (await notify(EVENT)).json()).granted, false);
});

test('annuel : 365 jours', async () => {
  const { notify, grants } = setup({ ...PAID, productId: 'prd_y' });
  await notify(EVENT);
  assert.equal(grants[0]!.offer, 'yearly');
  assert.equal(grants[0]!.days, 365);
});

test('le produit fait foi : métadonnées « yearly » sur le produit mensuel → 30 jours', async () => {
  const { notify, grants } = setup({ ...PAID, metadata: { user_id: USER, offer: 'yearly' } });
  await notify(EVENT);
  assert.equal(grants[0]!.days, 30);
});

test('ignorées sans crédit : non payée, autre produit, sans utilisateur, vente inconnue, sans identifiant', async () => {
  const cases: [SaleInfo | null, unknown, string][] = [
    [{ ...PAID, status: 'awaiting_payment' }, EVENT, 'not_paid'],
    [{ ...PAID, productId: 'prd_formation' }, EVENT, 'other_product'],
    [{ ...PAID, productId: null }, EVENT, 'other_product'],
    [{ ...PAID, metadata: {} }, EVENT, 'no_user'],
    [{ ...PAID, metadata: { user_id: 'pas-un-uuid' } }, EVENT, 'no_user'],
    [null, EVENT, 'unknown_sale'],
    [PAID, { event: 'test' }, 'no_sale'],
  ];
  for (const [sale, body, reason] of cases) {
    const { notify, grants } = setup(sale);
    const res = await notify(body);
    assert.equal(res.status, 200, reason);
    assert.equal((await res.json()).ignored, reason);
    assert.equal(grants.length, 0, reason);
  }
});

test('Chariow injoignable : 502 pour une nouvelle tentative', async () => {
  const { notify } = setup(PAID, {
    fetchSale: async () => {
      throw new Error('réseau');
    },
  });
  assert.equal((await notify(EVENT)).status, 502);
});

test('signature valide acceptée sans jeton ; aucune méthode configurée → 500', async () => {
  const secret = 'whsec_test';
  const body = JSON.stringify(EVENT);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hex = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))), (b) => b.toString(16).padStart(2, '0')).join('');
  const { notify, grants } = setup(PAID, { webhookToken: null, signingSecret: secret });
  assert.equal((await notify(EVENT, '', { 'x-chariow-signature': `sha256=${hex}` })).status, 200);
  assert.equal((await notify(EVENT, '', { 'x-chariow-signature': 'sha256=00' })).status, 401);
  assert.equal(grants.length, 1);

  const { notify: unconfigured } = setup(PAID, { webhookToken: null, signingSecret: null });
  assert.equal((await unconfigured(EVENT)).status, 500);
});
