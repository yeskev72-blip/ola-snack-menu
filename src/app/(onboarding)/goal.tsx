import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Choice } from '@/components/Choice';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { GOALS } from '@/lib/profileOptions';
import { useOnboardingDraft } from '@/state/onboardingDraft';

export default function GoalScreen() {
  const { draft, update } = useOnboardingDraft();
  return (
    <Screen
      footer={<Button label={t('common.continue')} disabled={!draft.objectif} onPress={() => router.push('/body')} />}>
      <AppText variant="small">{t('onboarding.step', { current: 1, total: 3 })}</AppText>
      <AppText variant="title">{t('onboarding.goalTitle')}</AppText>
      {GOALS.map((goal) => (
        <Choice
          key={goal.value}
          label={t(goal.label)}
          selected={draft.objectif === goal.value}
          onPress={() => update({ objectif: goal.value })}
        />
      ))}
    </Screen>
  );
}
