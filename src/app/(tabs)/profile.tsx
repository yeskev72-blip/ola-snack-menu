import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { useSession } from '@/state/session';

export default function Profile() {
  const { signOut } = useSession();
  return (
    <Screen edges={['top']}>
      <AppText variant="title">{t('profile.title')}</AppText>
      <AppText variant="muted">
        {t('profile.language')} : Français
      </AppText>
      <Button label={t('profile.signOut')} variant="secondary" onPress={signOut} />
    </Screen>
  );
}
