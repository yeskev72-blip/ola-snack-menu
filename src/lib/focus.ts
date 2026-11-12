/**
 * Quel chiffre l'écran du jour et l'historique mettent en grand.
 *
 * L'app vise d'abord le sportif qui prend de la masse, et pour lui le chiffre qui décide est la
 * ration de protéines, pas les calories : 3 000 kcal sans protéines ne construisent rien. Les
 * calories passent alors au second rang, toujours visibles.
 *
 * En perte et en maintien les calories gardent la première place — c'est le levier du poids.
 * Les protéines y restent un garde-fou montré à côté, pas l'objectif de la journée.
 *
 * Les deux chiffres ne se lisent d'ailleurs pas dans le même sens : un budget de calories se
 * décompte, une ration de protéines se cumule. Les écrans suivent cette différence.
 *
 * Module pur, sans dépendance de code : testé avec `node --test`.
 */

import type { Goal } from './calories.ts';

export type MetricKey = 'kcal' | 'proteines' | 'glucides' | 'lipides';

/** Les deux chiffres qui peuvent occuper la première place. */
export type FocusMetric = Extract<MetricKey, 'kcal' | 'proteines'>;

export function primaryMetric(objectif: Goal | null | undefined): FocusMetric {
  return objectif === 'prise' ? 'proteines' : 'kcal';
}

/** Les trois chiffres de second rang, dans l'ordre : celui qui cède la vedette vient en tête. */
export function secondaryMetrics(primary: FocusMetric): readonly MetricKey[] {
  return primary === 'proteines' ? ['kcal', 'glucides', 'lipides'] : ['proteines', 'glucides', 'lipides'];
}
