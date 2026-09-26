import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { DailyChart } from '@/components/DailyChart';
import { Icon } from '@/components/Icon';
import { MACROS } from '@/components/Macros';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { t } from '@/i18n';
import { averageKcal, type DayTotals, parseDayKey } from '@/lib/days';
import { formatNumber } from '@/lib/format';
import { syncMeals, todayKey, useDailyTotals } from '@/lib/meals';
import { useSession } from '@/state/session';
import { colors, radius, shadow, spacing } from '@/theme';

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
  const focus = days.find((d) => d.day === selected) ?? null;

  const choosePeriod = (p: 7 | 30) => {
    setPeriod(p);
    setSelected(null);
  };

  return (
    <Screen edges={['top']} title={t('history.title')}>
      <Segmented
        options={[
          { value: 7, label: t('history.last7') },
          { value: 30, label: t('history.last30') },
        ]}
        value={period}
        onChange={choosePeriod}
      />

      <Card style={styles.chartCard}>
        <View style={styles.chartHead}>
          <View>
            <AppText variant="small" style={styles.semi}>
              {t('history.averageLabel')}
            </AppText>
            <View style={styles.avgRow}>
              <AppText style={styles.avg}>{average !== null ? formatNumber(average) : '–'}</AppText>
              <AppText style={styles.avgUnit}>{t('common.kcal')}</AppText>
            </View>
          </View>
          {target ? (
            <View style={styles.key}>
              <View style={styles.keyLine} />
              <AppText variant="small" style={styles.semi}>
                {t('history.targetLine', { kcal: formatNumber(target) })}
              </AppText>
            </View>
          ) : null}
        </View>
        <DailyChart days={days} target={target} selected={selected} onSelect={setSelected} />
        <AppText variant="small" style={styles.center}>
          {average === null ? t('history.averageNone') : target ? t('history.daysOnTarget', { count: onTarget }) : t('history.tapHint')}
        </AppText>
      </Card>

      {focus ? <DayCard day={focus} target={target} /> : null}

      {filled.length > 0 ? <AppText style={styles.section}>{t('history.list')}</AppText> : null}
      {filled.filter((d) => d.day !== focus?.day).map((d) => (
        <DayCard key={d.day} day={d} target={target} compact />
      ))}
    </Screen>
  );
}

/** Carte d'une journée : date, calories, écart à la cible, macros ; ouvre le détail. */
function DayCard({ day, target, compact }: { day: DayTotals; target: number | null; compact?: boolean }) {
  const diff = target ? Math.round(day.kcal - target) : null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/day/[day]', params: { day: day.day } })}
      style={({ pressed }) => [styles.day, pressed && styles.pressed]}>
      <View style={styles.dayHead}>
        <AppText style={styles.dayLabel}>{parseDayKey(day.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</AppText>
        <Icon name="chevron" size={18} color={colors.textMuted} />
      </View>
      <View style={styles.dayKcalRow}>
        <AppText style={compact ? styles.dayKcalSmall : styles.dayKcal}>
          {formatNumber(day.kcal)} {t('common.kcal')}
        </AppText>
        {diff !== null && day.meals > 0 ? (
          <AppText style={styles.diff}>{t(diff >= 0 ? 'history.overTarget' : 'history.underTarget', { kcal: formatNumber(Math.abs(diff)) })}</AppText>
        ) : null}
      </View>
      <View style={styles.macros}>
        {MACROS.map((m) => (
          <View key={m.key} style={styles.macro}>
            <View style={[styles.dot, { backgroundColor: m.color }]} />
            <AppText style={styles.macroText}>
              {formatNumber(day[m.key])} {t('common.grams')} {t(m.short)}
            </AppText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  semi: { fontWeight: '600' },
  center: { textAlign: 'center' },
  chartCard: { borderRadius: radius.lg, gap: 14 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.sm },
  avgRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  avg: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  avgUnit: { fontSize: 15, fontWeight: '700' },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 6 },
  keyLine: { width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.accent },
  section: { marginTop: spacing.xs, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  day: { gap: 12, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  pressed: { backgroundColor: colors.surfaceAlt },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  dayKcalRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10 },
  dayKcal: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  dayKcalSmall: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  diff: { fontSize: 14, fontWeight: '700', color: colors.accent },
  macros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  macroText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#5A4A3C' },
});
