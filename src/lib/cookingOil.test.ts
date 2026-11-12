import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyOil, DEFAULT_OIL, isOilLevel, OIL_LEVELS } from './cookingOil.ts';

const plat = { kcal: 465, proteines: 9, glucides: 80, lipides: 12 };

test('huile : « normal » ne change rien', () => {
  assert.deepEqual(applyOil(plat, 'normal'), plat);
});

test('huile : moins de gras retire des calories, plus en ajoute', () => {
  const peu = applyOil(plat, 'peu');
  const beaucoup = applyOil(plat, 'beaucoup');
  assert.ok(peu.lipides < plat.lipides && peu.kcal < plat.kcal, 'peu doit baisser');
  assert.ok(beaucoup.lipides > plat.lipides && beaucoup.kcal > plat.kcal, 'beaucoup doit monter');
});

test('huile : les calories restent des nombres entiers', () => {
  for (const niveau of OIL_LEVELS) {
    const { kcal } = applyOil(plat, niveau);
    assert.equal(Number.isInteger(kcal), true, `${niveau} : ${kcal} n'est pas entier`);
  }
});

test('huile : les calories suivent les lipides à 9 kcal par gramme', () => {
  for (const niveau of OIL_LEVELS) {
    const out = applyOil(plat, niveau);
    const attendu = plat.kcal + (out.lipides - plat.lipides) * 9;
    assert.ok(Math.abs(out.kcal - attendu) < 0.6, `${niveau} : ${out.kcal} au lieu de ${attendu}`);
  }
});

test('huile : ni protéines ni glucides ne bougent', () => {
  for (const niveau of OIL_LEVELS) {
    const out = applyOil(plat, niveau);
    assert.equal(out.proteines, plat.proteines);
    assert.equal(out.glucides, plat.glucides);
  }
});

// Une pomme n'a pas de gras : aucun niveau ne doit lui inventer des calories.
test('huile : un aliment sans gras est insensible au réglage', () => {
  const pomme = { kcal: 52, proteines: 0.3, glucides: 14, lipides: 0 };
  for (const niveau of OIL_LEVELS) assert.deepEqual(applyOil(pomme, niveau), pomme);
});

test('huile : rien ne devient négatif', () => {
  const presqueVide = { kcal: 1, proteines: 0, glucides: 0, lipides: 0.1 };
  for (const niveau of OIL_LEVELS) {
    const out = applyOil(presqueVide, niveau);
    assert.ok(out.kcal >= 0 && out.lipides >= 0, `${niveau} : valeur négative`);
  }
});

test('huile : isOilLevel refuse ce qui n’est pas un niveau', () => {
  for (const niveau of OIL_LEVELS) assert.equal(isOilLevel(niveau), true);
  for (const faux of ['', 'moyen', 'PEU', null, 3, undefined]) assert.equal(isOilLevel(faux), false);
  assert.equal(isOilLevel(DEFAULT_OIL), true);
});
