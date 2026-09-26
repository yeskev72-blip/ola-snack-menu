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
import { colors, radius, shadow } from '@/theme';

export default function Welcome() {
  const { signInAsGuest } = useSession();
  const guest = useAction(signInAsGuest);

  return (
    <Screen
      scroll={false}
      footer={
        <>
          <Notice message={guest.error} />
          <Button label={t('auth.guest')} loading={guest.loading} onPress={() => guest.run()} />
          <Button label={t('auth.haveAccountShort')} variant="secondary" onPress={() => router.push('/sign-in')} />
          <AppText variant="small" style={styles.center}>
            {t('auth.guestNote')}
          </AppText>
        </>
      }>
      <View style={styles.hero}>
        <View style={styles.art}>
          <View style={styles.ring} />
          <View style={styles.disc} />
          <Logo size={128} />
          <View style={[styles.tag, styles.tagTop]}>
            <AppText style={styles.tagText}>{t('auth.sampleA')}</AppText>
          </View>
          <View style={[styles.tag, styles.tagBottom]}>
            <AppText style={styles.tagText}>{t('auth.sampleB')}</AppText>
          </View>
        </View>
        <View style={styles.texts}>
          <AppText style={styles.kicker}>{APP_NAME}</AppText>
          <AppText style={styles.headline}>{t('auth.tagline')}</AppText>
          <AppText variant="muted" style={styles.sub}>
            {t('auth.taglineSub')}
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  art: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 120, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#E1CFB6' },
  disc: { position: 'absolute', top: 34, left: 34, right: 34, bottom: 34, borderRadius: 86, backgroundColor: colors.accentSoft },
  tag: { position: 'absolute', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow.card },
  tagTop: { top: 8, right: 0 },
  tagBottom: { bottom: 14, left: 0 },
  tagText: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  texts: { alignItems: 'center', gap: 12 },
  kicker: { fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },
  headline: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  sub: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  center: { textAlign: 'center' },
});
