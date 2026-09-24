import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DailyChart } from '@/components/DailyChart';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { averageKcal, parseDayKey } from '@/lib/days';
import { syncMeals, todayKey, useDailyTotals } from '@/lib/meals';
import { useSession } from '@/state/session';
import { colors, radius, spacing } from '@/theme';

export default function History() {
  const { user, profile } = useSession();
  const userId = user?.id ?? null;
  const [period, setPeriod] = useState<7 | 30>(7);
  const [today, setToday] = useState(todayKey);
  const [selected, setSelected] = useState<string | null>(null);
  const days = useDailyTotals(userId, period, today);

  useFocusEffect(
    useCallback(() => {
      setToday(todayKey());
      if (userId) void syncMeals(userId);
    }, [userId]),
  );

  const target = profile?.calories_cible ?? null;
  const average = averageKcal(days);
  const onTarget = target ? days.filter((d) => d.meals > 0 && Math.abs(d.kcal - target) <= target * 0.1).length : 0;
  const filled = [...days].reverse().filter((d) => d.meals > 0);

  const choosePeriod = (p: 7 | 30) => {
    setPeriod(p);
    setSelected(null);
  };

  return (
    <Screen edges={['top']}>
      <AppText variant="title">{t('history.title')}</AppText>
      <View style={styles.row}>
        <Chip label={t('history.last7')} selected={period === 7} onPress={() => choosePeriod(7)} />
        <Chip label={t('history.last30')} selected={period === 30} onPress={() => choosePeriod(30)} />
      </View>

      <Card>
        <AppText variant="large">{t('history.chartLabel', { days: period })}</AppText>
        <DailyChart days={days} target={target} selected={selected} onSelect={setSelected} />
      </Card>

      <Card>
        <AppText variant="large">{average !== null ? t('history.average', { kcal: average.toLocaleString('fr-FR') }) : t('history.averageNone')}</AppText>
        {target && average !== null ? <AppText variant="muted">{t('history.daysOnTarget', { count: onTarget })}</AppText> : null}
      </Card>

      {filled.length > 0 ? <AppText variant="large">{t('history.list')}</AppText> : null}
      {filled.map((d) => (
        <Pressable
          key={d.day}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/day/[day]', params: { day: d.day } })}
          style={({ pressed }) => [styles.day, pressed && styles.pressed]}>
          <View style={styles.flex}>
            <AppText style={styles.dayLabel}>
              {parseDayKey(d.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </AppText>
            <AppText variant="small">
              {t('history.mealsCount', { count: d.meals })} · {t('history.macrosShort', { p: d.proteines, g: d.glucides, l: d.lipides })}
            </AppText>
          </View>
          <AppText variant="large">
            {d.kcal.toLocaleString('fr-FR')} {t('common.kcal')}
          </AppText>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  dayLabel: { fontWeight: '600', textTransform: 'capitalize' },
});
