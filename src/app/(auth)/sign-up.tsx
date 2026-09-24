import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { useAction } from '@/lib/useAction';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { useSession } from '@/state/session';

export default function SignUp() {
  const { signUp } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const action = useAction(async () => {
    await signUp(email.trim(), password);
    router.push({ pathname: '/verify', params: { email: email.trim() } });
  });

  const submit = () => {
    if (!isValidEmail(email)) return action.setError(t('auth.invalidEmail'));
    if (password.length < MIN_PASSWORD_LENGTH) return action.setError(t('auth.shortPassword'));
    void action.run();
  };

  return (
    <Screen
      footer={
        <>
          <Button label={t('auth.signUp')} loading={action.loading} onPress={submit} />
          <Button label={t('auth.haveAccount')} variant="ghost" onPress={() => router.replace('/sign-in')} />
        </>
      }>
      <AppText variant="title">{t('auth.signUpTitle')}</AppText>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        hint={t('auth.passwordHint')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={submit}
      />
      <Notice message={action.error} />
    </Screen>
  );
}
