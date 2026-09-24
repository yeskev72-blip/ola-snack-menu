import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { t } from '@/i18n';
import type { Nutrients } from '@/lib/nutrition';
import { colors, spacing } from '@/theme';

const MACROS = [
  { key: 'proteines', label: 'journal.protein', color: colors.protein },
  { key: 'glucides', label: 'journal.carbs', color: colors.carbs },
  { key: 'lipides', label: 'journal.fat', color: colors.fat },
] as const;

/** Protéines, glucides, lipides en grammes. */
export function Macros({ values }: { values: Nutrients }) {
  return (
    <View style={styles.row}>
      {MACROS.map((m) => (
        <View key={m.key} style={styles.macro}>
          <View style={[styles.dot, { backgroundColor: m.color }]} />
          <AppText variant="small">{t(m.label)}</AppText>
          <AppText variant="large">
            {Math.round(values[m.key])} {t('common.grams')}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch' },
  macro: { alignItems: 'center', gap: spacing.xs },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
