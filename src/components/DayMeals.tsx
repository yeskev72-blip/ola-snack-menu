import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import type { LocalMeal } from '@/lib/meals';
import { MEAL_TYPES } from '@/lib/mealTypes';
import { colors, radius, spacing } from '@/theme';

const time = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Repas d'une journée regroupés par type ; chaque repas ouvre son détail. */
export function DayMeals({ meals }: { meals: LocalMeal[] }) {
  return (
    <>
      {MEAL_TYPES.map(({ value, label }) => {
        const ofType = meals.filter((m) => m.type_repas === value);
        if (ofType.length === 0) return null;
        const kcal = ofType.reduce((sum, m) => sum + m.total.kcal, 0);
        return (
          <Card key={value}>
            <View style={styles.row}>
              <AppText variant="large" style={styles.flex}>
                {t(label)}
              </AppText>
              <AppText variant="large">
                {formatNumber(kcal)} {t('common.kcal')}
              </AppText>
            </View>
            {ofType.map((meal) => (
              <Pressable
                key={meal.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
                style={({ pressed }) => [styles.meal, pressed && styles.pressed]}>
                <AppText variant="small">{time(meal.eaten_at)}</AppText>
                <AppText style={styles.flex} numberOfLines={2}>
                  {meal.items.map((it) => it.label).join(', ')}
                </AppText>
                <AppText variant="muted">{formatNumber(meal.total.kcal)}</AppText>
              </Pressable>
            ))}
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  meal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
});
