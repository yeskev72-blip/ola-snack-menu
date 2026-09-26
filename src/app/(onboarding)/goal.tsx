import { router } from 'expo-router';

import { Choice } from '@/components/Choice';
import { Heading } from '@/components/Heading';
import type { IconName } from '@/components/Icon';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { t } from '@/i18n';
import type { Goal } from '@/lib/calories';
import { GOALS } from '@/lib/profileOptions';
import { useOnboardingDraft } from '@/state/onboardingDraft';

const GOAL_ICONS: Record<Goal, IconName> = { perte: 'arrowDown', maintien: 'equal', prise: 'arrowUp' };

export default function GoalScreen() {
  const { draft, update } = useOnboardingDraft();
  return (
    <OnboardingScreen step={1} cta={{ label: t('common.continue'), disabled: !draft.objectif, onPress: () => router.push('/body') }}>
      <Heading title={t('onboarding.goalTitle')} body={t('onboarding.goalBody')} />
      {GOALS.map((goal) => (
        <Choice
          key={goal.value}
          icon={GOAL_ICONS[goal.value]}
          label={t(goal.label)}
          selected={draft.objectif === goal.value}
          onPress={() => update({ objectif: goal.value })}
        />
      ))}
    </OnboardingScreen>
  );
}
