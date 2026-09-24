import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { useSession } from '@/state/session';

export default function Target() {
  const { completeOnboarding } = useSession();
  return (
    <Screen footer={<Button label={t('onboarding.start')} onPress={completeOnboarding} />}>
      <AppText variant="small">{t('onboarding.step', { current: 3, total: 3 })}</AppText>
      <AppText variant="title">{t('onboarding.targetTitle')}</AppText>
      <AppText variant="muted">{t('common.comingSoon')}</AppText>
    </Screen>
  );
}
