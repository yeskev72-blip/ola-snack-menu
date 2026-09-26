import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { MACROS } from '@/components/Macros';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { macroTargets } from '@/lib/calories';
import { parseDayKey } from '@/lib/days';
import { formatNumber } from '@/lib/format';
import { useMealsOfDay } from '@/lib/meals';
import { mealTypeLabel } from '@/lib/mealTypes';
import type { Nutrients } from '@/lib/nutrition';
import { useSession } from '@/state/session';
import { colors, radius, shadow, spacing } from '@/theme';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function DayDetail() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const { user, profile } = useSession();
  const meals = useMealsOfDay(user?.id ?? null, day);
  const total = meals.reduce<Nutrients>(
    (acc, m) => ({
      kcal: acc.kcal + m.total.kcal,
      proteines: acc.proteines + m.total.proteines,
      glucides: acc.glucides + m.total.glucides,
      lipides: acc.lipides + m.total.lipides,
    }),
    { kcal: 0, proteines: 0, glucides: 0, lipides: 0 },
  );
  const target = profile?.calories_cible ?? 0;
  const targets = macroTargets(target);
  const diff = Math.round(total.kcal - target);
  const onTarget = target > 0 && Math.abs(diff) <= target * 0.1;
  const date = parseDayKey(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const title = date.charAt(0).toUpperCase() + date.slice(1);

  return (
    <Screen back="back" title={title}>
      <View style={styles.summary}>
        <View style={styles.flex}>
          <AppText style={styles.big}>{formatNumber(total.kcal)}</AppText>
          <AppText style={styles.bigLabel}>{t('dayDetail.ofTarget', { target: formatNumber(target) })}</AppText>
          {target > 0 && meals.length > 0 ? (
            <View style={styles.badge}>
              <AppText style={styles.badgeText}>
                {`${diff >= 0 ? '+' : '−'}${formatNumber(Math.abs(diff))} ${t('common.kcal')}`}
                {onTarget ? ` · ${t('dayDetail.onTarget')}` : ''}
              </AppText>
            </View>
          ) : null}
        </View>
        <Ring progress={target > 0 ? total.kcal / target : 0} size={104} stroke={10} color={colors.accent}>
          <Icon name="flame" size={28} color={colors.accent} />
        </Ring>
      </View>

      <View style={styles.card}>
        {MACROS.map((m) => {
          const ratio = targets[m.key] > 0 ? Math.min(total[m.key] / targets[m.key], 1) : 0;
          return (
            <View key={m.key} style={styles.macro}>
              <View style={styles.macroHead}>
                <AppText style={styles.semi}>{t(m.label)}</AppText>
                <AppText style={styles.bold}>
                  {formatNumber(total[m.key])} / {formatNumber(targets[m.key])} {t('common.grams')}
                </AppText>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: m.color }]} />
              </View>
            </View>
          );
        })}
      </View>

      <AppText style={styles.section}>{meals.length > 0 ? t('history.mealsCount', { count: meals.length }) : t('history.noMeals')}</AppText>
      {meals.length > 0 ? (
        <View style={styles.list}>
          {meals.map((meal, i) => (
            <Pressable
              key={meal.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}>
              <AppText style={styles.time}>{time(meal.eaten_at)}</AppText>
              <View style={styles.flex}>
                <AppText style={styles.bold} numberOfLines={1}>
                  {meal.items.map((it) => it.label).join(', ') || t(mealTypeLabel(meal.type_repas))}
                </AppText>
                <AppText variant="small">{t(mealTypeLabel(meal.type_repas))}</AppText>
              </View>
              <AppText style={styles.bold}>
                {formatNumber(meal.total.kcal)} {t('common.kcal')}
              </AppText>
              <Icon name="chevron" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  semi: { fontSize: 14, fontWeight: '600' },
  bold: { fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 20, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  big: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1.5 },
  bigLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  badge: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  badgeText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#7A3814' },
  card: { gap: 12, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  macro: { gap: 6 },
  macroHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  section: { marginTop: spacing.xs, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  list: { borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  pressed: { backgroundColor: colors.surfaceAlt },
  time: { width: 44, fontSize: 13, fontWeight: '700', color: colors.textMuted },
});
