import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CalorieRing } from '@/components/CalorieRing';
import { Card } from '@/components/Card';
import { DayMeals } from '@/components/DayMeals';
import { Macros } from '@/components/Macros';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { syncMeals, todayKey, useMealsOfDay, usePendingCount } from '@/lib/meals';
import type { Nutrients } from '@/lib/nutrition';
import { useSession } from '@/state/session';
import { spacing } from '@/theme';

export default function Journal() {
  const { profile, user } = useSession();
  const userId = user?.id ?? null;
  const [today, setToday] = useState(todayKey);
  const meals = useMealsOfDay(userId, today);
  const pending = usePendingCount(userId);

  // À chaque retour sur l'onglet : nouvelle journée éventuelle et synchro.
  useFocusEffect(
    useCallback(() => {
      setToday(todayKey());
      if (userId) void syncMeals(userId);
    }, [userId]),
  );

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

  return (
    <Screen edges={['top']} footer={<Button label={t('journal.scanCta')} onPress={() => router.navigate('/scan')} />}>
      <AppText variant="title">{profile?.prenom ? t('journal.hello', { name: profile.prenom }) : t('journal.title')}</AppText>

      <Card style={styles.summary}>
        <CalorieRing eaten={total.kcal} target={target} />
        <AppText variant="muted">
          {t('journal.eaten', { kcal: formatNumber(total.kcal) })} · {t('journal.target', { kcal: target })}
        </AppText>
        <Macros values={total} />
      </Card>

      {pending > 0 ? <Notice tone="info" message={t('journal.pending', { count: pending })} /> : null}
      {meals.length === 0 ? <AppText variant="muted">{t('journal.empty')}</AppText> : null}
      <DayMeals meals={meals} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md },
});
