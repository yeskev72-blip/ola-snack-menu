/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACTIVITY_LEVELS, basalMetabolicRate, clampTarget, dailyTarget, macroShares, macroTargets, PROTEIN_PER_KG } from './calories.ts';

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

test('répartition des macros sans poids : ancienne clé de répartition', () => {
  // 2000 kcal : 500/4 = 125 g, 1000/4 = 250 g, 500/9 ≈ 56 g
  assert.deepEqual(macroTargets(2000), { proteines: 125, glucides: 250, lipides: 56 });
  // Un objectif sans poids, ou l'inverse, ne suffit pas à viser les protéines au corps.
  assert.deepEqual(macroTargets(2000, { poids_kg: null, objectif: 'prise' }), { proteines: 125, glucides: 250, lipides: 56 });
  assert.deepEqual(macroTargets(2000, { poids_kg: 70, objectif: null }), { proteines: 125, glucides: 250, lipides: 56 });
});

test('protéines fondées sur le poids, pas sur les calories', () => {
  // Les deux profils que la part fixe de 25 % servait le plus mal (voir docs/ameliorations-phase1.md).
  const prise = macroTargets(2900, { poids_kg: 70, objectif: 'prise' });
  assert.equal(prise.proteines, 126); // 70 × 1,8 — et non 181 g, soit 2,6 g/kg
  const perte = macroTargets(1600, { poids_kg: 90, objectif: 'perte' });
  assert.ok(perte.proteines > 100, 'plus que les 100 g de la part fixe'); // 1,1 g/kg auparavant

  // Même corps, deux cibles caloriques très différentes : la ration de protéines ne bouge pas.
  const maigre = macroTargets(1800, { poids_kg: 70, objectif: 'maintien' });
  const gourmand = macroTargets(3200, { poids_kg: 70, objectif: 'maintien' });
  assert.equal(maigre.proteines, gourmand.proteines);
  assert.equal(maigre.proteines, 112); // 70 × 1,6

  // Ce sont bien les glucides et lipides qui absorbent la différence.
  assert.ok(gourmand.glucides > maigre.glucides && gourmand.lipides > maigre.lipides);
});

test('ration de protéines dans la fourchette usuelle, sur des profils réels', () => {
  // La cible calorique n'est pas choisie à la main : on prend celle que l'app calculerait, pour
  // ne pas valider la ration sur des couples poids/calories qui n'arrivent jamais.
  for (const objectif of ['perte', 'maintien', 'prise'] as const) {
    for (const poids_kg of [50, 70, 90, 110]) {
      for (const activite of [ACTIVITY_LEVELS.sedentaire, ACTIVITY_LEVELS.tres_actif]) {
        const corps = { sexe: 'homme', age: 35, taille_cm: 175, poids_kg } as const;
        const kcal = dailyTarget(corps, activite, objectif);
        const parKilo = macroTargets(kcal, { poids_kg, objectif }).proteines / poids_kg;
        const attendu = PROTEIN_PER_KG[objectif];
        assert.ok(
          parKilo >= 1.6 && parKilo <= attendu + 0.05,
          `${objectif} ${poids_kg} kg, ${kcal} kcal : ${parKilo.toFixed(2)} g/kg`,
        );
      }
    }
  }
});

test('plafond : il reste toujours de quoi manger autre chose', () => {
  // 120 kg au plancher calorique : sans plafond, les protéines mangeraient presque toute la cible.
  const extreme = macroTargets(1000, { poids_kg: 120, objectif: 'perte' });
  assert.equal(extreme.proteines, 113); // 450 kcal, soit les 45 % du plafond, et non 240 g
  assert.ok(extreme.glucides > 0 && extreme.lipides > 0, 'glucides et lipides non nuls');
});

test('les macros rendent bien la cible calorique', () => {
  for (const [kcal, poids_kg, objectif] of [
    [2900, 70, 'prise'],
    [1600, 90, 'perte'],
    [2200, 70, 'maintien'],
    [1000, 120, 'perte'],
  ] as const) {
    const m = macroTargets(kcal, { poids_kg, objectif });
    const somme = m.proteines * 4 + m.glucides * 4 + m.lipides * 9;
    // Seuls les arrondis au gramme séparent la somme de la cible.
    assert.ok(Math.abs(somme - kcal) <= 10, `${kcal} kcal : somme ${somme}`);
  }
});

test('parts affichées : lues sur les grammes retenus', () => {
  const m = macroTargets(2900, { poids_kg: 70, objectif: 'prise' });
  const parts = macroShares(m);
  const total = parts.proteines + parts.glucides + parts.lipides;
  assert.ok(Math.abs(total - 1) < 0.001, `parts sommées à ${total}`);
  // 504 kcal de protéines sur 2900 : nettement moins que les 25 % de l'ancienne constante.
  assert.ok(parts.proteines > 0.16 && parts.proteines < 0.19, `${parts.proteines}`);
  assert.deepEqual(macroShares({ proteines: 0, glucides: 0, lipides: 0 }), { proteines: 0, glucides: 0, lipides: 0 });
});

test('la perte vise plus de protéines que la prise, à poids égal', () => {
  // À calories réduites, c'est la ration de protéines qui protège le muscle.
  assert.ok(PROTEIN_PER_KG.perte > PROTEIN_PER_KG.prise);
  assert.ok(PROTEIN_PER_KG.prise > PROTEIN_PER_KG.maintien);
});
