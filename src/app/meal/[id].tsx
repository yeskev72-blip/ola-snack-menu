import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Macros } from '@/components/Macros';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { deleteMeal, useMeal } from '@/lib/meals';
import { mealTypeLabel } from '@/lib/mealTypes';
import { useSession } from '@/state/session';
import { colors, radius, shadow, spacing } from '@/theme';

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const meal = useMeal(user?.id ?? null, id);

  if (meal === undefined) return null;
  if (meal === null) {
    return (
      <Screen back="back">
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
  const when = `${date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <Screen back="back" footer={<Button label={t('mealDetail.delete')} variant="danger" icon="trash" onPress={confirmDelete} />}>
      <View style={styles.titles}>
        <AppText style={styles.type}>
          {t(mealTypeLabel(meal.type_repas))} · {when}
        </AppText>
        <AppText style={styles.title} accessibilityRole="header">
          {meal.items.map((it) => it.label).join(', ') || t(mealTypeLabel(meal.type_repas))}
        </AppText>
      </View>

      <View style={styles.kcalRow}>
        <AppText style={styles.kcal}>{formatNumber(meal.total.kcal)}</AppText>
        <AppText style={styles.kcalUnit}>{t('common.kcal')}</AppText>
      </View>

      <Macros values={meal.total} />

      <View style={styles.list}>
        {meal.items.map((item, i) => (
          <View key={`${item.label}-${i}`} style={[styles.item, i > 0 && styles.itemBorder]}>
            <View style={styles.flex}>
              <View style={styles.itemTitle}>
                <AppText style={styles.label}>{item.label}</AppText>
                {item.estimated ? (
                  <View style={styles.badge}>
                    <AppText style={styles.badgeText}>{t('result.estimated')}</AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="small">
                {formatNumber(item.grams)} {t('common.grams')}
              </AppText>
            </View>
            <AppText style={styles.itemKcal}>
              {formatNumber(item.kcal)} {t('common.kcal')}
            </AppText>
          </View>
        ))}
      </View>

      {!meal.synced ? (
        <View style={styles.pending}>
          <Icon name="clock" size={16} color={colors.textMuted} />
          <AppText variant="small">{t('mealDetail.pending')}</AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: { gap: 2 },
  type: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  kcal: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1 },
  kcalUnit: { fontSize: 18, fontWeight: '700' },
  list: { borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  item: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  flex: { flex: 1 },
  itemTitle: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  label: { fontWeight: '700', flexShrink: 1 },
  itemKcal: { fontWeight: '700' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#FBEBC4' },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#7A5200' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
