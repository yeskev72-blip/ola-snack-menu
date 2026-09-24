import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';

export default function Result() {
  return (
    <Screen edges={['bottom']}>
      <AppText variant="muted">{t('common.comingSoon')}</AppText>
    </Screen>
  );
}
