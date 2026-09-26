import { useNetInfo } from '@react-native-community/netinfo';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DayMeals } from '@/components/DayMeals';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { MacroCards } from '@/components/Macros';
import { Notice } from '@/components/Notice';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { weekOf, WeekStrip } from '@/components/WeekStrip';
import { t } from '@/i18n';
import { fetchScanStatus, type QuotaInfo } from '@/lib/analyze';
import { macroTargets } from '@/lib/calories';
import { formatNumber } from '@/lib/format';
import { syncMeals, todayKey, useDailyTotals, useMealsOfDay, usePendingCount } from '@/lib/meals';
import type { Nutrients } from '@/lib/nutrition';
import { useSession } from '@/state/session';
import { colors, radius, shadow, spacing } from '@/theme';

export default function Journal() {
  const { profile, user } = useSession();
  const userId = user?.id ?? null;
  const [today, setToday] = useState(todayKey);
  const [selected, setSelected] = useState(today);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const meals = useMealsOfDay(userId, selected);
  const week = useDailyTotals(userId, 7, today);
  const pending = usePendingCount(userId);
  const net = useNetInfo();
  const offline = net.isConnected === false || net.isInternetReachable === false;

  // À chaque retour sur l'onglet : nouvelle journée éventuelle, synchro et scans restants.
  useFocusEffect(
    useCallback(() => {
      const now = todayKey();
      setToday((prev) => {
        if (prev !== now) setSelected(now);
        return now;
      });
      if (userId) void syncMeals(userId);
      void fetchScanStatus().then(setQuota);
    }, [userId]),
  );

  const filled = useMemo(() => {
    const days = new Set(weekOf(today));
    return new Set(week.filter((d) => d.meals > 0 && days.has(d.day)).map((d) => d.day));
  }, [week, today]);

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
  const left = target - total.kcal;
  const over = left < 0;
  const isToday = selected === today;

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Logo size={32} />
          <AppText style={styles.brandName}>Calbasse</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={quota ? t('scan.quota', { count: quota.remaining }) : t('scan.quotaUnknown')}
          onPress={() => router.navigate('/scan')}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
          <Icon name="camera" size={18} color={colors.accent} />
          <AppText style={styles.pillText}>{quota ? t('journal.scansLeft', { count: quota.remaining }) : '–'}</AppText>
        </Pressable>
      </View>

      {offline ? (
        <View style={styles.offline} accessibilityRole="alert">
          <Icon name="offline" size={18} color={colors.textMuted} />
          <AppText variant="small" style={styles.flex}>
            {t('journal.offline')}
          </AppText>
        </View>
      ) : pending > 0 ? (
        <Notice tone="info" message={t('journal.pending', { count: pending })} />
      ) : null}

      <WeekStrip today={today} selected={selected} filled={filled} onSelect={setSelected} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${formatNumber(Math.abs(left))} ${t('common.kcal')} ${over ? t('journal.over') : t('journal.remaining')}`}
        onPress={() => router.push({ pathname: '/day/[day]', params: { day: selected } })}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
        <View style={styles.summaryText}>
          <AppText style={[styles.big, over && styles.over]}>{formatNumber(Math.abs(left))}</AppText>
          <AppText style={styles.bigLabel}>
            {t('common.kcal')} {over ? t('journal.over') : t('journal.remaining')}
          </AppText>
          <AppText variant="small" style={styles.summaryHint}>
            {t('journal.eatenOfTarget', { eaten: formatNumber(total.kcal), target: formatNumber(target) })}
          </AppText>
        </View>
        <Ring progress={target > 0 ? total.kcal / target : 0} size={112} stroke={11} color={over ? colors.danger : colors.accent}>
          <Icon name="flame" size={30} color={over ? colors.danger : colors.accent} />
        </Ring>
      </Pressable>

      <MacroCards eaten={total} targets={macroTargets(target)} />

      <AppText style={styles.section} accessibilityRole="header">
        {isToday ? t('journal.todayMeals') : t('journal.dayMeals')}
      </AppText>

      {meals.length === 0 && isToday ? (
        <View style={styles.empty}>
          <Logo size={72} />
          <AppText style={styles.emptyTitle}>{t('journal.emptyTitle')}</AppText>
          <AppText variant="muted" style={styles.center}>
            {t('journal.emptyBody')}
          </AppText>
          <Button label={t('journal.scanCta')} variant="accent" icon="camera" onPress={() => router.navigate('/scan')} />
          <Button label={t('journal.manualCta')} variant="ghost" onPress={() => router.navigate('/foods')} />
        </View>
      ) : meals.length === 0 ? (
        <AppText variant="muted">{t('journal.emptyDay')}</AppText>
      ) : (
        <DayMeals meals={meals} suggestMissing={isToday} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  pill: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...shadow.card,
  },
  pillPressed: { backgroundColor: colors.surfaceAlt },
  pillText: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  flex: { flex: 1 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  summaryText: { flex: 1, gap: 4 },
  big: { fontSize: 48, lineHeight: 52, fontWeight: '800', letterSpacing: -1.5 },
  bigLabel: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.textMuted },
  summaryHint: { marginTop: spacing.sm, fontWeight: '600' },
  over: { color: colors.danger },
  section: { marginTop: 6, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emptyTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  center: { textAlign: 'center' },
});
