import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CalorieRing } from '@/components/CalorieRing';
import { Card } from '@/components/Card';
import { Macros } from '@/components/Macros';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { MEAL_TYPES } from '@/lib/mealTypes';
import { pendingCount, syncMeals, useMealsOfDay } from '@/lib/meals';
import type { Nutrients } from '@/lib/nutrition';
import { useSession } from '@/state/session';
import { spacing } from '@/theme';

export default function Journal() {
  const { profile, user } = useSession();
  const [today, setToday] = useState(() => new Date());
  const [pending, setPending] = useState(0);
  const meals = useMealsOfDay(user?.id ?? null, today);

  // À chaque retour sur l'onglet : nouvelle journée éventuelle, synchro, repas en attente.
  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
      if (!user) return;
      void syncMeals(user.id).then(() => pendingCount(user.id).then(setPending));
    }, [user]),
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
          {t('journal.eaten', { kcal: Math.round(total.kcal) })} · {t('journal.target', { kcal: target })}
        </AppText>
        <Macros values={total} />
      </Card>

      {pending > 0 ? <Notice tone="info" message={t('journal.pending', { count: pending })} /> : null}

      {meals.length === 0 ? <AppText variant="muted">{t('journal.empty')}</AppText> : null}
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
                {Math.round(kcal)} {t('common.kcal')}
              </AppText>
            </View>
            {ofType.map((meal) => (
              <AppText key={meal.id} variant="muted">
                {meal.items.map((it) => it.label).join(', ')}
              </AppText>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
