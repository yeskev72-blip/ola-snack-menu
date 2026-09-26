import { router } from 'expo-router';

import { Choice } from '@/components/Choice';
import { Heading } from '@/components/Heading';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { t } from '@/i18n';
import { ACTIVITIES } from '@/lib/profileOptions';
import { useOnboardingDraft } from '@/state/onboardingDraft';

/** « Modérée (3 à 5 séances par semaine) » → titre « Modérée », détail entre parenthèses. */
const split = (label: string) => {
  const m = /^(.*?) \((.*)\)$/.exec(label);
  return m ? { title: m[1]!, detail: m[2]! } : { title: label, detail: undefined };
};

export default function ActivityScreen() {
  const { draft, update } = useOnboardingDraft();
  return (
    <OnboardingScreen step={4} cta={{ label: t('onboarding.computeTarget'), onPress: () => router.push('/target') }}>
      <Heading title={t('onboarding.activityTitle')} body={t('onboarding.activityBody')} />
      {ACTIVITIES.map((a) => {
        const { title, detail } = split(t(a.label));
        return <Choice key={a.value} label={title} description={detail} selected={draft.activite === a.value} onPress={() => update({ activite: a.value })} />;
      })}
    </OnboardingScreen>
  );
}
