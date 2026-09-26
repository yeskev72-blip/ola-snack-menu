import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysLeft, formatDate, planStatus } from './plan.ts';

const NOW = new Date('2026-09-25T12:00:00Z');

test('statut : gratuit, Premium daté, permanent, expiré', () => {
  assert.deepEqual(planStatus('free', null, NOW), { kind: 'free' });
  assert.deepEqual(planStatus(undefined, undefined, NOW), { kind: 'free' });
  assert.deepEqual(planStatus('premium', null, NOW), { kind: 'premium', until: null });
  assert.deepEqual(planStatus('premium', '2026-10-25T12:00:00Z', NOW), { kind: 'premium', until: new Date('2026-10-25T12:00:00Z') });
  assert.deepEqual(planStatus('premium', '2026-09-24T12:00:00Z', NOW), { kind: 'free' });
});

test('date au format jj/mm/aaaa', () => {
  assert.equal(formatDate(new Date(2026, 9, 5)), '05/10/2026');
});

test('jours restants', () => {
  const now = new Date('2026-09-26T10:00:00Z');
  assert.equal(daysLeft(new Date('2026-10-26T10:00:00Z'), now), 30);
  assert.equal(daysLeft(new Date('2026-09-26T11:00:00Z'), now), 1);
  assert.equal(daysLeft(new Date('2026-09-20T10:00:00Z'), now), 0);
});
