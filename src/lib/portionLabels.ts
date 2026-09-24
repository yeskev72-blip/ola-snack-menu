import { t, type MessageKey } from '@/i18n';
import { fr } from '@/i18n/fr';
import { describeGrams, type PortionUnit } from '@/lib/portions';

/** « 1,5 louche », « 2 boules » ; nom brut si le repère n'est pas traduit. */
export function unitLabel(name: string, count: number): string {
  const known = name in fr.units;
  const word = known ? t(`units.${name}.${count > 1 ? 'other' : 'one'}` as MessageKey) : name;
  return `${formatCount(count)} ${word}`;
}

export function formatCount(count: number): string {
  return Number.isInteger(count) ? String(count) : count.toFixed(1).replace('.', ',');
}

/** « ≈ 2 louches » si un repère parlant existe, sinon null. */
export function gramsHint(grams: number, units: PortionUnit[]): string | null {
  const d = describeGrams(grams, units);
  return d ? t('item.about', { text: unitLabel(d.unit.name, d.count) }) : null;
}
