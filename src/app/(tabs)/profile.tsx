import { router } from 'expo-router';
import { Alert } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { useSession } from '@/state/session';

export default function Profile() {
  const { user, profile, signOut } = useSession();
  const isGuest = user?.isAnonymous ?? false;

  const confirmSignOut = () => {
    if (!isGuest) return void signOut();
    // Un invité déconnecté ne peut plus retrouver son compte.
    Alert.alert(t('profile.signOutGuestTitle'), t('profile.signOutGuestBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <AppText variant="title">{profile?.prenom || t('profile.title')}</AppText>

      {isGuest ? (
        <Card>
          <AppText variant="large">{t('profile.guestAccount')}</AppText>
          <AppText>{t('profile.guestWarning')}</AppText>
          <Button label={t('profile.createAccount')} onPress={() => router.push('/link-account')} />
        </Card>
      ) : (
        <AppText variant="muted">{user?.email}</AppText>
      )}

      {profile?.calories_cible ? (
        <Card>
          <AppText variant="muted">{t('profile.dailyTarget')}</AppText>
          <AppText variant="large">{t('common.kcalPerDay', { kcal: profile.calories_cible })}</AppText>
        </Card>
      ) : null}

      <Card>
        <AppText variant="muted">{t('profile.language')}</AppText>
        <AppText variant="large">{t('profile.languageName')}</AppText>
      </Card>

      <Button label={t('profile.signOut')} variant="secondary" onPress={confirmSignOut} />
    </Screen>
  );
}
