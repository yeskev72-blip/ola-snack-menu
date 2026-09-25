import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { useAction } from '@/lib/useAction';
import { useCooldown } from '@/lib/useCooldown';
import { CODE_LENGTH, isValidCode, normalizeCode } from '@/lib/validation';
import { useSession } from '@/state/session';

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
      footer={
        <>
          <Button label={t('common.confirm')} loading={verify.loading} onPress={submit} />
          <Button
            label={cooldown.remaining > 0 ? t('auth.resendIn', { seconds: cooldown.remaining }) : t('auth.resend')}
            variant="ghost"
            disabled={cooldown.remaining > 0}
            loading={resend.loading}
            onPress={() => resend.run()}
          />
        </>
      }>
      <AppText variant="title">{t('auth.codeTitle')}</AppText>
      <AppText>{t('auth.codeBody', { email })}</AppText>
      <TextField
        label={t('auth.codeLabel')}
        value={code}
        onChangeText={(text) => setCode(normalizeCode(text))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH.max}
        onSubmitEditing={submit}
      />
      <Notice message={verify.error ?? resend.error} />
      <Notice message={info} tone="info" />
    </Screen>
  );
}
