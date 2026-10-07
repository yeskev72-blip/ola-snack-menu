import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitWithin, resizeOptions } from './photoSize.ts';

const MAX = 1024;
/** Un pixel d'arrondi est inévitable ; au-delà, la déformation se voit. */
const TOLERANCE = 0.01;

test('fitWithin : les proportions sont gardées', () => {
  for (const [w, h] of [
    [4000, 3000], // 4:3, le format courant
    [3000, 4000], // portrait
    [4000, 1800], // panorama
    [1200, 1200], // carré
  ] as const) {
    const out = fitWithin(w, h, MAX);
    const écart = Math.abs(out.width / out.height - w / h) / (w / h);
    assert.ok(écart < TOLERANCE, `${w}×${h} → ${out.width}×${out.height} : proportions changées`);
    assert.ok(Math.max(out.width, out.height) <= MAX, `${w}×${h} : côté long au-dessus de ${MAX}`);
  }
});

test('fitWithin : une petite photo n’est pas agrandie', () => {
  assert.deepEqual(fitWithin(640, 480, MAX), { width: 640, height: 480 });
});

test('fitWithin : des dimensions absurdes ne cassent rien', () => {
  for (const [w, h] of [
    [0, 0],
    [Number.NaN, Number.NaN],
    [-10, -10],
  ] as const) {
    assert.deepEqual(fitWithin(w, h, MAX), { width: 0, height: 0 });
  }
});

// La photo arrivait carrée parce que les deux dimensions étaient imposées au décodage : le
// navigateur étire alors l'image pour remplir le cadre demandé.
test('resizeOptions : jamais les deux dimensions à la fois', () => {
  for (const [w, h] of [
    [4000, 3000],
    [3000, 4000],
    [4000, 4000],
    [8000, 1000],
  ] as const) {
    const o = resizeOptions(w, h, MAX);
    assert.ok(
      o.resizeWidth === undefined || o.resizeHeight === undefined,
      `${w}×${h} : les deux dimensions imposées, la photo serait déformée`,
    );
  }
});

test('resizeOptions : c’est le côté long qui est bridé', () => {
  assert.deepEqual(resizeOptions(4000, 3000, MAX), { resizeWidth: MAX, resizeQuality: 'high' });
  assert.deepEqual(resizeOptions(3000, 4000, MAX), { resizeHeight: MAX, resizeQuality: 'high' });
});

test('resizeOptions : rien à demander si la photo est déjà petite ou inconnue', () => {
  assert.deepEqual(resizeOptions(800, 600, MAX), {});
  assert.deepEqual(resizeOptions(MAX, MAX, MAX), {});
  assert.deepEqual(resizeOptions(0, 0, MAX), {});
  assert.deepEqual(resizeOptions(Number.NaN, Number.NaN, MAX), {});
});
