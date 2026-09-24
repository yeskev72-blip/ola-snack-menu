import { Stack, useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/AppText';
import { DayMeals } from '@/components/DayMeals';
import { Macros } from '@/components/Macros';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { parseDayKey } from '@/lib/days';
import { useMealsOfDay } from '@/lib/meals';
import type { Nutrients } from '@/lib/nutrition';
import { useSession } from '@/state/session';

export default function DayDetail() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const { user } = useSession();
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
  const title = parseDayKey(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title }} />
      <Card>
        <AppText variant="title">
          {Math.round(total.kcal)} {t('common.kcal')}
        </AppText>
        <Macros values={total} />
      </Card>
      {meals.length === 0 ? <AppText variant="muted">{t('history.noMeals')}</AppText> : null}
      <DayMeals meals={meals} />
    </Screen>
  );
}
