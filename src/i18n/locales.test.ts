import assert from 'node:assert/strict';
import { test } from 'node:test';

import { en } from './en.ts';
import { fr } from './fr.ts';

/** Toutes les chaînes d'une langue, aplaties : { 'journal.title': "Aujourd'hui", … }. */
function flatten(node: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const FR = flatten(fr);
const EN = flatten(en);

/** Les variables d'une chaîne : « Cible : {kcal} kcal » → ['kcal']. */
const vars = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

test('les deux langues ont exactement les mêmes clés', () => {
  assert.deepEqual(Object.keys(EN).sort(), Object.keys(FR).sort());
});

// Une variable oubliée dans la traduction n'affiche rien à l'écran, sans erreur ni avertissement.
// Une variable inventée affiche « {kcal} » tel quel à l'utilisateur.
test('les variables sont les mêmes des deux côtés', () => {
  const fautes: string[] = [];
  for (const [key, texte] of Object.entries(FR)) {
    const attendu = vars(texte);
    const obtenu = vars(EN[key]!);
    if (attendu.join() !== obtenu.join()) fautes.push(`${key} : {${attendu.join('} {')}} attendu, {${obtenu.join('} {')}} trouvé`);
  }
  assert.deepEqual(fautes, []);
});

test('aucune chaîne anglaise vide ou restée en français', () => {
  const vides = Object.entries(EN).filter(([, v]) => !v.trim()).map(([k]) => k);
  assert.deepEqual(vides, [], 'chaînes vides');
  // Les noms propres et les unités partagées sont attendus identiques ; le reste doit différer.
  const identiques = Object.keys(FR).filter((k) => FR[k] === EN[k] && FR[k]!.length > 24);
  assert.deepEqual(identiques, [], 'chaînes longues non traduites');
});
