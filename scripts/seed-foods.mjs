#!/usr/bin/env node
/**
 * Valide supabase/seed/foods.json puis génère supabase/seed.sql (upsert idempotent).
 *
 *   node scripts/seed-foods.mjs          # valide + génère
 *   node scripts/seed-foods.mjs --check  # valide seulement (échoue si seed.sql n'est pas à jour)
 *
 * seed.sql est appliqué par `supabase db reset` (local) et par
 * `supabase db push --include-seed` (projet distant).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = join(root, 'supabase/seed/foods.json');
const sqlPath = join(root, 'supabase/seed.sql');

const CATEGORIES = ['feculent', 'plat_complet', 'sauce', 'proteine', 'legume', 'fruit', 'matiere_grasse', 'snack', 'boisson', 'sucre'];
const MACROS = ['kcal_100g', 'proteines_100g', 'glucides_100g', 'lipides_100g'];

const foods = JSON.parse(readFileSync(jsonPath, 'utf8'));
const errors = [];
const seen = new Set();

for (const [i, f] of foods.entries()) {
  const where = `#${i} ${f.food_key ?? '?'}`;
  if (!/^[a-z0-9_]+$/.test(f.food_key ?? '')) errors.push(`${where} : food_key invalide`);
  if (seen.has(f.food_key)) errors.push(`${where} : food_key en double`);
  seen.add(f.food_key);
  if (!f.label_fr) errors.push(`${where} : label_fr manquant`);
  if (!CATEGORIES.includes(f.categorie)) errors.push(`${where} : catégorie inconnue « ${f.categorie} »`);
  if (!Array.isArray(f.aliases)) errors.push(`${where} : aliases doit être une liste`);
  for (const m of MACROS) {
    if (typeof f[m] !== 'number' || f[m] < 0) errors.push(`${where} : ${m} invalide`);
  }
  if (f.proteines_100g + f.glucides_100g + f.lipides_100g > 100.5) errors.push(`${where} : macros > 100 g pour 100 g`);
  // Cohérence Atwater : 4 kcal/g protéines et glucides, 9 kcal/g lipides (tolérance 12 %).
  const atwater = 4 * f.proteines_100g + 4 * f.glucides_100g + 9 * f.lipides_100g;
  if (f.kcal_100g > 0 && Math.abs(atwater - f.kcal_100g) / f.kcal_100g > 0.12) {
    errors.push(`${where} : ${f.kcal_100g} kcal annoncées, ${atwater.toFixed(0)} kcal d'après les macros`);
  }
  for (const [name, grams] of Object.entries(f.portion_reperes ?? {})) {
    if (!/^[a-z_]+$/.test(name) || typeof grams !== 'number' || grams <= 0) errors.push(`${where} : repère « ${name} » invalide`);
  }
  if (!f.source) errors.push(`${where} : source manquante`);
  if (f.verified !== false && f.verified !== true) errors.push(`${where} : verified doit être un booléen`);
}

if (errors.length) {
  console.error(`foods.json : ${errors.length} erreur(s)\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`);
const arr = (a) => `array[${a.map(lit).join(', ')}]::text[]`;

const values = foods
  .map(
    (f) =>
      `  (${lit(f.food_key)}, ${lit(f.label_fr)}, ${arr(f.aliases)}, ${lit(f.categorie)}, ` +
      `${f.kcal_100g}, ${f.proteines_100g}, ${f.glucides_100g}, ${f.lipides_100g}, ` +
      `${lit(JSON.stringify(f.portion_reperes ?? {}))}::jsonb, ${lit(f.source)}, ${f.verified})`,
  )
  .join(',\n');

const sql = `-- Généré par scripts/seed-foods.mjs à partir de supabase/seed/foods.json. Ne pas modifier à la main.
-- Valeurs nutritionnelles APPROXIMATIVES, à vérifier (voir docs/FOODS_TODO.md).

insert into public.foods
  (food_key, label_fr, aliases, categorie, kcal_100g, proteines_100g, glucides_100g, lipides_100g, portion_reperes, source, verified)
values
${values}
on conflict (food_key) do update set
  label_fr = excluded.label_fr,
  aliases = excluded.aliases,
  categorie = excluded.categorie,
  kcal_100g = excluded.kcal_100g,
  proteines_100g = excluded.proteines_100g,
  glucides_100g = excluded.glucides_100g,
  lipides_100g = excluded.lipides_100g,
  portion_reperes = excluded.portion_reperes,
  source = excluded.source,
  verified = excluded.verified;
`;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(sqlPath, 'utf8');
  } catch {}
  if (current !== sql) {
    console.error('supabase/seed.sql n\'est pas à jour : lance `node scripts/seed-foods.mjs`.');
    process.exit(1);
  }
  console.log(`foods.json valide (${foods.length} entrées), seed.sql à jour.`);
} else {
  writeFileSync(sqlPath, sql);
  console.log(`${foods.length} plats écrits dans supabase/seed.sql`);
}
