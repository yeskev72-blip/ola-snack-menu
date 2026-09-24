import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { APP_NAME } from '@/config';
import { t } from '@/i18n';
import { useAction } from '@/lib/useAction';
import { useSession } from '@/state/session';
import { spacing } from '@/theme';

export default function Welcome() {
  const { signInAsGuest } = useSession();
  const guest = useAction(signInAsGuest);

  return (
    <Screen
      scroll={false}
      footer={
        <>
          <Notice message={guest.error} />
          <Button label={t('auth.signUp')} onPress={() => router.push('/sign-up')} />
          <Button label={t('auth.signIn')} variant="secondary" onPress={() => router.push('/sign-in')} />
          <Button label={t('auth.guest')} variant="ghost" loading={guest.loading} onPress={() => guest.run()} />
          <AppText variant="small" style={styles.center}>
            {t('auth.guestNote')}
          </AppText>
        </>
      }>
      <View style={styles.hero}>
        <Logo size={128} />
        <AppText variant="display">{APP_NAME}</AppText>
        <AppText variant="large" style={styles.center}>
          {t('auth.tagline')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  center: { textAlign: 'center' },
});
