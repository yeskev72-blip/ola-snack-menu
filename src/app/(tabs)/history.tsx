import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';

export default function History() {
  return (
    <Screen edges={['top']}>
      <AppText variant="title">{t('history.title')}</AppText>
      <AppText variant="muted">{t('common.comingSoon')}</AppText>
    </Screen>
  );
}
