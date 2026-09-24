import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Choice } from '@/components/Choice';
import { Screen } from '@/components/Screen';
import { t, type MessageKey } from '@/i18n';
import type { Goal } from '@/lib/calories';
import { useOnboardingDraft } from '@/state/onboardingDraft';

const GOALS: { value: Goal; label: MessageKey }[] = [
  { value: 'perte', label: 'onboarding.goalLose' },
  { value: 'maintien', label: 'onboarding.goalMaintain' },
  { value: 'prise', label: 'onboarding.goalGain' },
];

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
