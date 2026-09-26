import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, ToastAndroid } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CodeInput } from '@/components/CodeInput';
import { Heading } from '@/components/Heading';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { useAction } from '@/lib/useAction';
import { CODE_LENGTH, isValidCode, isValidEmail, MIN_PASSWORD_LENGTH, normalizeCode } from '@/lib/validation';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

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
    ToastAndroid.show(t('auth.linkDone'), ToastAndroid.SHORT);
    router.back();
  });

  if (step === 'code') {
    return (
      <Screen
        back="back"
        onBack={() => setStep('form')}
        footer={
          <>
            <Button
              label={t('auth.validate')}
              loading={confirm.loading}
              onPress={() => (isValidCode(code) ? confirm.run() : confirm.setError(t('auth.invalidCode')))}
            />
            <Button label={t('auth.resend')} variant="ghost" loading={send.loading} onPress={() => send.run()} />
          </>
        }>
        <Heading
          title={t('auth.codeTitle')}
          body={
            <>
              {t('auth.codeBody')} <AppText style={styles.email}>{email.trim()}</AppText>
            </>
          }
        />
        <CodeInput
          label={t('auth.codeLabel')}
          value={code}
          onChange={(text) => setCode(normalizeCode(text))}
          onSubmit={() => (isValidCode(code) ? void confirm.run() : confirm.setError(t('auth.invalidCode')))}
          minLength={CODE_LENGTH.min}
          maxLength={CODE_LENGTH.max}
        />
        <AppText variant="small">{t('auth.spamHint')}</AppText>
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
    <Screen back="close" footer={<Button label={t('common.continue')} loading={send.loading} onPress={submit} />}>
      <Heading title={t('auth.linkTitle')} body={t('auth.linkBody')} />
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

const styles = StyleSheet.create({
  email: { color: colors.text, fontWeight: '700' },
});
