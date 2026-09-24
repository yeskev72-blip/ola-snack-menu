import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { DAILY_SCAN_QUOTA } from '@/config';
import { t } from '@/i18n';

export default function Scan() {
  return (
    <Screen edges={['top']}>
      <AppText variant="title">{t('scan.title')}</AppText>
      <AppText variant="muted">{t('scan.quota', { count: DAILY_SCAN_QUOTA.free })}</AppText>
      <Button label={t('scan.takePhoto')} disabled />
      <Button label={t('scan.pickGallery')} variant="secondary" disabled />
      <AppText variant="small">{t('common.comingSoon')}</AppText>
    </Screen>
  );
}
