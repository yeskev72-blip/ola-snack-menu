import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CodeInput } from '@/components/CodeInput';
import { Heading } from '@/components/Heading';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { useAction } from '@/lib/useAction';
import { useCooldown } from '@/lib/useCooldown';
import { CODE_LENGTH, isValidCode, normalizeCode } from '@/lib/validation';
import { useSession } from '@/state/session';
import { colors, spacing } from '@/theme';

export default function Verify() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { verifySignupCode, resendSignupCode } = useSession();
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const cooldown = useCooldown(60);

  // En cas de succès, la session s'ouvre et la navigation passe seule à l'onboarding.
  const verify = useAction(() => verifySignupCode(email, code.trim()));
  const resend = useAction(async () => {
    await resendSignupCode(email);
    setInfo(t('auth.resent'));
    cooldown.start();
  });

  const submit = () => {
    if (!isValidCode(code)) return verify.setError(t('auth.invalidCode'));
    void verify.run();
  };

  return (
    <Screen
      back="back"
      footer={
        <>
          <Button label={t('auth.validate')} loading={verify.loading} onPress={submit} />
          <Button
            label={cooldown.remaining > 0 ? t('auth.resendIn', { seconds: cooldown.remaining }) : t('auth.resend')}
            variant="ghost"
            disabled={cooldown.remaining > 0}
            loading={resend.loading}
            onPress={() => resend.run()}
          />
        </>
      }>
      <Heading
        title={t('auth.codeTitle')}
        body={
          <>
            {t('auth.codeBody')} <AppText style={styles.email}>{email}</AppText>
          </>
        }
        icon={
          <View style={styles.icon}>
            <Icon name="mail" size={28} color={colors.accent} />
          </View>
        }
      />
      <CodeInput
        label={t('auth.codeLabel')}
        value={code}
        onChange={(text) => setCode(normalizeCode(text))}
        onSubmit={submit}
        minLength={CODE_LENGTH.min}
        maxLength={CODE_LENGTH.max}
      />
      <AppText variant="small">{t('auth.spamHint')}</AppText>
      <Notice message={verify.error ?? resend.error} />
      <Notice message={info} tone="info" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { color: colors.text, fontWeight: '700' },
  icon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
});
