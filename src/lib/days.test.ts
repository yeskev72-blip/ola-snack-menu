/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { average, dayKey, daysOnTarget, lastDays, niceTicks, parseDayKey, totalsByDay } from './days.ts';

test('clés de journée locales', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dayKey(parseDayKey('2026-03-01')), '2026-03-01');
  assert.deepEqual(lastDays(3, new Date(2026, 2, 1, 12)), ['2026-02-27', '2026-02-28', '2026-03-01']);
});

test('totaux par jour, journées vides à zéro', () => {
  const t = (h: number, d: number) => new Date(2026, 0, d, h).toISOString();
  const meals = [
    { eaten_at: t(8, 2), total: { kcal: 400.4, proteines: 10, glucides: 60, lipides: 12 } },
    { eaten_at: t(13, 2), total: { kcal: 700, proteines: 30, glucides: 90, lipides: 20 } },
    { eaten_at: t(13, 9), total: { kcal: 999, proteines: 0, glucides: 0, lipides: 0 } },
  ];
  const days = totalsByDay(meals, ['2026-01-01', '2026-01-02']);
  assert.deepEqual(days[0], { day: '2026-01-01', kcal: 0, proteines: 0, glucides: 0, lipides: 0, meals: 0 });
  assert.equal(days[1]!.kcal, 1100.4, 'une décimale conservée');
  assert.equal(days[1]!.meals, 2);
  assert.equal(average(days, 'kcal'), 1100.4, 'la journée vide ne compte pas');
  assert.equal(average([days[0]!], 'kcal'), null);
});

test('graduations rondes', () => {
  assert.deepEqual(niceTicks(2350), [0, 1000, 2000, 3000]);
  assert.deepEqual(niceTicks(1800), [0, 500, 1000, 1500, 2000]);
  assert.deepEqual(niceTicks(0), [0]);
});

test('journées tenues : fourchette pour les calories, seuil pour les protéines', () => {
  const jour = (kcal: number, proteines: number, meals = 1) => ({ day: '2026-01-01', kcal, proteines, glucides: 0, lipides: 0, meals });
  const jours = [jour(1800, 90), jour(2000, 120), jour(2300, 140), jour(0, 0, 0)];

  // Calories, cible 2 000 : 1 800 et 2 000 tiennent, 2 300 dépasse de plus de 10 %.
  assert.equal(daysOnTarget(jours, 'kcal', 2000), 2);

  // Protéines, cible 120 g : dépasser n'est pas un écart, donc 120 et 140 comptent.
  assert.equal(daysOnTarget(jours, 'proteines', 120), 2);
  // Un gramme manquant ne fait pas perdre la journée ; dix, si.
  assert.equal(daysOnTarget([jour(2000, 119)], 'proteines', 120), 1);
  assert.equal(daysOnTarget([jour(2000, 110)], 'proteines', 120), 0);

  // Une journée sans repas n'est jamais tenue, et sans cible rien n'est compté.
  assert.equal(daysOnTarget([jour(0, 0, 0)], 'proteines', 120), 0);
  assert.equal(daysOnTarget(jours, 'kcal', null), 0);
});
