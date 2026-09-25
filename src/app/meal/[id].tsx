import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Macros } from '@/components/Macros';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { deleteMeal, useMeal } from '@/lib/meals';
import { mealTypeLabel } from '@/lib/mealTypes';
import { useSession } from '@/state/session';
import { colors, spacing } from '@/theme';

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const meal = useMeal(user?.id ?? null, id);

  if (meal === undefined) return null;
  if (meal === null) {
    return (
      <Screen edges={['bottom']}>
        <AppText variant="muted">{t('mealDetail.notFound')}</AppText>
      </Screen>
    );
  }

  const confirmDelete = () =>
    Alert.alert(t('mealDetail.deleteTitle'), t('mealDetail.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mealDetail.delete'),
        style: 'destructive',
        onPress: () => {
          if (!user) return;
          void deleteMeal(user.id, meal.id);
          router.back();
        },
      },
    ]);

  const date = new Date(meal.eaten_at);

  return (
    <Screen edges={['bottom']} footer={<Button label={t('mealDetail.delete')} variant="secondary" onPress={confirmDelete} />}>
      <Stack.Screen options={{ title: t(mealTypeLabel(meal.type_repas)) }} />
      <AppText variant="muted">
        {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
        {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </AppText>

      <Card style={styles.summary}>
        <AppText variant="display" style={styles.kcal}>
          {formatNumber(meal.total.kcal)}
        </AppText>
        <AppText variant="muted">{t('common.kcal')}</AppText>
        <Macros values={meal.total} />
      </Card>

      <AppText variant="large">{t('result.items')}</AppText>
      {meal.items.map((item, i) => (
        <View key={`${item.label}-${i}`} style={styles.item}>
          <View style={styles.flex}>
            <AppText style={styles.label}>{item.label}</AppText>
            <AppText variant="small">
              {formatNumber(item.grams)} {t('common.grams')}
            </AppText>
          </View>
          <AppText>
            {formatNumber(item.kcal)} {t('common.kcal')}
            {item.estimated ? ` · ${t('result.estimated')}` : ''}
          </AppText>
        </View>
      ))}
      {!meal.synced ? <AppText variant="small">{t('mealDetail.pending')}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  kcal: { color: colors.primary },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flex: { flex: 1 },
  label: { fontWeight: '600' },
});
