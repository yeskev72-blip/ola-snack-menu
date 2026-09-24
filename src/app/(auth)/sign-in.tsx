import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { authErrorCode } from '@/lib/authErrors';
import { useAction } from '@/lib/useAction';
import { isValidEmail } from '@/lib/validation';
import { useSession } from '@/state/session';

export default function SignIn() {
  const { signIn, resendSignupCode } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const action = useAction(async () => {
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      // Compte créé mais jamais confirmé : on renvoie un code et on passe à la saisie.
      if (authErrorCode(e) === 'email_not_confirmed') {
        await resendSignupCode(email.trim()).catch(() => undefined);
        router.push({ pathname: '/verify', params: { email: email.trim() } });
        return;
      }
      throw e;
    }
  });

  const submit = () => {
    if (!isValidEmail(email)) return action.setError(t('auth.invalidEmail'));
    void action.run();
  };

  return (
    <Screen
      footer={
        <>
          <Button label={t('auth.signIn')} loading={action.loading} onPress={submit} />
          <Button label={t('auth.noAccount')} variant="ghost" onPress={() => router.replace('/sign-up')} />
        </>
      }>
      <AppText variant="title">{t('auth.signInTitle')}</AppText>
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
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
      />
      <Notice message={action.error} />
    </Screen>
  );
}
