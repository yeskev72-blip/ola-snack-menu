import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';

export default function Body() {
  return (
    <Screen footer={<Button label={t('common.continue')} onPress={() => router.push('/target')} />}>
      <AppText variant="small">{t('onboarding.step', { current: 2, total: 3 })}</AppText>
      <AppText variant="title">{t('onboarding.bodyTitle')}</AppText>
      <AppText variant="muted">{t('common.comingSoon')}</AppText>
    </Screen>
  );
}
