import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { APP_NAME } from '@/config';
import { t } from '@/i18n';
import { useSession } from '@/state/session';
import { spacing } from '@/theme';

export default function Welcome() {
  const { signInAsGuest } = useSession();
  return (
    <Screen
      scroll={false}
      footer={
        <>
          <Button label={t('auth.signUp')} disabled />
          <Button label={t('auth.signIn')} variant="secondary" disabled />
          <Button label={t('auth.guest')} variant="ghost" onPress={signInAsGuest} />
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
