import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { useAction } from '@/lib/useAction';
import { isValidCode, isValidEmail, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { useSession } from '@/state/session';

/** Invité → compte e-mail. Même identifiant Supabase : journal et profil sont conservés. */
export default function LinkAccount() {
  const { startLinkEmail, finishLinkEmail } = useSession();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const send = useAction(async () => {
    await startLinkEmail(email.trim());
    setStep('code');
  });
  const confirm = useAction(async () => {
    await finishLinkEmail(email.trim(), code.trim(), password);
    router.back();
  });

  if (step === 'code') {
    return (
      <Screen
        footer={
          <>
            <Button
              label={t('common.confirm')}
              loading={confirm.loading}
              onPress={() => (isValidCode(code) ? confirm.run() : confirm.setError(t('auth.invalidCode')))}
            />
            <Button label={t('auth.resend')} variant="ghost" loading={send.loading} onPress={() => send.run()} />
          </>
        }>
        <AppText variant="title">{t('auth.codeTitle')}</AppText>
        <AppText>{t('auth.codeBody', { email: email.trim() })}</AppText>
        <TextField
          label={t('auth.codeLabel')}
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          maxLength={6}
        />
        <Notice message={confirm.error ?? send.error} />
      </Screen>
    );
  }

  const submit = () => {
    if (!isValidEmail(email)) return send.setError(t('auth.invalidEmail'));
    if (password.length < MIN_PASSWORD_LENGTH) return send.setError(t('auth.shortPassword'));
    void send.run();
  };

  return (
    <Screen footer={<Button label={t('common.continue')} loading={send.loading} onPress={submit} />}>
      <AppText>{t('auth.linkBody')}</AppText>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label={t('auth.password')}
        hint={t('auth.passwordHint')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <Notice message={send.error} />
    </Screen>
  );
}
