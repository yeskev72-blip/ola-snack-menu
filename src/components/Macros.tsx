import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import type { Nutrients } from '@/lib/nutrition';
import { colors, radius, shadow, spacing } from '@/theme';

export const MACROS = [
  { key: 'proteines', label: 'journal.protein', left: 'journal.proteinLeft', short: 'history.protShort', icon: 'protein', color: colors.protein, ink: colors.protein },
  { key: 'glucides', label: 'journal.carbs', left: 'journal.carbsLeft', short: 'history.carbsShort', icon: 'carbs', color: colors.carbs, ink: '#9A6B06' },
  { key: 'lipides', label: 'journal.fat', left: 'journal.fatLeft', short: 'history.fatShort', icon: 'fat', color: colors.fat, ink: colors.fat },
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

/** Journal : grammes restants par macro, avec un anneau de ce qui est déjà mangé. */
export function MacroCards({ eaten, targets }: { eaten: MacroValues; targets: MacroValues }) {
  return (
    <View style={styles.row}>
      {MACROS.map((m) => {
        const left = targets[m.key] - eaten[m.key];
        const over = left < 0;
        return (
          <View
            key={m.key}
            style={styles.card}
            accessible
            accessibilityLabel={`${t(m.label)} : ${formatNumber(Math.abs(left))} ${t('common.grams')} ${over ? t('journal.over') : t('journal.remaining')}`}>
            <View>
              <AppText style={[styles.cardValue, over && styles.over]}>
                {formatNumber(Math.abs(left))} {t('common.grams')}
              </AppText>
              <AppText variant="small" style={styles.cardLabel} numberOfLines={1}>
                {over ? t('journal.macroOver') : t(m.left)}
              </AppText>
            </View>
            <Ring progress={targets[m.key] > 0 ? eaten[m.key] / targets[m.key] : 0} size={48} stroke={6} color={m.color}>
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
});
