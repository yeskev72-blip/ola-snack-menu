/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACTIVITY_LEVELS, basalMetabolicRate, clampTarget, dailyTarget, macroTargets } from './calories.ts';

const femme = { sexe: 'femme', age: 30, taille_cm: 165, poids_kg: 65 } as const;
const homme = { sexe: 'homme', age: 35, taille_cm: 178, poids_kg: 80 } as const;

test('Mifflin-St Jeor', () => {
  // 10×65 + 6,25×165 − 5×30 − 161 = 1370,25
  assert.equal(basalMetabolicRate(femme), 1370.25);
  // 10×80 + 6,25×178 − 5×35 + 5 = 1742,5
  assert.equal(basalMetabolicRate(homme), 1742.5);
});

test('cible selon objectif, arrondie à 10 kcal', () => {
  assert.equal(dailyTarget(homme, ACTIVITY_LEVELS.modere, 'maintien'), 2700); // 2700,9
  assert.equal(dailyTarget(homme, ACTIVITY_LEVELS.modere, 'perte'), 2200);
  assert.equal(dailyTarget(homme, ACTIVITY_LEVELS.modere, 'prise'), 3000);
});

test('plancher de sécurité en perte de poids', () => {
  const petite = { sexe: 'femme', age: 60, taille_cm: 150, poids_kg: 45 } as const;
  assert.equal(dailyTarget(petite, ACTIVITY_LEVELS.sedentaire, 'perte'), 1200);
});

test('bornes de la base', () => {
  assert.equal(clampTarget(500), 1000);
  assert.equal(clampTarget(9000), 6000);
});

test('répartition des macros', () => {
  // 2000 kcal : 500/4 = 125 g, 1000/4 = 250 g, 500/9 ≈ 56 g
  assert.deepEqual(macroTargets(2000), { proteines: 125, glucides: 250, lipides: 56 });
});
