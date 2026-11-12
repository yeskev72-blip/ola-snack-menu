import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { t } from '@/i18n';
import type { MetricKey } from '@/lib/focus';
import { formatNumber } from '@/lib/format';
import type { Nutrients } from '@/lib/nutrition';
import { colors, radius, shadow, spacing } from '@/theme';

/**
 * Les quatre chiffres d'une journée et comment les nommer.
 *
 * Les calories y figurent au même titre qu'une macro : selon l'objectif, ce sont elles ou les
 * protéines qui prennent la grande place, et l'autre descend dans la rangée de cartes.
 */
export const METRICS = {
  kcal: { label: 'journal.calories', left: 'journal.caloriesLeft', over: 'journal.kcalOver', unit: 'common.kcal', short: 'common.kcal', icon: 'flame', color: colors.accent, ink: colors.accent },
  proteines: { label: 'journal.protein', left: 'journal.proteinLeft', over: 'journal.macroExtra', unit: 'common.grams', short: 'history.protShort', icon: 'protein', color: colors.protein, ink: colors.protein },
  glucides: { label: 'journal.carbs', left: 'journal.carbsLeft', over: 'journal.macroOver', unit: 'common.grams', short: 'history.carbsShort', icon: 'carbs', color: colors.carbs, ink: '#9A6B06' },
  lipides: { label: 'journal.fat', left: 'journal.fatLeft', over: 'journal.macroOver', unit: 'common.grams', short: 'history.fatShort', icon: 'fat', color: colors.fat, ink: colors.fat },
} as const;

/** Les trois macros dans l'ordre, pour les écrans qui n'affichent pas les calories à côté. */
export const MACROS = [
  { key: 'proteines', ...METRICS.proteines },
  { key: 'glucides', ...METRICS.glucides },
  { key: 'lipides', ...METRICS.lipides },
] as const;

type MacroValues = Pick<Nutrients, 'proteines' | 'glucides' | 'lipides'>;

/** Protéines, glucides, lipides en grammes : trois petites cartes à barre de couleur (résultat, détails). */
export function Macros({ values }: { values: MacroValues }) {
  return (
    <View style={styles.row}>
      {MACROS.map((m) => (
        <View key={m.key} style={styles.tile} accessible accessibilityLabel={`${t(m.label)} ${formatNumber(values[m.key])} ${t('common.grams')}`}>
          <View style={[styles.bar, { backgroundColor: m.color }]} />
          <View style={styles.tileText}>
            <AppText style={styles.value} numberOfLines={1}>
              {formatNumber(values[m.key])} {t('common.grams')}
            </AppText>
            <AppText variant="small" style={styles.tileLabel} numberOfLines={1}>
              {t(m.label)}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Journal : ce qui reste sur chaque chiffre de second rang, avec un anneau de ce qui est mangé.
 *
 * Dépasser sa ration de protéines n'est pas une faute — c'est même le but en prise de masse — et
 * le rouge du dépassement ne s'applique donc pas à elles.
 *
 * Les calories portent leur unité dans l'étiquette, pas à côté du nombre : « 1 639 kcal » sur
 * trois cartes côte à côte se faisait couper au milieu, ce qu'une capture d'écran a montré.
 */
export function MacroCards({ eaten, targets, keys }: { eaten: Nutrients; targets: Nutrients; keys: readonly MetricKey[] }) {
  return (
    <View style={styles.row}>
      {keys.map((key) => {
        const m = METRICS[key];
        const left = targets[key] - eaten[key];
        const over = left < 0;
        const budget = key !== 'proteines';
        return (
          <View
            key={key}
            style={styles.card}
            accessible
            accessibilityLabel={`${t(m.label)} : ${formatNumber(Math.abs(left))} ${t(m.unit)} ${over ? t('journal.over') : t('journal.remaining')}`}>
            <View>
              <AppText style={[styles.cardValue, over && (budget ? styles.over : styles.reached)]} numberOfLines={1}>
                {formatNumber(Math.abs(left))}
                {key === 'kcal' ? '' : ` ${t(m.unit)}`}
              </AppText>
              <AppText variant="small" style={styles.cardLabel} numberOfLines={1}>
                {over ? t(m.over) : t(m.left)}
              </AppText>
            </View>
            <Ring progress={targets[key] > 0 ? eaten[key] / targets[key] : 0} size={48} stroke={6} color={m.color}>
              <Icon name={m.icon} size={16} color={m.ink} strokeWidth={2.2} />
            </Ring>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.card },
  bar: { width: 8, height: 28, borderRadius: 4 },
  tileText: { flex: 1, minWidth: 0 },
  value: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  tileLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  card: { flex: 1, gap: spacing.sm, padding: 12, borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  cardValue: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  cardLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  over: { color: colors.danger },
  reached: { color: colors.success },
});
