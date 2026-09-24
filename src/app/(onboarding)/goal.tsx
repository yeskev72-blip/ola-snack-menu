import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';

export default function Goal() {
  return (
    <Screen footer={<Button label={t('common.continue')} onPress={() => router.push('/body')} />}>
      <AppText variant="small">{t('onboarding.step', { current: 1, total: 3 })}</AppText>
      <AppText variant="title">{t('onboarding.goalTitle')}</AppText>
      <Button label={t('onboarding.goalLose')} variant="secondary" />
      <Button label={t('onboarding.goalMaintain')} variant="secondary" />
      <Button label={t('onboarding.goalGain')} variant="secondary" />
    </Screen>
  );
}
