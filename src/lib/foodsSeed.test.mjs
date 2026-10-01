import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * Contrôles sur la table des plats (supabase/seed/foods.json).
 *
 * Les valeurs sont recopiées à la main depuis la table de composition des aliments d'Afrique
 * de l'Ouest (FAO/INFOODS, 2019). Une faute de frappe y serait invisible : l'app afficherait
 * un nombre plausible et faux pendant des mois. Ces tests la rattrapent.
 */

const foods = JSON.parse(readFileSync(new URL('../../supabase/seed/foods.json', import.meta.url), 'utf8'));

/**
 * Facteurs d'Atwater : 1 g de protéines ou de glucides vaut 4 kcal, 1 g de lipides 9 kcal.
 * La somme doit retomber sur les kcal annoncées. Les fibres et les facteurs propres à certains
 * aliments font bouger le total, d'où une tolérance — fixée à 15 %, le plus gros écart des
 * lignes actuelles étant de 11 % (mangue). Ce seuil attrape une virgule déplacée, un chiffre
 * oublié ou deux chiffres transposés, les trois fautes de recopie les plus courantes.
 */
const TOLERANCE = 0.15;

const atwater = (f) => f.proteines_100g * 4 + f.glucides_100g * 4 + f.lipides_100g * 9;

test('table des plats : structure de chaque ligne', () => {
  assert.ok(Array.isArray(foods) && foods.length > 0);
  const keys = new Set();
  for (const f of foods) {
    const où = `${f.food_key ?? '?'}`;
    assert.match(f.food_key, /^[a-z0-9_]+$/, `${où} : clé en minuscules sans accent`);
    assert.equal(keys.has(f.food_key), false, `${où} : clé en double`);
    keys.add(f.food_key);
    assert.ok(typeof f.label_fr === 'string' && f.label_fr.trim(), `${où} : libellé vide`);
    assert.equal(typeof f.verified, 'boolean', `${où} : verified manquant`);
    for (const champ of ['kcal_100g', 'proteines_100g', 'glucides_100g', 'lipides_100g']) {
      assert.ok(Number.isFinite(f[champ]) && f[champ] >= 0, `${où} : ${champ} invalide`);
    }
  }
});

test('table des plats : bornes physiques', () => {
  for (const f of foods) {
    const où = `${f.food_key}`;
    // 900 kcal/100 g, c'est de l'huile pure : aucun plat ne dépasse ça.
    assert.ok(f.kcal_100g <= 900, `${où} : ${f.kcal_100g} kcal/100 g, impossible`);
    for (const champ of ['proteines_100g', 'glucides_100g', 'lipides_100g']) {
      assert.ok(f[champ] <= 100, `${où} : ${champ} dépasse 100 g pour 100 g`);
    }
    const masse = f.proteines_100g + f.glucides_100g + f.lipides_100g;
    assert.ok(masse <= 100, `${où} : ${masse.toFixed(1)} g de macros pour 100 g de produit`);
  }
});

test('table des plats : les kcal concordent avec les macros', () => {
  const écarts = [];
  for (const f of foods) {
    const calculé = atwater(f);
    if (f.kcal_100g === 0 && calculé === 0) continue;
    const écart = Math.abs(calculé - f.kcal_100g) / Math.max(f.kcal_100g, 1);
    if (écart > TOLERANCE) écarts.push(`${f.food_key} : ${f.kcal_100g} kcal annoncées, ${calculé.toFixed(0)} calculées`);
  }
  assert.deepEqual(écarts, [], 'lignes à revérifier dans la table FAO');
});

test('table des plats : une ligne vérifiée cite sa source', () => {
  for (const f of foods.filter((x) => x.verified)) {
    assert.ok(
      typeof f.source === 'string' && !/à vérifier/i.test(f.source) && f.source.trim().length > 10,
      `${f.food_key} : marqué vérifié mais sans source réelle`,
    );
  }
});
