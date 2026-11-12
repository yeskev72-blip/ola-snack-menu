/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_TOTAL_MS, networkLabel, scanTiming, type ScanMarks } from './scanTiming.ts';

const marks = (over: Partial<ScanMarks> = {}): ScanMarks => ({
  pickedAt: 1_000,
  preparedAt: 1_800,
  analyzeAt: 4_000,
  analyzedAt: 13_000,
  attempts: 1,
  followUp: false,
  ...over,
});

test('durées par étape, et le total part de la photo', () => {
  assert.deepEqual(scanTiming(marks(), 21_000), {
    total_ms: 20_000,
    prep_ms: 800,
    analysis_ms: 9_000,
    review_ms: 8_000,
    attempts: 1,
    follow_up: false,
  });
});

test('les étapes ne font pas le total : le reste est l’attente avant l’analyse', () => {
  const t = scanTiming(marks(), 21_000)!;
  // 2,2 s entre la photo prête et le bouton « Analyser ».
  assert.equal(t.total_ms - t.prep_ms - t.analysis_ms - t.review_ms, 2_200);
});

test('parcours non mesurable : pas de mesure plutôt qu’une mesure fausse', () => {
  assert.equal(scanTiming(null, 21_000), null, 'ajout à la main, repas refait');
  assert.equal(scanTiming(marks({ analyzedAt: undefined }), 21_000), null, 'analyse jamais aboutie');
  assert.equal(scanTiming(marks({ analyzeAt: undefined }), 21_000), null);
  // Horloge du téléphone reculée en route : les instants ne sont plus dans l'ordre.
  assert.equal(scanTiming(marks(), 12_000), null);
  assert.equal(scanTiming(marks({ preparedAt: 500 }), 21_000), null);
});

test('parcours abandonné puis repris : écarté', () => {
  assert.equal(scanTiming(marks(), 1_000 + MAX_TOTAL_MS + 1), null);
  assert.notEqual(scanTiming(marks(), 1_000 + MAX_TOTAL_MS), null, 'la borne elle-même compte encore');
});

test('essais et relance : reportés, et bornés à ce que la base accepte', () => {
  assert.equal(scanTiming(marks({ attempts: 3, followUp: true }), 21_000)!.attempts, 3);
  assert.equal(scanTiming(marks({ followUp: true }), 21_000)!.follow_up, true);
  assert.equal(scanTiming(marks({ attempts: 0 }), 21_000)!.attempts, 1);
  assert.equal(scanTiming(marks({ attempts: 99 }), 21_000)!.attempts, 20);
});

test('réseau : technologie radio sur téléphone, classe de débit sur le web', () => {
  assert.equal(networkLabel('wifi', null, null), 'wifi');
  assert.equal(networkLabel('ethernet', null, '4g'), 'wifi');
  assert.equal(networkLabel('cellular', '3g', null), '3g');
  assert.equal(networkLabel('cellular', null, null), 'cellular');
  // Le navigateur ne connaît que la classe de débit.
  assert.equal(networkLabel('unknown', null, '3g'), '3g');
  assert.equal(networkLabel('other', null, 'slow-2g'), '2g');
  assert.equal(networkLabel(undefined, undefined, undefined), 'unknown');
  assert.equal(networkLabel('cellular', 'lte-advanced', null), 'cellular', 'valeur inconnue : jamais hors de la liste');
});
